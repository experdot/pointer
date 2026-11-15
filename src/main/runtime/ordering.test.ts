import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { childrenOf, parsePageMetadata, validateOrderKeys } from '@shared/domain'
import { createKernel, type KernelFixture } from '../../../tests/helpers/kernel'
import { IndexDb } from './IndexDb'
import { WorkspaceStore } from './WorkspaceStore'
import * as fsx from './fsx'

let f: KernelFixture
beforeEach(async () => {
  f = await createKernel()
})
afterEach(async () => {
  await f.dispose()
})

describe('字符串排序持久化预算', () => {
  it('新建和插入只写新页面；同级移动只写目标元数据且不改正文或全文索引', async () => {
    const a = await f.command('page.create', { name: 'a' })
    const b = await f.command('page.create', { name: 'b', afterNodeId: a.id })
    const folder = await f.command('folder.create', { name: 'folder', afterNodeId: b.id })
    await f.command('conversation.append', {
      pageId: b.id,
      draft: { id: 'message', role: 'user', content: '正文\r\n\n $& $1 中文 😀' }
    })
    const root = (await f.query('session.get', undefined)).workspacePath!
    const bPath = join(root, 'b.pointer.md')
    const beforeBytes = await readFile(bPath)
    await f.restart()
    const write = vi.spyOn(fsx, 'writeTextAtomic')
    const json = vi.spyOn(fsx, 'writeJsonAtomic')
    const move = vi.spyOn(fsx, 'movePath')
    const fts = vi.spyOn(IndexDb.prototype, 'replaceMessages')
    const pageWrites = (): string[] =>
      write.mock.calls.map(([path]) => path).filter((path) => path.endsWith('.pointer.md'))
    const initial = await f.query('tree.get', undefined)
    for (const [name, afterNodeId] of [
      ['head', undefined],
      ['middle', a.id],
      ['tail', folder.id]
    ] as const) {
      write.mockClear()
      const page = await f.command('page.create', { name, afterNodeId })
      expect(pageWrites()).toEqual([join(root, `${name}.pointer.md`)])
      expect(
        (await f.query('tree.get', undefined)).pages.filter((p) =>
          initial.pages.some((n) => n.id === p.id)
        )
      ).toEqual(initial.pages)
      expect(page.orderKey).toBeTruthy()
    }
    write.mockClear()
    fts.mockClear()
    move.mockClear()
    await f.command('tree.move', { nodeId: b.id, targetNodeId: a.id, placement: 'before' })
    expect(pageWrites()).toEqual([bPath])
    expect(fts).not.toHaveBeenCalled()
    expect(move).not.toHaveBeenCalled()
    const body = (bytes: Buffer): Buffer =>
      bytes.subarray(bytes.indexOf(Buffer.from('</pointer-page>')) + '</pointer-page>'.length)
    expect(body(await readFile(bPath))).toEqual(body(beforeBytes))
    write.mockClear()
    json.mockClear()
    await f.command('tree.move', { nodeId: folder.id, targetNodeId: b.id, placement: 'before' })
    expect(pageWrites()).toEqual([])
    expect(json.mock.calls.filter(([path]) => path.endsWith('folders.json'))).toHaveLength(1)
    expect(move).not.toHaveBeenCalled()
    write.mockClear()
    json.mockClear()
    f.events.length = 0
    await f.command('tree.move', { nodeId: folder.id, targetNodeId: b.id, placement: 'before' })
    expect(write).not.toHaveBeenCalled()
    expect(json).not.toHaveBeenCalled()
    expect(f.events).toEqual([])
    const order = childrenOf(await f.query('tree.get', undefined), undefined).map((n) => [
      n.id,
      n.orderKey
    ])
    vi.restoreAllMocks()
    await f.restart()
    expect(
      childrenOf(await f.query('tree.get', undefined), undefined).map((n) => [n.id, n.orderKey])
    ).toEqual(order)
  })

  it('外部重复键按创建时间和 ID 修复，未冲突节点不写盘', async () => {
    const a = await f.command('page.create', { name: 'a' })
    const b = await f.command('page.create', { name: 'b', afterNodeId: a.id })
    const c = await f.command('page.create', { name: 'c', afterNodeId: b.id })
    const root = (await f.query('session.get', undefined)).workspacePath!
    const bPath = join(root, 'b.pointer.md')
    const original = await readFile(bPath, 'utf8')
    await writeFile(
      bPath,
      original.replace(`<orderKey>${b.orderKey}</orderKey>`, `<orderKey>${a.orderKey}</orderKey>`)
    )
    const write = vi.spyOn(fsx, 'writeTextAtomic')
    const ws = (f.runtime as unknown as { workspace: WorkspaceStore }).workspace
    await ws.write(() => ws.reconcileExternalChanges())
    const tree = await f.query('tree.get', undefined)
    expect(childrenOf(tree, undefined).map((n) => n.id)).toEqual([a.id, b.id, c.id])
    expect(validateOrderKeys(tree.pages)).toEqual([])
    expect(
      write.mock.calls.filter(([path]) => path.endsWith('.pointer.md')).map(([path]) => path)
    ).toEqual([bPath])
    const parsed = parsePageMetadata(await readFile(bPath, 'utf8'))
    expect(parsed.ok).toBe(true)
  })

  it.each(['legacy', 'missing', 'invalid'])(
    '外部页面的 %s 排序格式明确拒绝，事务保持原树',
    async (kind) => {
      await f.command('page.create', { name: 'a' })
      const root = (await f.query('session.get', undefined)).workspacePath!
      const path = join(root, 'a.pointer.md')
      const text = await readFile(path, 'utf8')
      const before = await f.query('tree.get', undefined)
      await writeFile(
        path,
        kind === 'legacy'
          ? text.replace('version="3"', 'version="2"')
          : text.replace(
              /<orderKey>.*?<\/orderKey>/,
              kind === 'missing' ? '<order>0</order>' : '<orderKey>!</orderKey>'
            )
      )
      const ws = (f.runtime as unknown as { workspace: WorkspaceStore }).workspace
      await expect(ws.write(() => ws.reconcileExternalChanges())).rejects.toMatchObject({
        code: 'page.parse-failed'
      })
      expect(await f.query('tree.get', undefined)).toEqual(before)
      await writeFile(path, text)
    }
  )

  it('设置拒绝旧排序值，磁盘重复键只修复重复组', async () => {
    const settings = await f.configure()
    const first = settings.llmConfigs.items[0]
    const legacy = {
      ...settings,
      llmConfigs: { folders: [], items: [{ ...first, order: 0, orderKey: undefined }] }
    }
    await expect(
      f.command('settings.replace', { settings: legacy as never })
    ).rejects.toMatchObject({ code: 'settings.invalid-order-key' })
    const session = await f.query('session.get', undefined)
    const paths = await fsx.walkFiles(f.root, { include: (name) => name === 'settings.json' })
    expect(session.accountId).toBeTruthy()
    const path = paths[0].absolutePath
    await writeFile(
      path,
      JSON.stringify({
        ...settings,
        llmConfigs: {
          folders: [],
          items: [
            first,
            { ...first, id: 'other', createdAt: 2 },
            { ...first, id: 'last', orderKey: 'a2', createdAt: 3 }
          ]
        }
      })
    )
    await f.restart()
    const next = (await f.query('settings.get', undefined)).settings.llmConfigs.items
    expect(validateOrderKeys(next)).toEqual([])
    expect(next.find((n) => n.id === first.id)!.orderKey).toBe(first.orderKey)
    expect(next.find((n) => n.id === 'last')!.orderKey).toBe('a2')
    expect(JSON.parse(await readFile(path, 'utf8')).llmConfigs.items).toEqual(next)
  })

  it('文件夹元数据拒绝旧数字排序字段且不覆盖原内存树', async () => {
    const folder = await f.command('folder.create', { name: 'folder' })
    const before = await f.query('tree.get', undefined)
    const root = (await f.query('session.get', undefined)).workspacePath!
    const path = join(root, '.pointer', 'folders.json')
    const original = await readFile(path)
    const legacy = { ...folder, orderKey: undefined, order: 0 }
    await writeFile(path, JSON.stringify({ folders: [legacy] }))
    const ws = (f.runtime as unknown as { workspace: WorkspaceStore }).workspace
    await expect(ws.write(() => ws.reconcileExternalChanges())).rejects.toMatchObject({
      code: 'tree.invalid-order-key'
    })
    expect(await f.query('tree.get', undefined)).toEqual(before)
    await writeFile(path, original)
  })
})
