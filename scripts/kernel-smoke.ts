/**
 * 内核冒烟测试
 *
 * 在临时目录中启动完整内核，验证查询/命令/事件链路（不涉及界面与 IPC）。
 * 运行：pnpm smoke:kernel
 */

import { app } from 'electron'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { RuntimeEvent } from '../src/shared/contracts'
import { defaultSettings } from '../src/shared/domain'
import { RuntimeCore, type RuntimeHost } from '../src/main/runtime'
import { walkFiles } from '../src/main/runtime/fsx'

const host: RuntimeHost = {
  getVersion: () => 'smoke',
  saveFile: async () => ({}),
  openTextFile: async () => null,
  pickDirectory: async () => null,
  pickImages: async () => [],
  openInFileManager: async () => undefined
}

const checks: Array<{ name: string; ok: boolean; detail?: string }> = []

function check(name: string, ok: boolean, detail?: string): void {
  checks.push({ name, ok, detail })
}

async function run(): Promise<void> {
  const appDataPath = await mkdtemp(join(tmpdir(), 'pointer-kernel-'))
  const runtime = new RuntimeCore({ appDataPath, host })
  const events: RuntimeEvent[] = []
  runtime.subscribe((event) => events.push(event))

  try {
    await runtime.init()

    const accounts = (await runtime.query('accounts.list', undefined)) as Array<{ id: string }>
    check('初始化后存在默认账户', accounts.length === 1)

    const session = (await runtime.query('session.get', undefined)) as { workspaceId: string }
    check('默认工作区已打开', Boolean(session.workspaceId), session.workspaceId ?? '')

    // 页面与文件夹
    const folder = (await runtime.command('folder.create', { name: '工作' })) as { id: string }
    const page = (await runtime.command('page.create', {
      name: '首个对话',
      parentFolderId: folder.id
    })) as { id: string; name: string }
    check('创建文件夹与页面', Boolean(folder.id && page.id), page.name)

    const tree = (await runtime.query('tree.get', undefined)) as {
      folders: unknown[]
      pages: unknown[]
    }
    check('页面树包含新建节点', tree.folders.length === 1 && tree.pages.length === 1)

    // 回归：工具栏「新建」以选中项为参照，插入到同一层级的它之后
    const sibling = (await runtime.command('page.create', {
      name: '第二个对话',
      parentFolderId: folder.id,
      afterNodeId: page.id
    })) as { id: string }

    const treeAfterInsert = (await runtime.query('tree.get', undefined)) as {
      pages: Array<{ id: string; name: string; parentFolderId?: string; order: number }>
    }
    const folderPages = treeAfterInsert.pages
      .filter((item) => item.parentFolderId === folder.id)
      .sort((a, b) => a.order - b.order)
    check(
      '新建页面插入到选中项之后且同层',
      folderPages.map((item) => item.name).join(',') === '首个对话,第二个对话',
      folderPages.map((item) => `${item.name}@${item.order}`).join(' | ')
    )

    // 回归：没有参照项时新建内容插到最前面（旧实现的 prepareInsertPosition 语义）
    const firstRoot = (await runtime.command('page.create', { name: '根一' })) as { id: string }
    const secondRoot = (await runtime.command('page.create', { name: '根二' })) as { id: string }
    const treeTop = (await runtime.query('tree.get', undefined)) as {
      pages: Array<{ id: string; name: string; parentFolderId?: string; order: number }>
    }
    const rootOrder = treeTop.pages
      .filter((item) => !item.parentFolderId)
      .sort((a, b) => a.order - b.order)
      .map((item) => item.name)
    check('无参照时新建插到最前面', rootOrder[0] === '根二', rootOrder.join(' | '))
    await runtime.command('page.delete', { pageIds: [firstRoot.id, secondRoot.id] })

    // 清理，保持后续断言的数量假设
    await runtime.command('page.delete', { pageIds: [sibling.id] })

    // 回归 R2：星标/改名必须落盘，并且重新打开工作区（等价于目录重扫）后不被磁盘状态打回
    await runtime.command('page.update', { pageId: page.id, patch: { starred: true } })
    await runtime.command('page.update', { pageId: page.id, patch: { name: '改名后的对话' } })

    const touched = await walkFiles(session.workspacePath, {
      include: (fileName) => fileName === '改名后的对话.pointer.md'
    })
    const metadataText = touched[0] ? await readFile(touched[0].absolutePath, 'utf8') : ''
    check(
      '星标与改名写入了页面文件',
      metadataText.includes('<starred>true</starred>') &&
        metadataText.includes('<name>改名后的对话</name>'),
      touched[0]?.relativePath ?? '(未找到文件)'
    )

    await runtime.command('workspace.create', {
      name: '重扫验证',
      type: 'custom',
      path: join(appDataPath, 'rescan-workspace')
    })
    await runtime.command('session.selectWorkspace', { workspaceId: session.workspaceId })

    const afterRescan = (await runtime.query('tree.get', undefined)) as {
      pages: Array<{ id: string; name: string; starred?: boolean }>
    }
    const rescanPage = afterRescan.pages.find((item) => item.id === page.id)
    check(
      '重扫后星标与名称保持不变',
      rescanPage?.starred === true && rescanPage?.name === '改名后的对话',
      JSON.stringify(rescanPage)
    )

    // 会话内容
    await runtime.command('conversation.append', {
      pageId: page.id,
      draft: { id: 'm1', role: 'user', content: '关于架构分层的讨论' }
    })
    await runtime.command('conversation.append', {
      pageId: page.id,
      draft: {
        id: 'm2',
        role: 'assistant',
        content: '分三层：领域、内核、展示',
        parentMessageId: 'm1'
      }
    })

    const conversation = (await runtime.query('conversation.get', { pageId: page.id })) as {
      messages: Array<{ id: string; branchIndex: number }>
      leafMessageId?: string
    }
    check(
      '会话消息与分支序号正确',
      conversation.messages.length === 2 && conversation.leafMessageId === 'm2',
      JSON.stringify(conversation.messages.map((m) => [m.id, m.branchIndex]))
    )

    // 磁盘文件确实是 Markdown
    const files = await runtime.command('workspace.openInFileManager', {})
    check('打开文件管理器命令可用', files === undefined)

    // 检索
    const search = (await runtime.query('search.workspace', {
      query: '架构',
      options: {
        matchCase: false,
        useRegex: false,
        matchWholeWord: false,
        roleFilter: 'all',
        timeRange: 'all'
      }
    })) as { total: number; groups: Array<{ pageTitle: string }> }
    check('全局检索命中索引内容', search.total === 1, JSON.stringify(search.groups))

    // 设置与密钥
    const settings = defaultSettings()
    await runtime.command('settings.replace', {
      settings: {
        ...settings,
        llmConfigs: {
          items: [
            {
              id: 'llm-1',
              name: 'Local',
              order: 0,
              createdAt: Date.now(),
              baseUrl: 'http://127.0.0.1:1/v1',
              modelName: 'test'
            }
          ],
          folders: []
        },
        defaultLLMId: 'llm-1'
      }
    })
    const stored = (await runtime.query('settings.get', undefined)) as {
      llmConfigs: { items: Array<{ id: string; hasApiKey?: boolean }> }
    }
    check('设置写回并带密钥标记', stored.llmConfigs.items[0]?.hasApiKey === false)

    // 回归：半填状态（还没填 baseUrl/modelName）的配置必须能保存，
    // 否则"新建配置 → 刷新后消失"
    await runtime.command('settings.replace', {
      settings: {
        ...settings,
        llmConfigs: {
          items: [
            ...stored.llmConfigs.items.map((item) => ({
              ...(item as unknown as Record<string, unknown>),
              baseUrl: 'http://127.0.0.1:1/v1',
              modelName: 'test'
            })),
            {
              id: 'llm-draft',
              kind: 'item',
              name: '未填完的配置',
              baseUrl: '',
              modelName: '',
              order: 1,
              createdAt: Date.now()
            }
          ] as never,
          folders: []
        }
      }
    })
    const afterDraft = (await runtime.query('settings.get', undefined)) as {
      llmConfigs: { items: Array<{ id: string; name: string }> }
    }
    check(
      '半填状态的配置也能保存',
      afterDraft.llmConfigs.items.some((item) => item.name === '未填完的配置'),
      afterDraft.llmConfigs.items.map((item) => item.name).join(',')
    )

    // 展示层状态
    const viewState = (await runtime.query('viewState.get', undefined)) as {
      layout: { activePanel: string }
    }
    check('展示层状态有默认值', viewState.layout.activePanel === 'explorer')

    // 消息队列
    await runtime.command('queue.add', { pageId: page.id, content: '队列消息' })
    const queue = (await runtime.query('queue.get', { pageId: page.id })) as { items: unknown[] }
    check('消息队列写入成功', queue.items.length === 1)

    // 第三方导入
    const imported = (await runtime.command('library.import', {
      source: 'deepseek',
      payload: JSON.stringify([
        {
          id: 'imported-1',
          title: '导入的对话',
          inserted_at: '2024-01-01T00:00:00.000Z',
          mapping: {
            root: { id: 'root', parent: null, children: ['i1'], message: null },
            i1: {
              id: 'i1',
              parent: 'root',
              children: [],
              message: { fragments: [{ type: 'REQUEST', content: '导入内容' }] }
            }
          }
        }
      ]),
      folderName: '导入'
    })) as { importedPages: number; importedMessages: number }
    check(
      '导入第三方数据生成页面',
      imported.importedPages === 1 && imported.importedMessages === 1,
      JSON.stringify(imported)
    )

    // 事件流
    const types = new Set(events.map((event) => event.type))
    check('事件流包含会话与树变更', types.has('session.changed') && types.has('tree.changed'))
    check('事件流包含消息增量', types.has('conversation.message'))

    // 磁盘产物：页面必须是可读的 Markdown
    const workspacePath = (session as { workspacePath: string }).workspacePath
    const pageFiles = await walkFiles(workspacePath, {
      include: (fileName) => fileName.endsWith('.pointer.md')
    })
    const content = pageFiles[0] ? await readFile(pageFiles[0].absolutePath, 'utf8') : ''
    check(
      '页面落盘为可读 Markdown',
      pageFiles.length === 2 && content.includes('<pointer-page version="2">'),
      pageFiles.map((file) => file.relativePath).join(', ')
    )
    check(
      '目录结构与文件夹一致',
      pageFiles.some((file) => file.relativePath.startsWith('工作/')),
      pageFiles.map((file) => file.relativePath).join(', ')
    )

    // 工作区切换
    const secondPath = join(appDataPath, 'second-workspace')
    const created = (await runtime.command('workspace.create', {
      name: '第二工作区',
      type: 'custom',
      path: secondPath
    })) as { id: string }
    const second = (await runtime.query('tree.get', undefined)) as { pages: unknown[] }
    check('切换到新工作区后页面为空', second.pages.length === 0, created.id)

    const workspaces = (await runtime.query('workspaces.list', undefined)) as unknown[]
    check('工作区列表包含三个工作区', workspaces.length === 3, `count=${workspaces.length}`)
  } finally {
    runtime.dispose()
    await rm(appDataPath, { recursive: true, force: true }).catch(() => undefined)
  }
}

app.whenReady().then(async () => {
  let failed = false

  try {
    await run()
  } catch (error) {
    console.error('SMOKE_FAIL', error)
    failed = true
  }

  for (const entry of checks) {
    console.log(
      `${entry.ok ? 'PASS' : 'FAIL'} ${entry.name}${entry.detail ? ` :: ${entry.detail}` : ''}`
    )
    if (!entry.ok) failed = true
  }

  console.log(
    `SMOKE_${failed ? 'FAIL' : 'PASS'} ${checks.filter((c) => c.ok).length}/${checks.length}`
  )
  app.exit(failed ? 1 : 0)
})
