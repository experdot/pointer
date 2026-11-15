import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import { testDirectory } from '../../../tests/helpers/temp'
import { AccountStore } from './AccountStore'
import { PathResolver } from './paths'

let directory: Awaited<ReturnType<typeof testDirectory>>
let paths: PathResolver
let store: AccountStore

beforeEach(async () => {
  directory = await testDirectory()
  paths = new PathResolver(directory.path)
  store = new AccountStore(paths)
  await store.load()
})

afterEach(async () => {
  await directory.remove()
})

describe('账户默认名称', () => {
  it('系统账户使用默认名称，改头像保留，改名后重启不再翻译', async () => {
    const account = await store.ensureDefaultAccount()
    expect(account).toMatchObject({ name: '默认账户', usesDefaultName: true })
    expect(await store.update(account.id, { avatar: 'star' }, 2)).toMatchObject({
      usesDefaultName: true,
      avatar: 'star'
    })
    expect(await store.update(account.id, { name: '我的账户' }, 3)).toMatchObject({
      name: '我的账户',
      usesDefaultName: false
    })
    const restarted = new AccountStore(paths)
    await restarted.load()
    expect(await restarted.ensureDefaultAccount()).toMatchObject({
      id: account.id,
      name: '我的账户',
      usesDefaultName: false
    })
  })

  it('手动创建或重命名为默认文案的账户仍使用自定义名称', async () => {
    const account = await store.create({ name: '默认账户' })
    expect(account.usesDefaultName).toBe(false)
    await store.update(account.id, { name: 'Default account' }, 2)
    await store.load()
    expect(store.getCurrent()).toMatchObject({
      name: 'Default account',
      usesDefaultName: false
    })
  })

  it.each(['默认账户', 'Default account'])(
    '兼容旧版首个账户名称 %s，并保留其他同名账户',
    async (name) => {
      await writeFile(
        paths.accountsFile,
        JSON.stringify({
          accounts: [
            { id: 'first', name, avatar: 'star', createdAt: 1, updatedAt: 2 },
            { id: 'second', name, createdAt: 3 }
          ],
          currentAccountId: 'second'
        })
      )
      await store.load()
      expect(store.list()).toMatchObject([
        { id: 'first', name, usesDefaultName: true },
        { id: 'second', name, usesDefaultName: false }
      ])
      await store.setCurrent('second')
      expect(JSON.parse(await readFile(paths.accountsFile, 'utf8')).accounts).toEqual(store.list())
      await store.remove('first')
      await store.load()
      expect(store.getCurrent()).toMatchObject({ name, usesDefaultName: false })
    }
  )

  it('旧版首个账户已经改名时保留名称', async () => {
    await writeFile(
      paths.accountsFile,
      JSON.stringify({ accounts: [{ id: 'first', name: '个人账户', createdAt: 1 }] })
    )
    await store.load()
    expect(await store.ensureDefaultAccount()).toMatchObject({
      name: '个人账户',
      usesDefaultName: false
    })
  })
})
