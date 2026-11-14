import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  childrenOf,
  DEFAULT_SEARCH_OPTIONS,
  type Folder,
  type Page,
  type PageTree
} from '@shared/domain'
import { createKernel, type KernelFixture } from '../../../tests/helpers/kernel'
import { deferred } from '../../../tests/helpers/deferred'
import { WorkspaceStore } from './WorkspaceStore'
import { WorkspaceTransaction } from './WorkspaceTransaction'
import * as fsx from './fsx'

let f: KernelFixture
beforeEach(async () => {
  f = await createKernel()
})
afterEach(async () => {
  await f.dispose()
})

function normalized(tree: PageTree): unknown[] {
  return [...tree.folders, ...tree.pages].sort((a, b) => a.id.localeCompare(b.id))
}

async function diskSnapshot(): Promise<Record<string, string>> {
  const { workspacePath } = await f.query('session.get', undefined)
  const paths = (await readdir(workspacePath!, { recursive: true }))
    .filter((path) => path.endsWith('.pointer.md') || path === join('.pointer', 'folders.json'))
    .sort()
  return Object.fromEntries(
    await Promise.all(
      paths.map(async (path) => [path, await readFile(join(workspacePath!, path), 'utf8')])
    )
  )
}

async function seed(
  parentFolderId?: string
): Promise<{ a: Page; b: Folder; c: Page; d: Folder; child: Page }> {
  const a = await f.command('page.create', { name: 'a', parentFolderId })
  const b = await f.command('folder.create', { name: 'b', parentFolderId, afterNodeId: a.id })
  const c = await f.command('page.create', { name: 'c', parentFolderId, afterNodeId: b.id })
  const d = await f.command('folder.create', { name: 'd', parentFolderId, afterNodeId: c.id })
  const child = await f.command('page.create', { name: 'child', parentFolderId: d.id })
  await f.command('conversation.append', {
    pageId: child.id,
    draft: { id: 'message', role: 'user', content: '保留内容' }
  })
  return { a, b, c, d, child }
}

