import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'
import { RuntimeCore, type RuntimeHost } from './RuntimeCore'
import type { ChatEngine } from './ChatEngine'
import { IndexDb } from './IndexDb'
import type { WorkspaceStore } from './WorkspaceStore'
import { PathResolver } from './paths'
import * as fsx from './fsx'
import {
  defaultSettings,
  DEFAULT_SEARCH_OPTIONS,
  type Conversation,
  type Page,
  type Folder
} from '@shared/domain'
import type { RuntimeEvent, SessionSnapshot, SettingsSnapshot } from '@shared/contracts'

const host: RuntimeHost = {
  getVersion: () => 'test',
  saveFile: async () => ({}),
  openTextFile: async () => null,
  pickDirectory: async () => null,
  pickImages: async () => [],
  openInFileManager: async () => undefined
}
let root: string
let runtime: RuntimeCore
let session: SessionSnapshot
let events: RuntimeEvent[]
const internals = (): {
  workspace: WorkspaceStore
  index: IndexDb
  chat: ChatEngine
  checkExternalChanges: () => Promise<void>
} => runtime as unknown as ReturnType<typeof internals>

async function page(name = '测试', parentFolderId?: string): Promise<Page> {
  return (await runtime.command('page.create', { name, parentFolderId })) as Page
}
async function conversation(pageId: string): Promise<Conversation> {
  return (await runtime.query('conversation.get', { pageId })) as Conversation
}
async function append(pageId: string, id: string, content = id): Promise<void> {
  await runtime.command('conversation.append', { pageId, draft: { id, role: 'user', content } })
}
async function configure(): Promise<void> {
  const settings = defaultSettings()
  settings.llmConfigs.items = [
    {
      id: 'llm',
      kind: 'item',
      name: 'test',
      order: 0,
      createdAt: 1,
      apiKey: 'test-only',
      baseUrl: 'http://invalid.test/v1',
      modelName: 'test'
    }
  ]
  settings.defaultLLMId = 'llm'
  await runtime.command('settings.replace', { settings })
}
function streams(): Array<{ delta: (text: string) => void; end: () => void }> {
  const channels: Array<{ delta: (text: string) => void; end: () => void }> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, options: RequestInit) => {
      let closed = false
      return new Response(
        new ReadableStream({
          start(controller) {
            const emit = (text: string): void => {
              if (!closed) controller.enqueue(new TextEncoder().encode(text))
            }
            const end = (): void => {
              if (!closed) {
                closed = true
                controller.close()
              }
            }
            options.signal?.addEventListener('abort', end, { once: true })
            channels.push({
              delta: (text) =>
                emit(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`),
              end: () => {
                emit('data: [DONE]\n\n')
                end()
              }
            })
          },
          cancel() {
            closed = true
          }
        })
      )
    })
  )
  return channels
}
async function terminal(requestId: string): Promise<void> {
  await vi.waitFor(() =>
    expect(
      events.some(
        (event) =>
          ['chat.completed', 'chat.failed', 'chat.aborted', 'chat.saveFailed'].includes(
            event.type
          ) &&
          'requestId' in event.payload &&
          event.payload.requestId === requestId
      )
    ).toBe(true)
  )
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'pointer-review-'))
  runtime = new RuntimeCore({ appDataPath: root, host })
  events = []
  runtime.subscribe((event) => events.push(event))
  await runtime.init()
  session = (await runtime.query('session.get', undefined)) as SessionSnapshot
})

afterEach(async () => {
  vi.restoreAllMocks()
  await runtime.retrySaves()
  await runtime.dispose()
  vi.unstubAllGlobals()
  const target = resolve(root)
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('pointer-review-'))
    throw new Error('非法测试清理路径')
  await rm(target, { recursive: true, force: true })
})

describe('存储回归', () => {
  // 36 个并发写入命令最终串行落盘，为 Windows CI 的 fsync 和覆盖率开销留出余量。
  it('[R1] 并发读改写和队列操作不会互相覆盖', async () => {
    const p = await page()
    await Promise.all(Array.from({ length: 12 }, (_, index) => append(p.id, `m${index}`)))
    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        runtime.command('conversation.updateMessage', {
          pageId: p.id,
          messageId: `m${index}`,
          patch: { starred: true }
        })
      )
    )
    expect((await conversation(p.id)).messages.filter((message) => message.starred)).toHaveLength(
      12
    )
    await runtime.command('queue.setPaused', { pageId: p.id, paused: true })
    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        runtime.command('queue.add', { pageId: p.id, content: String(index) })
      )
    )
    expect(await runtime.query('queue.get', { pageId: p.id })).toMatchObject({
      items: Array.from({ length: 12 }, (_, index) =>
        expect.objectContaining({ content: String(index) })
      )
    })
  }, 15000)

  it.each(['cascade', 'clear'] as const)(
    '[R3] 文件夹 %s 删除磁盘页面与队列，重新打开不复活',
    async (mode) => {
      const folder = (await runtime.command('folder.create', { name: '父' })) as Folder
      const p = await page('子', folder.id)
      await runtime.command('queue.setPaused', { pageId: p.id, paused: true })
      await runtime.command('queue.add', { pageId: p.id, content: 'queued' })
      await runtime.command(
        mode === 'clear' ? 'folder.clear' : 'folder.delete',
        mode === 'clear' ? { folderId: folder.id } : { folderIds: [folder.id], mode }
      )
      await runtime.command('session.selectWorkspace', { workspaceId: session.workspaceId! })
      expect(await runtime.query('tree.get', undefined)).toMatchObject({ pages: [] })
      expect(await readdir(join(session.workspacePath!, '.pointer', 'queues'))).toEqual([])
    }
  )

  it('[R3] 删除失败向上传递，不广播成功树或清空内存', async () => {
    const p = await page()
    const remove = vi.spyOn(fsx, 'removePath').mockRejectedValueOnce(new Error('EACCES'))
    const before = events.length
    await expect(runtime.command('page.delete', { pageIds: [p.id] })).rejects.toThrow('EACCES')
    expect(events.slice(before).some((event) => event.type === 'tree.changed')).toBe(false)
    expect(internals().workspace.getPage(p.id)).toBeDefined()
    remove.mockRestore()
  })

  it('[R4,R5] 元数据保存字面替换符，普通隐藏文件夹可以重开', async () => {
    const folder = (await runtime.command('folder.create', { name: '.archive' })) as Folder
    const p = await page('标题', folder.id)
    const title = "$& $' $` $$"
    await runtime.command('page.update', { pageId: p.id, patch: { name: title } })
    await runtime.command('session.selectWorkspace', { workspaceId: session.workspaceId! })
    expect(internals().workspace.getPage(p.id)?.name).toBe(title)
    expect(internals().workspace.getFolder(folder.id)?.name).toBe('.archive')
    for (const name of ['.pointer', '.git', '.hg', '.svn'])
      await expect(runtime.command('folder.create', { name })).rejects.toMatchObject({
        code: 'folder.reserved-name'
      })
  })

  it('[R6] 损坏索引隔离后从 Markdown 重建，写入错误不伪装成损坏', async () => {
    const p = await page()
    await append(p.id, 'm', 'index recovery')
    await runtime.dispose()
    const file = new PathResolver(root).indexFile(session.workspacePath!)
    await writeFile(file, 'not a sqlite database')
    runtime = new RuntimeCore({ appDataPath: root, host })
    await runtime.init()
    expect(internals().index.searchCandidates('recovery', true)).toHaveLength(1)
    expect(
      (await readdir(dirname(file))).some((name) => name.startsWith('index.db.corrupt-'))
    ).toBe(true)
    const directory = join(root, 'not-a-file')
    await mkdir(directory)
    expect(() => IndexDb.open(directory)).toThrow()
    expect((await readdir(root)).some((name) => name.startsWith('not-a-file.corrupt-'))).toBe(false)
  })

  it('[R18] 外部新增、移动和删除同步索引，删除不会留下幽灵命中', async () => {
    const p = await page()
    await append(p.id, 'm', 'external needle')
    const ws = internals().workspace
    const original = join(ws.path, ws.relativePathOf(p.id)!)
    await mkdir(join(ws.path, '.archive'))
    const moved = join(ws.path, '.archive', 'moved.pointer.md')
    await rename(original, moved)
    await internals().checkExternalChanges()
    expect(internals().index.listPages().get(p.id)?.relPath).toContain('.archive/')
    await rm(join(ws.path, ws.relativePathOf(p.id)!))
    await internals().checkExternalChanges()
    expect(internals().index.searchCandidates('needle', true)).toEqual([])
    expect(
      await runtime.query('search.workspace', { query: 'needle', options: DEFAULT_SEARCH_OPTIONS })
    ).toMatchObject({ total: 0 })
  })

  it('[R19] 同一消息 ID 可存在不同页面，FTS 查询和删除不会串页', async () => {
    const a = await page('A'),
      b = await page('B')
    await append(a.id, 'same', 'common alpha')
    await append(b.id, 'same', 'common beta')
    expect(internals().index.searchCandidates('common', true)).toHaveLength(2)
    expect(internals().index.searchCandidates('alpha', true)[0].pageId).toBe(a.id)
    await runtime.command('page.delete', { pageIds: [a.id] })
    expect(
      internals()
        .index.searchCandidates('common', true)
        .map((item) => item.pageId)
    ).toEqual([b.id])
  })

  it('[R19] 旧索引结构自动升级并重建联合身份', async () => {
    const p = await page()
    await append(p.id, 'm', 'migration')
    await runtime.dispose()
    const db = new DatabaseSync(new PathResolver(root).indexFile(session.workspacePath!))
    db.exec('PRAGMA user_version = 1')
    db.close()
    runtime = new RuntimeCore({ appDataPath: root, host })
    await runtime.init()
    expect(internals().index.searchCandidates('migration', true)).toHaveLength(1)
  })

  it('[R20] 1200 条消息的选择、折叠、星标和话题变化不写消息全文索引', async () => {
    const p = await page()
    const record: Conversation = {
      pageId: p.id,
      topics: [],
      messages: Array.from({ length: 1200 }, (_, index) => ({
        id: `m${index}`,
        role: 'user',
        content: `message ${index} `.repeat(10),
        createdAt: index,
        branchIndex: index
      }))
    }
    await runtime.command('conversation.replace', { pageId: p.id, conversation: record })
    const db = (internals().index as unknown as { db: DatabaseSync }).db
    const changes = (): number => Number(db.prepare('SELECT total_changes() AS count').get()!.count)
    const before = changes(),
      at = performance.now()
    await runtime.command('conversation.setSelected', { pageId: p.id, messageId: 'm1' })
    const elapsed = performance.now() - at
    expect(changes() - before).toBe(1)
    const next = changes()
    await runtime.command('conversation.updateMessages', {
      pageId: p.id,
      messageIds: ['m1', 'm2'],
      patch: { collapsed: true, starred: true }
    })
    expect(changes() - next).toBe(1)
    console.info(`[R20] 1200 messages, selection: ${elapsed.toFixed(1)} ms; message/FTS writes: 0`)
    expect((await conversation(p.id)).selectedMessageId).toBe('m1')
  })

  it('[R25,R26] 队列和附件拒绝越界、目录、符号链接及 junction', async () => {
    const p = await page()
    await expect(
      runtime.command('queue.add', { pageId: '../../../outside', content: 'bad' })
    ).rejects.toThrow()
    expect(() => new PathResolver(root).queueFile(session.workspacePath!, '../outside')).toThrow()
    const outside = join(root, 'outside.txt')
    await writeFile(outside, 'keep')
    for (const relativePath of [
      'outside.txt',
      '../outside.txt',
      '.pointer/attachments/../outside.txt',
      '.pointer/attachments',
      'C:/outside.txt'
    ]) {
      await expect(runtime.command('attachment.delete', { relativePath })).rejects.toThrow()
    }
    const attachmentDir = join(session.workspacePath!, '.pointer', 'attachments')
    await mkdir(join(attachmentDir, 'directory'))
    await expect(
      runtime.command('attachment.delete', { relativePath: '.pointer/attachments/directory' })
    ).rejects.toThrow()
    await symlink(root, join(attachmentDir, 'junction'), 'junction')
    await expect(
      runtime.query('attachment.read', { relativePath: '.pointer/attachments/junction' })
    ).rejects.toThrow()
    const moved = join(session.workspacePath!, '.pointer', 'original-attachments')
    await rename(attachmentDir, moved)
    await symlink(root, attachmentDir, 'junction')
    await expect(
      runtime.command('attachment.import', {
        pageId: p.id,
        files: [{ name: 'x.txt', mimeType: 'text/plain', dataBase64: 'eA==' }]
      })
    ).rejects.toThrow()
    await rm(attachmentDir)
    await rename(moved, attachmentDir)
    expect(await readFile(outside, 'utf8')).toBe('keep')
  })
})

describe('聊天生命周期回归', () => {
  it('[R7,R9] 关闭与用户消息落盘交错时，不遗漏尚在准入中的请求', async () => {
    await configure()
    const p = await page(),
      channels = streams()
    const ws = internals().workspace
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const original = ws.writeConversation.bind(ws)
    const write = vi.spyOn(ws, 'writeConversation').mockImplementationOnce(async (record) => {
      await original(record)
      await gate
    })
    const sending = runtime.command('chat.send', { pageId: p.id, content: 'pending write' })
    await vi.waitFor(() => expect(write).toHaveBeenCalled())
    const closing = runtime.prepareClose()
    await Promise.resolve()
    release()
    await sending
    await closing
    expect(internals().chat.isPageBusy(p.id)).toBe(false)
    expect(channels).toHaveLength(0)
    runtime.resume()
    expect((await conversation(p.id)).messages.map((message) => message.content)).toEqual([
      'pending write'
    ])
  })

  it('[R2] 标题返回只应用标题补丁，保留期间新增的消息', async () => {
    await configure()
    const p = await page()
    await append(p.id, 'm')
    const channels = streams()
    const title = runtime.command('chat.generateTitle', {
      pageId: p.id,
      target: { kind: 'message', messageId: 'm' }
    })
    await vi.waitFor(() => expect(channels).toHaveLength(1))
    await append(p.id, 'new', 'new content')
    channels[0].delta('新标题')
    channels[0].end()
    expect(await title).toBe('新标题')
    expect((await conversation(p.id)).messages.map((message) => message.id)).toEqual(['m', 'new'])
  })

  it('[R7,R13] 切换账户中止生成，旧回答在原工作区保存，旧作用域调用被拒绝', async () => {
    await configure()
    const p = await page(),
      channels = streams()
    const handle = (await runtime.command('chat.send', { pageId: p.id, content: 'question' })) as {
      requestId: string
    }
    channels[0].delta('partial answer')
    await vi.waitFor(() => expect(events.some((event) => event.type === 'chat.delta')).toBe(true))
    await runtime.command('account.create', { name: 'other' })
    await terminal(handle.requestId)
    await expect(
      runtime.command('page.create', { name: 'stale' }, session.scopeId)
    ).rejects.toMatchObject({ code: 'runtime.stale-scope' })
    await runtime.command('session.selectAccount', { accountId: session.accountId! })
    expect((await conversation(p.id)).messages.at(-1)?.content).toBe('partial answer')
    expect(((await runtime.query('session.get', undefined)) as SessionSnapshot).scopeId).not.toBe(
      session.scopeId
    )
  })

  it('[R8] 保存失败保留完整内容并阻止关闭，重试只写盘', async () => {
    await configure()
    const p = await page(),
      channels = streams()
    const handle = (await runtime.command('chat.send', { pageId: p.id, content: 'question' })) as {
      requestId: string
    }
    const spy = vi
      .spyOn(internals().workspace, 'writeConversation')
      .mockRejectedValueOnce(new Error('disk full'))
    channels[0].delta('complete answer')
    channels[0].end()
    await terminal(handle.requestId)
    expect(events.find((event) => event.type === 'chat.saveFailed')).toMatchObject({
      payload: { message: { content: 'complete answer' } }
    })
    await expect(runtime.prepareClose()).rejects.toMatchObject({ code: 'chat.unsaved' })
    await expect(
      runtime.command('session.selectAccount', { accountId: session.accountId! })
    ).rejects.toMatchObject({ code: 'chat.unsaved' })
    spy.mockRestore()
    await runtime.command('chat.retrySave', { requestId: handle.requestId })
    expect(channels).toHaveLength(1)
    expect((await conversation(p.id)).messages.at(-1)?.content).toBe('complete answer')
  })

  it('[R9] 初始化异常不泄漏请求；失败队列项保留', async () => {
    await configure()
    const p = await page()
    const spy = vi
      .spyOn(internals().workspace, 'readAttachmentAsDataUrl')
      .mockRejectedValue(new Error('attachment failed'))
    await expect(
      runtime.command('chat.send', {
        pageId: p.id,
        content: 'image',
        attachments: [
          {
            id: 'a',
            name: 'a',
            mimeType: 'image/png',
            size: 1,
            relativePath: '.pointer/attachments/a.png',
            createdAt: 1
          }
        ]
      })
    ).rejects.toThrow('attachment failed')
    expect(internals().chat.isPageBusy(p.id)).toBe(false)
    await internals().chat.abortAll()
    spy.mockRestore()
    await runtime.command('settings.replace', { settings: defaultSettings() })
    await runtime.command('queue.add', { pageId: p.id, content: 'keep queued' })
    await internals().workspace.idle()
    expect(await runtime.query('queue.get', { pageId: p.id })).toMatchObject({
      items: [expect.objectContaining({ content: 'keep queued' })]
    })
  })

  it('[R7,R16] 重置等待 flush，期间的切换串行执行且禁止新生成', async () => {
    await configure()
    const p = await page()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const flush = vi.fn(() => gate)
    runtime.setFlushHandler(flush)
    const resetting = runtime.command('data.reset', { targets: ['layout'] })
    await vi.waitFor(() => expect(flush).toHaveBeenCalledOnce())
    const switching = runtime.command('account.create', { name: 'next' })
    await expect(
      runtime.command('chat.send', { pageId: p.id, content: 'blocked' })
    ).rejects.toMatchObject({ code: 'runtime.closing' })
    expect(((await runtime.query('session.get', undefined)) as SessionSnapshot).accountId).toBe(
      session.accountId
    )
    release()
    await resetting
    await switching
    expect(flush).toHaveBeenCalledTimes(2)
  })

  it('[R7] 更新未就绪或安装抛错不会永久关闭命令入口', async () => {
    await expect(runtime.command('app.quitAndInstall', undefined)).rejects.toMatchObject({
      code: 'app.update-not-ready'
    })
    runtime.setUpdater({
      check: async () => ({ available: true }),
      download: async () => undefined,
      quitAndInstall: () => {
        throw new Error('installer failed')
      }
    })
    runtime.setUpdateStatus({ state: 'downloaded', version: '99.0.0' })
    await expect(runtime.command('app.quitAndInstall', undefined)).rejects.toThrow(
      'installer failed'
    )
    await expect(page('still usable')).resolves.toMatchObject({ name: 'still usable' })
  })

  it('[R9] 通用文本任务也会中止并清理', async () => {
    await configure()
    const channels = streams()
    const generated = runtime.command('ai.generateText', { prompt: 'title' })
    const rejected = expect(generated).rejects.toMatchObject({ code: 'chat.aborted' })
    await vi.waitFor(() => expect(channels).toHaveLength(1))
    await runtime.prepareClose()
    await rejected
    runtime.resume()
  })

  it('[R10,R11] 同页准入串行，过期句柄按页停止，null 显式新建根分支', async () => {
    await configure()
    const p = await page(),
      channels = streams()
    await append(p.id, 'old')
    const outcomes = await Promise.allSettled([
      runtime.command('chat.send', { pageId: p.id, content: 'root edit', parentMessageId: null }),
      runtime.command('chat.send', { pageId: p.id, content: 'duplicate' })
    ])
    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1)
    expect(channels).toHaveLength(1)
    expect(
      (await conversation(p.id)).messages.find((message) => message.content === 'root edit')
        ?.parentMessageId
    ).toBeUndefined()
    await runtime.command('chat.stop', { requestId: 'expired', pageId: p.id })
    await internals().chat.abortAll()
    expect(internals().chat.isPageBusy(p.id)).toBe(false)
  })

  it('[R15] 设置修订号拒绝过期写入，磁盘失败保持原设置', async () => {
    const original = (await runtime.query('settings.get', undefined)) as SettingsSnapshot
    await runtime.command('settings.replace', {
      settings: { ...original.settings, fontSize: 'large' },
      baseRevision: original.revision,
      mutationId: 'one'
    })
    await expect(
      runtime.command('settings.replace', {
        settings: original.settings,
        baseRevision: original.revision
      })
    ).rejects.toMatchObject({ code: 'settings.conflict' })
    const spy = vi.spyOn(fsx, 'writeJsonAtomic').mockRejectedValueOnce(new Error('disk full'))
    await expect(
      runtime.command('settings.replace', { settings: original.settings })
    ).rejects.toThrow('disk full')
    spy.mockRestore()
    expect(await runtime.query('settings.get', undefined)).toMatchObject({
      revision: 1,
      settings: { fontSize: 'large' }
    })
  })

  it('[R16] 五项重置写入磁盘，文件夹重置保留对话', async () => {
    const folder = (await runtime.command('folder.create', { name: 'group' })) as Folder
    const p = await page('kept', folder.id)
    await append(p.id, 'm')
    await runtime.command('data.reset', { targets: ['folders'] })
    await runtime.command('session.selectWorkspace', { workspaceId: session.workspaceId! })
    expect(internals().workspace.getTree()).toMatchObject({
      folders: [],
      pages: [expect.objectContaining({ id: p.id, parentFolderId: undefined })]
    })
    expect((await conversation(p.id)).messages).toHaveLength(1)
    await runtime.command('data.reset', {
      targets: ['conversations', 'tabs', 'layout', 'settings']
    })
    await runtime.command('session.selectWorkspace', { workspaceId: session.workspaceId! })
    expect(internals().workspace.pageIds()).toEqual([])
    expect(await runtime.query('settings.get', undefined)).toMatchObject({
      settings: defaultSettings()
    })
    expect(await runtime.query('viewState.get', undefined)).toMatchObject({
      tabs: [],
      layout: { sidebarWidth: 260 }
    })
  })

  it('[R16] 提升对话使用唯一名称，重置也清理遗留队列', async () => {
    const folder = (await runtime.command('folder.create', { name: 'group' })) as Folder
    await page('same')
    await page('same', folder.id)
    await runtime.command('data.reset', { targets: ['folders'] })
    expect(
      internals()
        .workspace.getTree()
        .pages.map((item) => item.name)
        .sort()
    ).toEqual(['same', 'same (1)'])
    const queuePath = new PathResolver(root).queueFile(session.workspacePath!, 'orphan')
    await writeFile(queuePath, '{}')
    await runtime.command('data.reset', { targets: ['conversations'] })
    expect(await readdir(dirname(queuePath))).toEqual([])
  })
})
