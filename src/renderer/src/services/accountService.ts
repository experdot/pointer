import { v4 as uuidv4 } from 'uuid'
import type { Account } from '../types/type'
import {
  useAccountStore,
  createDefaultAccount,
  getDefaultAccountId
} from '../stores/accountStore'
import { setDatabaseName, deleteDatabase } from '../utils/indexedDB'
import { rehydrateAllStores } from '../utils/storeRegistry'

// 初始化账户系统
export async function initializeAccountSystem(): Promise<void> {
  const store = useAccountStore.getState()

  // 如果没有账户，创建默认账户
  if (store.accounts.length === 0) {
    const defaultAccount = createDefaultAccount()
    store.addAccount(defaultAccount)
    store.setCurrentAccountId(defaultAccount.id)
  }

  // 如果没有当前账户，设置为第一个账户
  if (!store.currentAccountId && store.accounts.length > 0) {
    store.setCurrentAccountId(store.accounts[0].id)
  }

  // 设置数据库名称
  const accountId = store.currentAccountId || getDefaultAccountId()
  setDatabaseName(accountId)

  // 初始化完成后，手动触发所有 store 的 rehydrate
  await rehydrateAllStores()

  store.setInitialized(true)
}

// 切换账户
export async function switchAccount(accountId: string): Promise<void> {
  const store = useAccountStore.getState()

  // 验证账户存在
  const account = store.accounts.find((acc) => acc.id === accountId)
  if (!account) {
    throw new Error(`Account not found: ${accountId}`)
  }

  // 切换数据库（必须在 reset 之前，避免清空原账户数据）
  setDatabaseName(accountId)

  // 更新当前账户
  store.setCurrentAccountId(accountId)

  // 从新数据库加载数据（rehydrate 会覆盖内存状态，不需要先 reset）
  await rehydrateAllStores()
}

// 创建新账户
export function createAccount(name: string, avatar?: string): Account {
  const store = useAccountStore.getState()

  const account: Account = {
    id: uuidv4(),
    name,
    avatar,
    createdAt: Date.now()
  }

  store.addAccount(account)
  return account
}

// 更新账户信息
export function updateAccount(id: string, updates: Partial<Omit<Account, 'id' | 'createdAt'>>): void {
  const store = useAccountStore.getState()
  store.updateAccount(id, updates)
}

// 删除账户
export async function removeAccount(accountId: string): Promise<void> {
  const store = useAccountStore.getState()

  // 不能删除默认账户
  if (accountId === getDefaultAccountId()) {
    throw new Error('Cannot delete default account')
  }

  // 不能删除当前账户
  if (accountId === store.currentAccountId) {
    throw new Error('Cannot delete current account')
  }

  // 删除账户数据库
  await deleteDatabase(accountId)

  // 从列表中移除
  store.removeAccount(accountId)
}

// 获取当前账户
export function getCurrentAccount(): Account | null {
  const store = useAccountStore.getState()
  if (!store.currentAccountId) return null
  return store.accounts.find((acc) => acc.id === store.currentAccountId) || null
}

// 获取所有账户
export function getAllAccounts(): Account[] {
  return useAccountStore.getState().accounts
}

// 退出登录（切换到默认账户）
export async function logout(): Promise<void> {
  const defaultId = getDefaultAccountId()
  const store = useAccountStore.getState()

  if (store.currentAccountId !== defaultId) {
    await switchAccount(defaultId)
  }
}
