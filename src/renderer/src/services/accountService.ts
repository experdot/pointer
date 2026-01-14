import type { Account } from '../types/type'
import { stores } from '../stores/registry'
import { persistence } from '../persistence/registry'
import { createDefaultAccount, getDefaultAccountId } from '../stores/accountStore'

// 初始化所有用户数据 store
async function initAllStores(): Promise<void> {
  const { page, folder, settings, layout, tab } = stores
  await Promise.all([page.init(), folder.init(), settings.init(), layout.init(), tab.init()])
}

// 重置所有用户数据 store
function resetAllStores(): void {
  const { page, folder, message, settings, layout, tab } = stores
  page.reset()
  folder.reset()
  message.reset()
  settings.reset()
  layout.reset()
  tab.reset()
}

// 初始化账户系统
export async function initializeAccountSystem(): Promise<void> {
  const { account } = stores

  // 先初始化账户 store
  await account.init()

  // 如果没有账户，创建默认账户
  if (account.accounts.length === 0) {
    const defaultAccount = createDefaultAccount()
    await account.create({
      id: defaultAccount.id,
      name: defaultAccount.name,
      avatar: defaultAccount.avatar
    })
    await account.setCurrentAccountId(defaultAccount.id)
  }

  // 如果没有当前账户，设置为第一个账户
  if (!account.currentAccountId && account.accounts.length > 0) {
    await account.setCurrentAccountId(account.accounts[0].id)
  }

  // 设置数据库名称
  const accountId = account.currentAccountId || getDefaultAccountId()
  persistence.database.setDatabase(accountId)

  // 初始化所有用户数据 store
  await initAllStores()

  account.setInitialized(true)
}

// 切换账户
export async function switchAccount(accountId: string): Promise<void> {
  const { account } = stores

  // 验证账户存在
  const targetAccount = account.getById(accountId)
  if (!targetAccount) {
    throw new Error(`Account not found: ${accountId}`)
  }

  // 重置所有 store
  resetAllStores()

  // 切换数据库
  persistence.database.setDatabase(accountId)

  // 更新当前账户
  await account.setCurrentAccountId(accountId)

  // 从新数据库加载数据
  await initAllStores()
}

// 创建新账户
export async function createAccount(name: string, avatar?: string): Promise<Account> {
  return stores.account.create({ name, avatar })
}

// 更新账户信息
export async function updateAccount(
  id: string,
  updates: Partial<Omit<Account, 'id' | 'createdAt'>>
): Promise<void> {
  await stores.account.update(id, updates)
}

// 删除账户
export async function removeAccount(accountId: string): Promise<void> {
  const { account } = stores

  // 不能删除默认账户
  if (accountId === getDefaultAccountId()) {
    throw new Error('Cannot delete default account')
  }

  // 不能删除当前账户
  if (accountId === account.currentAccountId) {
    throw new Error('Cannot delete current account')
  }

  // 先从列表中移除，再删除数据库
  await account.delete(accountId)

  try {
    await persistence.database.deleteDatabase(accountId)
  } catch (error) {
    console.error('Failed to delete account database:', error)
  }
}

// 获取当前账户
export function getCurrentAccount(): Account | null {
  const { account } = stores
  if (!account.currentAccountId) return null
  return account.getById(account.currentAccountId) || null
}

// 获取所有账户
export function getAllAccounts(): Account[] {
  return stores.account.accounts
}

// 退出登录（切换到默认账户）
export async function logout(): Promise<void> {
  const defaultId = getDefaultAccountId()
  const { account } = stores

  if (account.currentAccountId !== defaultId) {
    await switchAccount(defaultId)
  }
}
