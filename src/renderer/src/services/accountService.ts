import type { Account } from '../types/type'
import { stores } from '../stores/registry'
import { persistence } from '../persistence/registry'
import { createDefaultAccount, getDefaultAccountId } from '../stores/accountStore'
import { initializeWorkspaceSystem, resetWorkspaceSystem } from './workspaceService'

// 初始化账户级 stores (不包括工作区级 stores)
async function initAccountStores(): Promise<void> {
  const { settings, layout } = stores
  await Promise.all([settings.init(), layout.init()])
}

// 重置账户级 stores
function resetAccountStores(): void {
  const { settings, layout } = stores
  settings.reset()
  layout.reset()
}

// 初始化账户系统
export async function initializeAccountSystem(): Promise<void> {
  const { account } = stores

  // 初始化持久化层（确保 appDataPath 已初始化）
  await persistence.database.init()

  // 初始化账户 store
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

  // 设置当前账户路径
  const accountId = account.currentAccountId || getDefaultAccountId()
  await persistence.database.setAccount(accountId)

  // 初始化账户级 stores
  await initAccountStores()

  // 初始化工作区系统
  await initializeWorkspaceSystem()

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

  // 重置工作区系统（包括工作区级 stores）
  resetWorkspaceSystem()

  // 重置账户级 stores
  resetAccountStores()

  // 切换账户路径
  await persistence.database.setAccount(accountId)

  // 更新当前账户
  await account.setCurrentAccountId(accountId)

  // 初始化账户级 stores
  await initAccountStores()

  // 初始化工作区系统
  await initializeWorkspaceSystem()
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

  // 先从列表中移除，再删除数据
  await account.delete(accountId)

  try {
    await persistence.database.deleteAccountData(accountId)
  } catch (error) {
    console.error('Failed to delete account data:', error)
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
