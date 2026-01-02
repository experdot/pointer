import { v4 as uuidv4 } from 'uuid'
import type { Account } from '../types/type'
import { useAccountStore, createDefaultAccount, getDefaultAccountId } from '../stores/accountStore'
import { setDatabaseName, deleteDatabase } from '../utils/database'
import { usePagesStore } from '../stores/pagesStore'
import { useFoldersStore } from '../stores/foldersStore'
import { useMessagesStore } from '../stores/messagesStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useLayoutStore } from '../stores/layoutStore'
import { useTabsStore } from '../stores/tabsStore'

// 初始化所有用户数据 store
async function initAllStores(): Promise<void> {
  await Promise.all([
    usePagesStore.getState().init(),
    useFoldersStore.getState().init(),
    useSettingsStore.getState().init(),
    useLayoutStore.getState().init(),
    useTabsStore.getState().init()
  ])
}

// 重置所有用户数据 store
function resetAllStores(): void {
  usePagesStore.getState().reset()
  useFoldersStore.getState().reset()
  useMessagesStore.getState().reset()
  useSettingsStore.getState().reset()
  useLayoutStore.getState().reset()
  useTabsStore.getState().reset()
}

// 初始化账户系统
export async function initializeAccountSystem(): Promise<void> {
  // 先初始化账户 store
  await useAccountStore.getState().init()

  // 重新获取最新状态
  const store = useAccountStore.getState()

  // 如果没有账户，创建默认账户
  if (store.accounts.length === 0) {
    const defaultAccount = createDefaultAccount()
    await store.addAccount(defaultAccount)
    await store.setCurrentAccountId(defaultAccount.id)
  }

  // 如果没有当前账户，设置为第一个账户
  const currentState = useAccountStore.getState()
  if (!currentState.currentAccountId && currentState.accounts.length > 0) {
    await currentState.setCurrentAccountId(currentState.accounts[0].id)
  }

  // 设置数据库名称
  const accountId = useAccountStore.getState().currentAccountId || getDefaultAccountId()
  setDatabaseName(accountId)

  // 初始化所有用户数据 store
  await initAllStores()

  useAccountStore.getState().setInitialized(true)
}

// 切换账户
export async function switchAccount(accountId: string): Promise<void> {
  const store = useAccountStore.getState()

  // 验证账户存在
  const account = store.accounts.find((acc) => acc.id === accountId)
  if (!account) {
    throw new Error(`Account not found: ${accountId}`)
  }

  // 重置所有 store
  resetAllStores()

  // 切换数据库
  setDatabaseName(accountId)

  // 更新当前账户
  await store.setCurrentAccountId(accountId)

  // 从新数据库加载数据
  await initAllStores()
}

// 创建新账户
export async function createAccount(name: string, avatar?: string): Promise<Account> {
  const store = useAccountStore.getState()

  const account: Account = {
    id: uuidv4(),
    name,
    avatar,
    createdAt: Date.now()
  }

  await store.addAccount(account)
  return account
}

// 更新账户信息
export async function updateAccount(
  id: string,
  updates: Partial<Omit<Account, 'id' | 'createdAt'>>
): Promise<void> {
  const store = useAccountStore.getState()
  await store.updateAccount(id, updates)
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

  // 先从列表中移除，再删除数据库
  await store.removeAccount(accountId)

  try {
    await deleteDatabase(accountId)
  } catch (error) {
    console.error('Failed to delete account database:', error)
  }
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
