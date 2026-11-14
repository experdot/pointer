import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createKernel, type KernelFixture } from '../../../tests/helpers/kernel'
import { RuntimeCore } from './RuntimeCore'
import * as fsx from './fsx'

let f: KernelFixture
beforeEach(async () => {
  f = await createKernel()
})
afterEach(async () => {
  await f.dispose()
})

describe('工作区生命周期', () => {
  it.each(['create', 'rename', 'delete'] as const)(
    '注册文件写入失败时 %s 不提前发布内存或身份变更',
    async (action) => {
      const original = await f.query('session.get', undefined)
      const workspace = await f.command('workspace.create', {
        name: '保留名称',
        type: 'custom',
        path: join(f.root, 'registry-target')
      })
      await f.command('session.selectWorkspace', { workspaceId: original.workspaceId! })
      const before = await f.query('workspaces.list', undefined)
      const identity = await readFile(join(workspace.path, '.pointer/workspace.json'), 'utf8')
      const write = fsx.writeJsonAtomic
      vi.spyOn(fsx, 'writeJsonAtomic').mockImplementation(async (path, value) => {
        if (path.endsWith('workspaces.json')) throw new Error('注册不可写')
        return write(path, value)
      })
      const operation =
        action === 'create'
          ? f.command('workspace.create', {
              name: '不能注册',
              type: 'custom',
              path: join(f.root, 'registry-new')
            })
          : action === 'rename'
            ? f.command('workspace.rename', { workspaceId: workspace.id, name: '不能改名' })
            : f.command('workspace.delete', { workspaceId: workspace.id })
      await expect(operation).rejects.toThrow('注册不可写')
      expect(await f.query('workspaces.list', undefined)).toEqual(before)
      expect(await readFile(join(workspace.path, '.pointer/workspace.json'), 'utf8')).toBe(identity)
      vi.restoreAllMocks()
      await f.restart()
      expect(await f.query('workspaces.list', undefined)).toEqual(before)
    }
  )

  it('新工作区身份文件写入失败和初始化失败均不留下幽灵注册项', async () => {
    const before = await f.query('workspaces.list', undefined)
    const write = fsx.writeJsonAtomic
    vi.spyOn(fsx, 'writeJsonAtomic').mockImplementation(async (path, value) => {
      if (path.endsWith('workspace.json')) throw new Error('身份不可写')
      return write(path, value)
    })
    await expect(
      f.command('workspace.create', {
        name: '失败',
        type: 'custom',
        path: join(f.root, 'identity-error')
      })
    ).rejects.toThrow('身份不可写')
    expect(await f.query('workspaces.list', undefined)).toEqual(before)
    vi.restoreAllMocks()
    const target = join(f.root, 'broken-new')
    await mkdir(join(target, '.pointer'), { recursive: true })
    await writeFile(join(target, '.pointer/folders.json'), '{')
    await expect(
      f.command('workspace.create', { name: '损坏', type: 'custom', path: target })
    ).rejects.toThrow()
    expect(await f.query('workspaces.list', undefined)).toEqual(before)
  })

  it.each(['workspaces.json', 'accounts.json'])(
    '切换时 %s 写入失败，原会话选择、数据与重启结果保持一致',
    async (file) => {
      const original = await f.query('session.get', undefined)
      const page = await f.command('page.create', { name: '仍然属于原工作区' })
      const target = await f.command('workspace.create', {
        name: '待切换',
        type: 'custom',
        path: join(f.root, 'candidate')
      })
      await f.command('session.selectWorkspace', { workspaceId: original.workspaceId! })
      const before = await f.query('session.get', undefined)
      const write = fsx.writeJsonAtomic
      let failed = false
      vi.spyOn(fsx, 'writeJsonAtomic').mockImplementation(async (path, value) => {
        if (!failed && path.endsWith(file)) {
          failed = true
          throw new Error('选择保存失败')
        }
        await write(path, value)
      })
      await expect(
        f.command('session.selectWorkspace', { workspaceId: target.id })
      ).rejects.toThrow('选择保存失败')
      expect(await f.query('session.get', undefined)).toEqual(before)
      expect((await f.query('tree.get', undefined)).pages[0].id).toBe(page.id)
      await f.command('conversation.append', {
        pageId: page.id,
        draft: { id: 'kept', role: 'user', content: '失败后仍可继续工作' }
      })
      await f.restart()
      expect((await f.query('session.get', undefined)).workspaceId).toBe(original.workspaceId)
      expect((await f.query('conversation.get', { pageId: page.id })).messages[0].content).toBe(
        '失败后仍可继续工作'
      )
    }
  )

  it('新账户初始化失败撤销账户注册并保留当前会话，之后可以重试', async () => {
    const before = await f.query('session.get', undefined)
    const accounts = await f.query('accounts.list', undefined)
    const write = fsx.writeJsonAtomic
    let failed = false
    vi.spyOn(fsx, 'writeJsonAtomic').mockImplementation(async (path, value) => {
      if (
        !failed &&
        path.endsWith('accounts.json') &&
        (value as { currentAccountId: string }).currentAccountId !== before.accountId
      ) {
        failed = true
        throw new Error('会话保存失败')
      }
      await write(path, value)
    })
    await expect(f.command('account.create', { name: '失败账户' })).rejects.toThrow('会话保存失败')
    expect(await f.query('session.get', undefined)).toEqual(before)
    expect(await f.query('accounts.list', undefined)).toEqual(accounts)
    await f.restart()
    expect((await f.query('session.get', undefined)).accountId).toBe(before.accountId)
    await expect(f.command('account.create', { name: '重试' })).resolves.toMatchObject({
      name: '重试'
    })
  })

  it('切换损坏工作区失败后保留原会话、页面和可写能力，重启也保持原选择', async () => {
    const original = await f.query('session.get', undefined)
    const page = await f.command('page.create', { name: '原始页面' })
    const target = await f.command('workspace.create', {
      name: '目标',
      type: 'custom',
      path: join(f.root, 'target')
    })
    await f.command('session.selectWorkspace', { workspaceId: original.workspaceId! })
    const before = await f.query('session.get', undefined)
    await writeFile(join(target.path, '.pointer', 'view-state.json'), '{broken')
    await expect(f.command('session.selectWorkspace', { workspaceId: target.id })).rejects.toThrow()
    expect(await f.query('session.get', undefined)).toEqual(before)
    expect((await f.query('tree.get', undefined)).pages.map((item) => item.id)).toContain(page.id)
    await f.command('conversation.append', {
      pageId: page.id,
      draft: { id: 'retained', role: 'user', content: '仍可写入' }
    })
    await f.restart()
    expect((await f.query('session.get', undefined)).workspaceId).toBe(original.workspaceId)
    expect((await f.query('conversation.get', { pageId: page.id })).messages[0].content).toBe(
      '仍可写入'
    )
  })

  it('拒绝删除最后一个工作区不会关闭它', async () => {
    const before = await f.query('session.get', undefined)
    await expect(
      f.command('workspace.delete', { workspaceId: before.workspaceId! })
    ).rejects.toMatchObject({ code: 'workspace.last-workspace' })
    expect(await f.query('session.get', undefined)).toEqual(before)
    await expect(f.command('page.create', { name: '保留' })).resolves.toMatchObject({
      name: '保留'
    })
  })

  it('非当前工作区改名、注销会通知列表且不删除自定义目录的内容', async () => {
    const original = await f.query('session.get', undefined)
    const target = await f.command('workspace.create', {
      name: '旧名',
      type: 'custom',
      path: join(f.root, 'custom')
    })
    await writeFile(join(target.path, 'personal.txt'), '保留')
    await f.command('session.selectWorkspace', { workspaceId: original.workspaceId! })
    f.events.length = 0
    await f.command('workspace.rename', { workspaceId: target.id, name: '新名' })
    expect(
      (await f.query('workspaces.list', undefined)).find((item) => item.id === target.id)?.name
    ).toBe('新名')
    expect(f.events.some((event) => event.type === 'workspaces.changed')).toBe(true)
    f.events.length = 0
    await f.command('workspace.delete', { workspaceId: target.id })
    expect(f.events.some((event) => event.type === 'workspaces.changed')).toBe(true)
    expect(await readFile(join(target.path, 'personal.txt'), 'utf8')).toBe('保留')
    await f.restart()
    expect((await f.query('workspaces.list', undefined)).map((item) => item.id)).toEqual([
      original.workspaceId
    ])
  })

  it('路径校验、修复及打开指定目录通过宿主执行', async () => {
    const dirPath = join(f.root, 'repair')
    expect(await f.command('workspace.validatePath', { dirPath })).toMatchObject({ valid: false })
    await mkdir(dirPath)
    expect(await f.command('workspace.validatePath', { dirPath })).toMatchObject({
      valid: true,
      repairable: true
    })
    expect(await f.command('workspace.repairPath', { dirPath })).toMatchObject({
      valid: true,
      isWorkspace: true,
      repairable: false
    })
    const target = await f.command('workspace.create', {
      name: '修复目录',
      type: 'custom',
      path: dirPath
    })
    const other = await f.command('workspace.create', {
      name: '另一目录',
      type: 'custom',
      path: join(f.root, 'other')
    })
    await f.command('workspace.openInFileManager', { workspaceId: target.id })
    expect(f.host.openInFileManager).toHaveBeenLastCalledWith(dirPath)
    expect((await f.query('session.get', undefined)).workspaceId).toBe(other.id)
    expect(await f.command('workspace.pickDirectory', { title: '选择工作区' })).toBeNull()
    expect(f.host.pickDirectory).toHaveBeenCalledWith('选择工作区')
  })

  it('删除当前账户先释放资源，回退账户和数据重启后保持一致', async () => {
    const original = await f.query('session.get', undefined)
    const page = await f.command('page.create', { name: '账户一' })
    const account = await f.command('account.create', { name: '账户二' })
    await f.command('account.update', {
      accountId: account.id,
      patch: { name: '改名', avatar: 'A' }
    })
    expect(await f.query('accounts.list', undefined)).toContainEqual(
      expect.objectContaining({ id: account.id, name: '改名', avatar: 'A' })
    )
    await f.command('account.delete', { accountId: account.id })
    expect((await f.query('session.get', undefined)).accountId).toBe(original.accountId)
    expect((await f.query('tree.get', undefined)).pages[0].id).toBe(page.id)
    await f.restart()
    expect(await f.query('accounts.list', undefined)).toHaveLength(1)
    await expect(
      f.command('account.delete', { accountId: original.accountId! })
    ).rejects.toMatchObject({ code: 'account.last-account' })
    await expect(f.query('tree.get', undefined)).resolves.toMatchObject({
      pages: [expect.objectContaining({ id: page.id })]
    })
  })
})

