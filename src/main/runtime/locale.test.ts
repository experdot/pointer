import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createKernel, type KernelFixture } from '../../../tests/helpers/kernel'
import { testDirectory } from '../../../tests/helpers/temp'
import { LocaleService } from './LocaleService'
import type { LanguagePreference } from '@shared/domain/locale'
import type { Workspace } from '@shared/domain'

let kernel: KernelFixture | undefined
afterEach(async () => {
  await kernel?.dispose()
  kernel = undefined
})

describe('应用级语言设置', () => {
  it('首次跟随系统，切换落盘并广播，重启和账户切换后保留', async () => {
    kernel = await createKernel()
    expect(await kernel.query('app.locale.get', undefined)).toMatchObject({
      preference: 'system',
      language: 'zh-CN'
    })
    const before = await kernel.command('page.create', {})
    expect(before.name).toBe('新对话')
    const folderBefore = await kernel.command('folder.create', {})
    expect(folderBefore.name).toBe('新建文件夹')
    const saved = await kernel.command('app.locale.set', { preference: 'en-US' })
    expect(saved).toMatchObject({ preference: 'en-US', language: 'en-US', revision: 1 })
    expect(kernel.events.filter((e) => e.type === 'app.locale.changed')).toHaveLength(1)
    expect(JSON.parse(await readFile(join(kernel.root, 'app-preferences.json'), 'utf8'))).toEqual({
      language: 'en-US'
    })
    const after = await kernel.command('page.create', {})
    expect(after.name).toBe('New conversation')
    expect((await kernel.command('folder.create', {})).name).toBe('New folder')
    expect(
      (await kernel.query('tree.get', undefined)).folders.find(
        (folder) => folder.id === folderBefore.id
      )?.name
    ).toBe('新建文件夹')
    expect(
      (await kernel.query('tree.get', undefined)).pages.find((p) => p.id === before.id)?.name
    ).toBe('新对话')
    await kernel.restart()
    expect(await kernel.query('app.locale.get', undefined)).toMatchObject({
      preference: 'en-US',
      language: 'en-US'
    })
    await kernel.command('account.create', { name: 'Second account' })
    expect(await kernel.query('app.locale.get', undefined)).toMatchObject({ language: 'en-US' })
  })

  it('应用级语言调用接受旧工作区作用域，切回系统时重新读取系统语言', async () => {
    kernel = await createKernel()
    await kernel.runtime.command('app.locale.set', { preference: 'en-US' }, 'old-scope')
    vi.mocked(kernel.host.getPreferredSystemLanguages).mockReturnValue(['de-DE', 'zh-Hans-CN'])
    expect(
      await kernel.runtime.command('app.locale.set', { preference: 'system' }, 'old-scope')
    ).toMatchObject({ language: 'zh-CN' })
    expect(await kernel.runtime.query('app.locale.get', undefined, 'old-scope')).toMatchObject({
      preference: 'system'
    })
    await expect(
      kernel.command('app.locale.set', { preference: 'fr-FR' as LanguagePreference })
    ).rejects.toMatchObject({ code: 'locale.invalid' })
  })

  it('不认识的历史偏好回退系统；保存失败不更改语言状态', async () => {
    const directory = await testDirectory()
    try {
      const file = join(directory.path, 'app-preferences.json')
      await writeFile(file, JSON.stringify({ language: 'obsolete' }))
      const service = new LocaleService(directory.path, () => ['en-GB'])
      await service.load()
      expect(service.snapshot()).toMatchObject({ preference: 'system', language: 'en-US' })
      await writeFile(file, '{')
      await service.load()
      expect(service.snapshot().language).toBe('en-US')
      const invalidLocation = join(directory.path, 'read-only-fixture')
      await mkdir(invalidLocation)
      const failing = new LocaleService(invalidLocation, () => ['zh-CN'])
      await failing.load()
      await mkdir(join(invalidLocation, 'app-preferences.json'))
      await expect(failing.set('en-US')).rejects.toThrow()
      expect(failing.snapshot()).toMatchObject({
        preference: 'system',
        language: 'zh-CN',
        revision: 0
      })
    } finally {
      await directory.remove()
    }
  })
})

describe('默认工作区名称', () => {
  it('默认名标识跨重启和账户保留，语言切换不改写名称与目录身份', async () => {
    kernel = await createKernel()
    const session = await kernel.query('session.get', undefined)
    const original = (await kernel.query('workspaces.list', undefined))[0]
    expect(original).toMatchObject({ name: '默认工作区', usesDefaultName: true })
    const registryPath = join(kernel.root, 'accounts', session.accountId!, 'workspaces.json')
    const identityPath = join(original.path, '.pointer', 'workspace.json')
    const registryBefore = await readFile(registryPath, 'utf8')
    const identityBefore = await readFile(identityPath, 'utf8')
    await kernel.command('app.locale.set', { preference: 'en-US' })
    expect(await kernel.query('workspaces.list', undefined)).toEqual([original])
    expect(await readFile(registryPath, 'utf8')).toBe(registryBefore)
    expect(await readFile(identityPath, 'utf8')).toBe(identityBefore)
    await kernel.restart()
    expect(await kernel.query('workspaces.list', undefined)).toEqual([original])
    await kernel.command('account.create', { name: 'Second account' })
    expect(await kernel.query('workspaces.list', undefined)).toMatchObject([
      { name: 'Default workspace', usesDefaultName: true }
    ])
    await kernel.command('session.selectAccount', { accountId: session.accountId! })
    expect(await kernel.query('workspaces.list', undefined)).toEqual([original])
  })

  it.each(['个人工作区', '默认工作区', 'Default workspace'])(
    '显式改名为 %s 后，通过事件和重启保留自定义名称',
    async (name) => {
      kernel = await createKernel()
      const original = (await kernel.query('workspaces.list', undefined))[0]
      await kernel.command('workspace.rename', { workspaceId: original.id, name })
      expect(kernel.events.findLast((event) => event.type === 'workspaces.changed')).toMatchObject({
        payload: [{ id: original.id, name, usesDefaultName: false }]
      })
      await kernel.restart()
      expect(await kernel.query('workspaces.list', undefined)).toMatchObject([
        { id: original.id, name, usesDefaultName: false }
      ])
    }
  )

  it.each([
    ['默认工作区', true],
    ['Default workspace', true],
    ['我的工作区', false]
  ] as const)('兼容旧版默认工作区 %s，同名自定义目录保持原文', async (name, usesDefaultName) => {
    kernel = await createKernel()
    const session = await kernel.query('session.get', undefined)
    const original = (await kernel.query('workspaces.list', undefined))[0]
    const custom = await kernel.command('workspace.create', {
      name,
      type: 'custom',
      path: join(kernel.root, 'custom')
    })
    const registryPath = join(kernel.root, 'accounts', session.accountId!, 'workspaces.json')
    const legacy = JSON.parse(await readFile(registryPath, 'utf8')) as {
      currentWorkspaceId: string
      workspaces: Workspace[]
    }
    for (const workspace of legacy.workspaces) {
      delete workspace.usesDefaultName
      workspace.name = name
    }
    await writeFile(registryPath, JSON.stringify(legacy))
    await kernel.restart()
    expect(await kernel.query('workspaces.list', undefined)).toMatchObject([
      { id: original.id, name, usesDefaultName },
      { id: custom.id, name, usesDefaultName: false }
    ])
    expect(JSON.parse(await readFile(registryPath, 'utf8')).workspaces).toMatchObject([
      { id: original.id, name, usesDefaultName },
      { id: custom.id, name, usesDefaultName: false }
    ])
  })
})
