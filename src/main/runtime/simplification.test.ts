import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFile, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DEFAULT_SEARCH_OPTIONS, childrenOf } from '@shared/domain'
import { createKernel, controlledProvider, type KernelFixture } from '../../../tests/helpers/kernel'
import type { WorkspaceStore } from './WorkspaceStore'
import { WorkspaceTransaction } from './WorkspaceTransaction'
import * as fsx from './fsx'

let f: KernelFixture
beforeEach(async () => {
  f = await createKernel()
})
afterEach(async () => {
  await f.dispose()
})

function internals(): {
  workspace: WorkspaceStore
  checkExternalChanges: () => Promise<void>
  stopWatcher: () => void
} {
  return f.runtime as unknown as ReturnType<typeof internals>
}

describe('读取、监听与事务边界', () => {
  it.each([false, true])('外部修改后先读取（随后改名=%s），索引仍能追上正文', async (rename) => {
    const page = await f.command('page.create', { name: 'before' })
    await f.command('conversation.append', {
      pageId: page.id,
      draft: { id: 'm', role: 'user', content: 'old-needle' }
    })
    const { workspace, stopWatcher } = internals()
    stopWatcher.call(f.runtime)
    const file = join(workspace.path, workspace.relativePathOf(page.id)!)
    await writeFile(file, (await readFile(file, 'utf8')).replace('old-needle', 'new-needle'))
    const later = new Date(Date.now() + 2000)
    await utimes(file, later, later)
    expect((await f.query('conversation.get', { pageId: page.id })).messages[0].content).toBe(
      'new-needle'
    )
    if (rename) await f.command('page.update', { pageId: page.id, patch: { name: 'after' } })
    const scan = vi.spyOn(fsx, 'walkFiles')
    await internals().checkExternalChanges()
    expect(scan).toHaveBeenCalledOnce()
    for (const [query, total] of [
      ['new-needle', 1],
      ['old-needle', 0]
    ] as const) {
      expect(
        await f.query('search.workspace', { query, options: DEFAULT_SEARCH_OPTIONS })
      ).toMatchObject({ total })
    }
    await f.restart()
    expect((await f.query('conversation.get', { pageId: page.id })).messages[0].content).toBe(
      'new-needle'
    )
  })

  it('读取与搜索不提交写事务，私有视图写入不引起目录扫描', async () => {
    const page = await f.command('page.create', { name: 'page' })
    await f.restart()
    const scan = vi.spyOn(fsx, 'walkFiles')
    const commit = vi.spyOn(WorkspaceTransaction.prototype, 'commit')
    await f.query('tree.get', undefined)
    await f.query('conversation.get', { pageId: page.id })
    await f.query('queue.get', { pageId: page.id })
    const viewState = await f.query('viewState.get', undefined)
    await f.query('search.workspace', { query: 'abc', options: DEFAULT_SEARCH_OPTIONS })
    expect(commit).not.toHaveBeenCalled()
    await f.command('viewState.replace', { viewState })
    await new Promise((resolve) => setTimeout(resolve, 800))
    expect(scan).not.toHaveBeenCalled()
  })

  it('拒绝事务外、只读上下文和嵌套写入；并发调用不能借用正在运行的事务', async () => {
    const { workspace } = internals()
    const create = (): ReturnType<WorkspaceStore['createPage']> =>
      workspace.createPage({ name: '非法写入' }, Date.now())
    await expect(create()).rejects.toMatchObject({ code: 'workspace.transaction-required' })
    await expect(workspace.read(create)).rejects.toMatchObject({
      code: 'workspace.transaction-required'
    })
    await expect(workspace.write(() => workspace.write(create))).rejects.toMatchObject({
      code: 'workspace.nested-operation'
    })
    let release!: () => void
    let entered!: () => void
    const ready = new Promise<void>((resolve) => {
      entered = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const writing = workspace.write(async () => {
      entered()
      await gate
    })
    await ready
    try {
      await expect(create()).rejects.toMatchObject({ code: 'workspace.transaction-required' })
    } finally {
      release()
      await writing
    }
    expect((await f.query('tree.get', undefined)).pages).toEqual([])
    await expect(f.command('page.create', { name: '正常写入' })).resolves.toMatchObject({
      name: '正常写入'
    })
  })

  it('已结束事务遗留的异步任务不能借用下一次写事务', async () => {
    const { workspace } = internals()
    let resume!: () => void
    const gate = new Promise<void>((resolve) => {
      resume = resolve
    })
    let detached!: Promise<unknown>
    await workspace.write(() => {
      detached = gate.then(() => workspace.createPage({ name: '迟到的写入' }, Date.now()))
    })
    const rejected = expect(detached).rejects.toMatchObject({
      code: 'workspace.transaction-required'
    })
    await workspace.write(async () => {
      resume()
      await rejected
    })
    expect((await f.query('tree.get', undefined)).pages).toEqual([])
  })
})

describe('会话选择与生成', () => {
  it('账号与工作区改名不会 flush 或打断流式回答', async () => {
    await f.configure()
    const provider = controlledProvider()
    const page = await f.command('page.create', {})
    const session = await f.query('session.get', undefined)
    const flush = vi.fn(async () => undefined)
    f.runtime.setFlushHandler(flush)
    const request = await f.command('chat.send', { pageId: page.id, content: 'question' })
    await vi.waitFor(() => expect(provider.requests).toHaveLength(1))
    await f.command('account.update', {
      accountId: session.accountId!,
      patch: { name: 'renamed account' }
    })
    await f.command('workspace.rename', {
      workspaceId: session.workspaceId!,
      name: 'renamed workspace'
    })
    expect(flush).not.toHaveBeenCalled()
    expect(provider.requests[0].options?.signal?.aborted).toBe(false)
    expect(f.runtime.getScopeId()).toBe(session.scopeId)
    provider.requests[0].delta('完整回答')
    provider.requests[0].finish()
    await f.terminal(request.requestId)
    expect((await f.query('conversation.get', { pageId: page.id })).messages.at(-1)?.content).toBe(
      '完整回答'
    )
  })

  it('启动与切换后按账号和工作区记录恢复选择，不生成 session 文件或版本字段', async () => {
    const original = await f.query('session.get', undefined)
    const accountsPath = join(f.root, 'accounts.json')
    const sessionPath = join(f.root, 'session.json')
    expect(JSON.parse(await readFile(accountsPath, 'utf8'))).toEqual({
      accounts: await f.query('accounts.list', undefined),
      currentAccountId: original.accountId
    })
    expect(await fsx.pathExists(sessionPath)).toBe(false)
    const second = await f.command('account.create', { name: 'second' })
    const secondDefault = await f.query('session.get', undefined)
    const secondWorkspace = await f.command('workspace.create', {
      name: 'chosen',
      type: 'custom',
      path: join(f.root, 'chosen')
    })
    await f.command('session.selectWorkspace', { workspaceId: secondDefault.workspaceId! })
    await f.command('session.selectWorkspace', { workspaceId: secondWorkspace.id })
    await f.restart()
    expect(await f.query('session.get', undefined)).toMatchObject({
      accountId: second.id,
      workspaceId: secondWorkspace.id
    })
    await f.command('session.selectAccount', { accountId: original.accountId! })
    await f.restart()
    expect(await f.query('session.get', undefined)).toMatchObject({
      accountId: original.accountId,
      workspaceId: original.workspaceId
    })
    await f.command('session.selectAccount', { accountId: second.id })
    expect((await f.query('session.get', undefined)).workspaceId).toBe(secondWorkspace.id)
    expect(JSON.parse(await readFile(accountsPath, 'utf8'))).toEqual({
      accounts: await f.query('accounts.list', undefined),
      currentAccountId: second.id
    })
    expect(await fsx.pathExists(sessionPath)).toBe(false)
  })

  it.each(['conflicting', 'malformed'] as const)(
    '遗留 session 文件为 %s 时不影响启动，也不会被修改或删除',
    async (content) => {
      const original = await f.query('session.get', undefined)
      const second = await f.command('account.create', { name: 'second' })
      const secondSession = await f.query('session.get', undefined)
      await f.command('session.selectAccount', { accountId: original.accountId! })
      await writeFile(
        join(f.root, 'accounts.json'),
        JSON.stringify({
          accounts: await f.query('accounts.list', undefined),
          currentAccountId: original.accountId
        })
      )
      const sessionPath = join(f.root, 'session.json')
      const legacy =
        content === 'malformed'
          ? '{invalid'
          : JSON.stringify({ accountId: second.id, workspaceId: secondSession.workspaceId })
      await writeFile(sessionPath, legacy)
      await f.restart()
      expect(await f.query('session.get', undefined)).toMatchObject({
        accountId: original.accountId,
        workspaceId: original.workspaceId
      })
      expect(await readFile(sessionPath, 'utf8')).toBe(legacy)
    }
  )

  it('已有账号文件的 version 字段被忽略，正常保存时仅写当前字段', async () => {
    const before = await f.query('session.get', undefined)
    const accountsPath = join(f.root, 'accounts.json')
    const accounts = {
      accounts: await f.query('accounts.list', undefined),
      currentAccountId: before.accountId
    }
    await writeFile(accountsPath, JSON.stringify({ ...accounts, version: 2 }))
    await f.restart()
    expect(await f.query('session.get', undefined)).toMatchObject({
      accountId: before.accountId,
      workspaceId: before.workspaceId
    })
    expect(JSON.parse(await readFile(accountsPath, 'utf8'))).toEqual(accounts)
  })
})

describe('统一命令行为', () => {
  it('新建时拒绝跨目录的参照项，避免命名检查和最终父目录不一致', async () => {
    const parent = await f.command('folder.create', { name: 'parent' })
    const reference = await f.command('page.create', {
      name: 'reference',
      parentFolderId: parent.id
    })
    const before = await f.query('tree.get', undefined)
    await expect(
      f.command('page.create', { name: 'same', afterNodeId: reference.id })
    ).rejects.toMatchObject({ code: 'tree.invalid-target' })
    expect(await f.query('tree.get', undefined)).toEqual(before)
    await f.restart()
    expect(await f.query('tree.get', undefined)).toEqual(before)
  })

  it('移至根目录末尾也执行重名校验、自动命名并在重启后保持顺序', async () => {
    const parent = await f.command('folder.create', { name: 'parent' })
    const existing = await f.command('page.create', { name: 'same' })
    const source = await f.command('folder.create', { name: 'same', parentFolderId: parent.id })
    const move = { nodeId: source.id, placement: 'end' as const }
    await expect(f.command('tree.move', move)).rejects.toMatchObject({ code: 'tree.name-conflict' })
    await f.command('tree.move', { ...move, conflictPolicy: 'rename' })
    const nodes = childrenOf(await f.query('tree.get', undefined), undefined)
    expect(nodes.at(-1)?.id).toBe(source.id)
    expect(nodes.at(-1)?.name).not.toBe(existing.name)
    await f.restart()
    expect(childrenOf(await f.query('tree.get', undefined), undefined)).toEqual(nodes)
  })

  it('topic.create 返回 void，提交的话题可查询并在重启后保留', async () => {
    const page = await f.command('page.create', {})
    await f.command('conversation.append', {
      pageId: page.id,
      draft: { id: 'm', role: 'user', content: 'topic' }
    })
    expect(
      await f.command('topic.create', {
        pageId: page.id,
        topic: { id: 't', name: 'topic', startMessageId: 'm' }
      })
    ).toBeUndefined()
    await f.restart()
    expect((await f.query('conversation.get', { pageId: page.id })).topics).toEqual([
      expect.objectContaining({ name: 'topic', startMessageId: 'm' })
    ])
  })
})