describe('目录布局与排他访问', () => {
  it('提交标记失败不向界面发布尚未持久化的页面', async () => {
    const write = fsx.writeJsonAtomic
    let failed = false
    vi.spyOn(fsx, 'writeJsonAtomic').mockImplementation(async (path, value) => {
      if (
        !failed &&
        path.endsWith('manifest.json') &&
        (value as { committed?: boolean }).committed
      ) {
        failed = true
        throw new Error('提交失败')
      }
      await write(path, value)
    })
    f.events.length = 0
    await expect(f.command('page.create', { name: '不可出现' })).rejects.toThrow('提交失败')
    expect(f.events.filter((event) => event.type === 'tree.changed')).toHaveLength(0)
    expect((await f.query('tree.get', undefined)).pages).toEqual([])
    await f.restart()
    expect((await f.query('tree.get', undefined)).pages).toEqual([])
  })

  it('名称清理后冲突的文件夹重排，页面身份及内容在重扫/重启后保持不变', async () => {
    const a = await f.command('folder.create', { name: 'A?' })
    const b = await f.command('folder.create', { name: 'A*', afterNodeId: a.id })
    const pa = await f.command('page.create', { name: 'same', parentFolderId: a.id })
    const pb = await f.command('page.create', { name: 'same', parentFolderId: b.id })
    for (const p of [pa, pb])
      await f.command('conversation.append', {
        pageId: p.id,
        draft: { id: 'message', role: 'user', content: p.id }
      })
    await f.command('tree.move', { nodeId: b.id, targetNodeId: a.id, placement: 'before' })
    await f.restart()
    const pages = (await f.query('tree.get', undefined)).pages
    expect(pages.find((item) => item.id === pa.id)?.parentFolderId).toBe(a.id)
    expect(pages.find((item) => item.id === pb.id)?.parentFolderId).toBe(b.id)
    for (const p of [pa, pb])
      expect((await f.query('conversation.get', { pageId: p.id })).messages[0].content).toBe(p.id)
  })

  it('打开自定义目录保留无关的空目录和嵌套空目录', async () => {
    const path = join(f.root, 'custom')
    await mkdir(join(path, '手工目录', '子目录'), { recursive: true })
    await f.command('workspace.create', { name: '自定义', type: 'custom', path })
    await f.restart()
    expect(await fsx.isDirectory(join(path, '手工目录', '子目录'))).toBe(true)
  })

  it('移动页面中途失败，内存与重新打开的布局保持一致', async () => {
    const folder = await f.command('folder.create', { name: '原目录' })
    const page = await f.command('page.create', { name: '消息', parentFolderId: folder.id })
    await f.command('conversation.append', {
      pageId: page.id,
      draft: { id: 'message', role: 'user', content: '不可丢失' }
    })
    const before = await f.query('tree.get', undefined)
    vi.spyOn(fsx, 'movePath').mockRejectedValueOnce(new Error('移动失败'))
    await expect(
      f.command('folder.update', { folderId: folder.id, patch: { name: '新目录' } })
    ).rejects.toThrow('移动失败')
    expect(await f.query('tree.get', undefined)).toEqual(before)
    await f.restart()
    expect(await f.query('tree.get', undefined)).toEqual(before)
    expect((await f.query('conversation.get', { pageId: page.id })).messages[0].content).toBe(
      '不可丢失'
    )
  })

  it('第二个内核不能同时打开工作区；释放后能重新打开', async () => {
    const second = new RuntimeCore({ appDataPath: f.root, host: f.host })
    try {
      await expect(second.init()).rejects.toMatchObject({ code: 'workspace.in-use' })
    } finally {
      await second.dispose()
    }
    await f.command('page.create', { name: '仍归第一实例' })
    await f.restart()
    expect((await f.query('tree.get', undefined)).pages[0].name).toBe('仍归第一实例')
  })

  it.each([1, 2, 3, 4])(
    '目录交换第 %i 次移动失败后撤销已完成移动，重启不会交换页面身份',
    async (failAt) => {
      const a = await f.command('folder.create', { name: 'A?' })
      const b = await f.command('folder.create', { name: 'A*', afterNodeId: a.id })
      const pa = await f.command('page.create', { name: 'same', parentFolderId: a.id })
      const pb = await f.command('page.create', { name: 'same', parentFolderId: b.id })
      const before = await f.query('tree.get', undefined)
      const move = fsx.movePath
      let calls = 0
      vi.spyOn(fsx, 'movePath').mockImplementation(async (from, to) => {
        if (++calls === failAt) throw new Error('交换中断')
        return move(from, to)
      })
      await expect(
        f.command('tree.move', { nodeId: b.id, targetNodeId: a.id, placement: 'before' })
      ).rejects.toThrow('交换中断')
      expect(await f.query('tree.get', undefined)).toEqual(before)
      await f.restart()
      const tree = await f.query('tree.get', undefined)
      expect(tree.pages.find((page) => page.id === pa.id)?.parentFolderId).toBe(a.id)
      expect(tree.pages.find((page) => page.id === pb.id)?.parentFolderId).toBe(b.id)
      expect(tree.folders).toEqual(before.folders)
    }
  )
})