describe('单条树移动命令', () => {
  it('内部落盘与移动后的磁盘扫描不会重复广播树变化', async () => {
    const { a, d } = await seed()
    const runtime = f.runtime as unknown as { checkExternalChanges: () => Promise<void> }
    f.events.length = 0
    await runtime.checkExternalChanges()
    expect(f.events.filter((event) => event.type === 'tree.changed')).toEqual([])

    await f.command('tree.move', { nodeId: d.id, targetNodeId: a.id, placement: 'before' })
    await runtime.checkExternalChanges()
    expect(f.events.filter((event) => event.type === 'tree.changed')).toHaveLength(1)
    await f.command('tree.move', { nodeId: a.id, targetNodeId: d.id, placement: 'inside' })
    await runtime.checkExternalChanges()
    expect(f.events.filter((event) => event.type === 'tree.changed')).toHaveLength(2)
    expect(f.events.filter((event) => event.type === 'workspace.externalChange')).toEqual([])

    // 不能为了抑制内部写入的回声而漏掉实际的文件夹元数据变更。
    const tree = await f.query('tree.get', undefined)
    const { workspacePath } = await f.query('session.get', undefined)
    await fsx.writeJsonAtomic(join(workspacePath!, '.pointer', 'folders.json'), {
      folders: tree.folders.map((folder) =>
        folder.id === d.id ? { ...folder, order: 100 } : folder
      )
    })
    await runtime.checkExternalChanges()
    await runtime.checkExternalChanges()
    expect(f.events.filter((event) => event.type === 'tree.changed')).toHaveLength(3)
    expect(f.events.filter((event) => event.type === 'workspace.externalChange')).toHaveLength(1)
    expect(
      (await f.query('tree.get', undefined)).folders.find((node) => node.id === d.id)?.order
    ).toBe(100)
  })

  it('跨目录移动整个文件夹后，子页面路径、内容与搜索结果一致', async () => {
    const { d, child } = await seed()
    const destination = await f.command('folder.create', { name: 'destination' })
    const existing = await f.command('page.create', {
      name: 'existing',
      parentFolderId: destination.id
    })
    f.events.length = 0
    await f.command('tree.move', {
      nodeId: d.id,
      targetNodeId: destination.id,
      placement: 'inside'
    })
    const tree = await f.query('tree.get', undefined)
    expect(childrenOf(tree, destination.id).map((node) => node.id)).toEqual([d.id, existing.id])
    expect((await f.query('conversation.get', { pageId: child.id })).messages[0].content).toBe(
      '保留内容'
    )
    const matches = await f.query('search.workspace', {
      query: '保留内容',
      options: { ...DEFAULT_SEARCH_OPTIONS, folderIds: [destination.id] }
    })
    expect(matches.total).toBe(1)
    const disk = await diskSnapshot()
    expect(Object.keys(disk)).toContain(join('destination', 'd', 'child.pointer.md'))
    expect(Object.keys(disk)).not.toContain(join('d', 'child.pointer.md'))
    expect(f.events.filter((event) => event.type === 'tree.changed')).toHaveLength(1)
    await f.restart()
    expect(normalized(await f.query('tree.get', undefined))).toEqual(normalized(tree))
    expect((await f.query('conversation.get', { pageId: child.id })).messages[0].content).toBe(
      '保留内容'
    )
  })

  it.each([false, true])(
    '同级混合排序在一个事务提交，只广播一次并可重启恢复（子目录=%s）',
    async (nested) => {
      const parent = nested ? await f.command('folder.create', { name: 'parent' }) : undefined
      const { a, b, c, d, child } = await seed(parent?.id)
      await f.command('conversation.append', {
        pageId: a.id,
        draft: { id: 'sorted-message', role: 'user', content: '排序不改正文' }
      })
      const conversation = await f.query('conversation.get', { pageId: a.id })
      // 已有工作区的会话尚未读入缓存时，排序同样必须保留内核计算出的新元数据。
      await f.restart()
      const commit = WorkspaceTransaction.prototype.commit
      let writeCommits = 0
      vi.spyOn(WorkspaceTransaction.prototype, 'commit').mockImplementation(async function (
        this: WorkspaceTransaction
      ) {
        if (this.changed) writeCommits += 1
        await commit.call(this)
      })
      const legacyPageMove = vi.spyOn(WorkspaceStore.prototype, 'movePage')
      const legacyFolderMove = vi.spyOn(WorkspaceStore.prototype, 'moveFolder')
      f.events.length = 0

      await f.command('tree.move', { nodeId: d.id, targetNodeId: a.id, placement: 'before' })
      const after = await f.query('tree.get', undefined)
      expect(childrenOf(after, parent?.id).map((node) => node.id)).toEqual([d.id, a.id, b.id, c.id])
      expect(writeCommits).toBe(1)
      expect(legacyPageMove).not.toHaveBeenCalled()
      expect(legacyFolderMove).not.toHaveBeenCalled()
      expect(f.events.filter((event) => event.type === 'tree.changed')).toEqual([
        expect.objectContaining({ payload: after })
      ])
      expect((await f.query('conversation.get', { pageId: a.id })).messages).toEqual(
        conversation.messages
      )

      vi.restoreAllMocks()
      await f.restart()
      expect(normalized(await f.query('tree.get', undefined))).toEqual(normalized(after))
      expect((await f.query('conversation.get', { pageId: child.id })).messages[0].content).toBe(
        '保留内容'
      )
    }
  )

  it('提交前没有变更事件或可见中间态，后续命令不能插入事务', async () => {
    const { a, b, c, d } = await seed()
    const entered = deferred()
    const release = deferred()
    const commit = WorkspaceTransaction.prototype.commit
    let pause = true
    vi.spyOn(WorkspaceTransaction.prototype, 'commit').mockImplementation(async function (
      this: WorkspaceTransaction
    ) {
      if (this.changed && pause) {
        pause = false
        entered.resolve()
        await release.promise
      }
      await commit.call(this)
    })
    const create = vi.spyOn(WorkspaceStore.prototype, 'createPage')
    f.events.length = 0
    const moving = f.command('tree.move', { nodeId: d.id, targetNodeId: a.id, placement: 'before' })
    await entered.promise
    let readFinished = false
    const reading = f.query('tree.get', undefined).then((tree) => {
      readFinished = true
      return tree
    })
    const later = f.command('page.create', { name: 'later' })
    try {
      expect(f.events.filter((event) => event.type === 'tree.changed')).toEqual([])
      expect(create).not.toHaveBeenCalled()
      expect(readFinished).toBe(false)
    } finally {
      release.resolve()
    }
    await moving
    expect(childrenOf(await reading, undefined).map((node) => node.id)).toEqual([
      d.id,
      a.id,
      b.id,
      c.id
    ])
    const created = await later
    const events = f.events.filter((event) => event.type === 'tree.changed')
    expect(events).toHaveLength(2)
    expect(childrenOf(events[0].payload, undefined).map((node) => node.id)).toEqual([
      d.id,
      a.id,
      b.id,
      c.id
    ])
    expect(events[1].payload.pages.some((node) => node.id === created.id)).toBe(true)
  })

  it.each(['metadata', 'layout', 'commit'] as const)(
    '%s 阶段失败恢复内存、所有文件和重启后的树，且不广播成功',
    async (stage) => {
      const { a, d } = await seed()
      const target = stage === 'layout' ? await f.command('folder.create', { name: 'target' }) : a
      const before = await f.query('tree.get', undefined)
      const disk = await diskSnapshot()
      let failed = false
      let count = 0
      if (stage === 'metadata') {
        const write = fsx.writeTextAtomic
        vi.spyOn(fsx, 'writeTextAtomic').mockImplementation(async (path, text) => {
          if (path.endsWith('.pointer.md') && ++count === 2) {
            failed = true
            throw new Error('故障注入')
          }
          await write(path, text)
        })
      } else if (stage === 'layout') {
        const move = fsx.movePath
        vi.spyOn(fsx, 'movePath').mockImplementation(async (from, to) => {
          if (++count === 2) {
            failed = true
            throw new Error('故障注入')
          }
          await move(from, to)
        })
      } else {
        const write = fsx.writeJsonAtomic
        vi.spyOn(fsx, 'writeJsonAtomic').mockImplementation(async (path, value) => {
          if (
            !failed &&
            path.endsWith('manifest.json') &&
            (value as { committed?: boolean }).committed
          ) {
            failed = true
            throw new Error('故障注入')
          }
          await write(path, value)
        })
      }
      f.events.length = 0
      await expect(
        f.command('tree.move', {
          nodeId: d.id,
          targetNodeId: target.id,
          placement: stage === 'layout' ? 'inside' : 'before'
        })
      ).rejects.toThrow('故障注入')
      expect(failed).toBe(true)
      expect(normalized(await f.query('tree.get', undefined))).toEqual(normalized(before))
      expect(await diskSnapshot()).toEqual(disk)
      expect(f.events.filter((event) => event.type === 'tree.changed')).toEqual([])
      vi.restoreAllMocks()
      await f.restart()
      expect(normalized(await f.query('tree.get', undefined))).toEqual(normalized(before))
      expect(await diskSnapshot()).toEqual(disk)
    }
  )

  it('排队移动按目标的最新父目录解析，不使用提交时的旧位置', async () => {
    const first = await f.command('folder.create', { name: 'first' })
    const second = await f.command('folder.create', { name: 'second' })
    const a = await f.command('page.create', { name: 'a', parentFolderId: first.id })
    const b = await f.command('page.create', { name: 'b', parentFolderId: first.id })
    await Promise.all([
      f.command('tree.move', { nodeId: b.id, targetNodeId: second.id, placement: 'inside' }),
      f.command('tree.move', { nodeId: a.id, targetNodeId: b.id, placement: 'before' })
    ])
    const tree = await f.query('tree.get', undefined)
    expect(childrenOf(tree, first.id)).toEqual([])
    expect(childrenOf(tree, second.id).map((node) => node.id)).toEqual([a.id, b.id])
  })

  it('排队期间目标被删除时拒绝移动，不退化为追加到末尾', async () => {
    const { a, c, d } = await seed()
    const deleting = f.command('page.delete', { pageIds: [c.id] })
    const moving = expect(
      f.command('tree.move', { nodeId: d.id, targetNodeId: c.id, placement: 'after' })
    ).rejects.toMatchObject({ code: 'tree.target-not-found' })
    f.events.length = 0
    await Promise.all([deleting, moving])
    const tree = await f.query('tree.get', undefined)
    expect(childrenOf(tree, undefined)[0].id).toBe(a.id)
    expect(f.events.filter((event) => event.type === 'tree.changed')).toHaveLength(1)
  })

  it.each(['page', 'folder'] as const)(
    '%s 重名时不产生部分移动，确认后在同一事务内重命名并移动',
    async (kind) => {
      const destination = await f.command('folder.create', { name: 'destination' })
      const existing = await f.command('page.create', {
        name: 'same',
        parentFolderId: destination.id
      })
      const source =
        kind === 'page'
          ? await f.command('page.create', { name: 'same' })
          : await f.command('folder.create', { name: 'same' })
      const before = await f.query('tree.get', undefined)
      f.events.length = 0
      const move = { nodeId: source.id, targetNodeId: destination.id, placement: 'inside' as const }
      await expect(f.command('tree.move', move)).rejects.toMatchObject({
        code: 'tree.name-conflict',
        details: { nodeId: source.id, kind, name: 'same', targetFolderId: destination.id }
      })
      expect(await f.query('tree.get', undefined)).toEqual(before)
      expect(f.events.filter((event) => event.type === 'tree.changed')).toEqual([])
      await f.command('tree.move', { ...move, conflictPolicy: 'rename' })
      const tree = await f.query('tree.get', undefined)
      const children = childrenOf(tree, destination.id)
      expect(children.map((node) => node.id)).toEqual([source.id, existing.id])
      expect(children[0].name).not.toBe('same')
      expect(children[1].name).toBe('same')
      expect(f.events.filter((event) => event.type === 'tree.changed')).toHaveLength(1)
      await f.restart()
      expect(normalized(await f.query('tree.get', undefined))).toEqual(normalized(tree))
    }
  )

  it('无变化或非法移动不写文件、不广播，旧工作区命令被拒绝', async () => {
    const { a, b, d, child } = await seed()
    const before = await f.query('tree.get', undefined)
    const writeText = vi.spyOn(fsx, 'writeTextAtomic')
    const writeJson = vi.spyOn(fsx, 'writeJsonAtomic')
    f.events.length = 0
    await f.command('tree.move', { nodeId: a.id, targetNodeId: b.id, placement: 'before' })
    await f.command('tree.move', { nodeId: a.id, targetNodeId: a.id, placement: 'after' })
    for (const [nodeId, targetNodeId, placement, code] of [
      [d.id, child.id, 'before', 'tree.cycle'],
      [d.id, d.id, 'inside', 'tree.cycle'],
      [a.id, child.id, 'inside', 'tree.invalid-target'],
      ['missing', a.id, 'before', 'tree.node-not-found'],
      [a.id, 'missing', 'after', 'tree.target-not-found']
    ] as const) {
      await expect(
        f.command('tree.move', { nodeId, targetNodeId, placement })
      ).rejects.toMatchObject({ code })
    }
    await expect(
      f.runtime.command('tree.move', { nodeId: a.id, targetNodeId: b.id, placement: 'invalid' })
    ).rejects.toMatchObject({ code: 'tree.invalid-move' })
    expect(await f.query('tree.get', undefined)).toEqual(before)
    expect(writeText).not.toHaveBeenCalled()
    expect(writeJson).not.toHaveBeenCalled()
    expect(f.events.filter((event) => event.type === 'tree.changed')).toEqual([])
    const { scopeId } = await f.query('session.get', undefined)
    vi.restoreAllMocks()
    await f.restart()
    await expect(
      f.runtime.command(
        'tree.move',
        { nodeId: d.id, targetNodeId: a.id, placement: 'before' },
        scopeId
      )
    ).rejects.toMatchObject({ code: 'runtime.stale-scope' })
    expect(normalized(await f.query('tree.get', undefined))).toEqual(normalized(before))
  })
})
