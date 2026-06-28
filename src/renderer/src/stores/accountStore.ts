/**
 * 账户 Store
 * 管理账户列表和当前账户
 */

import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { persistence } from '../persistence/registry'
import type { Account } from '../types/type'
import type { IAccountStore, AccountCreateDTO } from './interfaces/entities'

interface AccountState {
  accounts: Account[]
  currentAccountId: string | null
  initialized: boolean
}

interface AccountActions {
  // IEntityStore 接口方法
  init: () => Promise<void>
  getById: (id: string) => Account | undefined
  getAll: () => Account[]
  create: (data: AccountCreateDTO) => Promise<Account>
  createMany: (data: AccountCreateDTO[]) => Promise<Account[]>
  update: (id: string, changes: Partial<Account>) => Promise<void>
  updateMany: (updates: Array<{ id: string; changes: Partial<Account> }>) => Promise<void>
  delete: (id: string) => Promise<void>
  deleteMany: (ids: string[]) => Promise<void>
  reset: () => Promise<void>
  // 扩展方法
  setCurrentAccountId: (id: string | null) => Promise<void>
  setInitialized: (initialized: boolean) => void
}

type AccountStore = AccountState & AccountActions

const DEFAULT_ACCOUNT_ID = 'default'

const initialState: AccountState = {
  accounts: [],
  currentAccountId: null,
  initialized: false
}

export const useAccountStore = create<AccountStore>((set, get) => ({
  ...initialState,

  init: async () => {
    const [accounts, currentAccountId] = await Promise.all([
      persistence.accounts.getAll(),
      persistence.accounts.getCurrentAccountId()
    ])
    set({ accounts, currentAccountId, initialized: true })
  },

  getById: (id) => get().accounts.find((a) => a.id === id),

  getAll: () => get().accounts,

  create: async (data) => {
    const account: Account = {
      id: data.id || uuidv4(),
      name: data.name,
      avatar: data.avatar,
      createdAt: Date.now()
    }
    await persistence.accounts.put(account)
    set((state) => {
      // 避免重复添加
      if (state.accounts.some((a) => a.id === account.id)) {
        return { accounts: state.accounts.map((a) => (a.id === account.id ? account : a)) }
      }
      return { accounts: [...state.accounts, account] }
    })
    return account
  },

  createMany: async (items) => {
    if (items.length === 0) return []
    const accounts: Account[] = items.map((data) => ({
      id: uuidv4(),
      name: data.name,
      avatar: data.avatar,
      createdAt: Date.now()
    }))
    await Promise.all(accounts.map((a) => persistence.accounts.put(a)))
    set((state) => ({ accounts: [...state.accounts, ...accounts] }))
    return accounts
  },

  update: async (id, changes) => {
    const account = get().accounts.find((a) => a.id === id)
    if (!account) return
    const updated = { ...account, ...changes, updatedAt: Date.now() }
    await persistence.accounts.put(updated)
    set((state) => ({
      accounts: state.accounts.map((a) => (a.id === id ? updated : a))
    }))
  },

  updateMany: async (updates) => {
    if (updates.length === 0) return
    const accounts = get().accounts
    const updatedAccounts = accounts.map((a) => {
      const update = updates.find((u) => u.id === a.id)
      return update ? { ...a, ...update.changes, updatedAt: Date.now() } : a
    })
    await Promise.all(
      updates.map((u) => {
        const account = updatedAccounts.find((a) => a.id === u.id)
        return account ? persistence.accounts.put(account) : Promise.resolve()
      })
    )
    set({ accounts: updatedAccounts })
  },

  delete: async (id) => {
    await persistence.accounts.delete(id)
    set((state) => ({
      accounts: state.accounts.filter((a) => a.id !== id),
      currentAccountId: state.currentAccountId === id ? null : state.currentAccountId
    }))
  },

  deleteMany: async (ids) => {
    if (ids.length === 0) return
    await Promise.all(ids.map((id) => persistence.accounts.delete(id)))
    const idSet = new Set(ids)
    set((state) => ({
      accounts: state.accounts.filter((a) => !idSet.has(a.id)),
      currentAccountId: idSet.has(state.currentAccountId ?? '') ? null : state.currentAccountId
    }))
  },

  reset: async () => {
    // 注意：账户数据在独立的数据库中，这里只重置内存状态
    set(initialState)
  },

  setCurrentAccountId: async (id) => {
    await persistence.accounts.setCurrentAccountId(id)
    set({ currentAccountId: id })
  },

  setInitialized: (initialized) => set({ initialized })
}))

/**
 * 获取账户 Store 的接口实现
 */
export function getAccountStoreInterface(): IAccountStore {
  const store = useAccountStore
  return {
    get initialized() {
      return store.getState().initialized
    },
    get accounts() {
      return store.getState().accounts
    },
    get currentAccountId() {
      return store.getState().currentAccountId
    },
    init: () => store.getState().init(),
    reset: () => store.getState().reset(),
    getById: (id) => store.getState().getById(id),
    getAll: () => store.getState().getAll(),
    create: (data) => store.getState().create(data),
    createMany: (data) => store.getState().createMany(data),
    update: (id, changes) => store.getState().update(id, changes),
    updateMany: (updates) => store.getState().updateMany(updates),
    delete: (id) => store.getState().delete(id),
    deleteMany: (ids) => store.getState().deleteMany(ids),
    setCurrentAccountId: (id) => store.getState().setCurrentAccountId(id),
    setInitialized: (initialized) => store.getState().setInitialized(initialized)
  }
}

export function getDefaultAccountId(): string {
  return DEFAULT_ACCOUNT_ID
}

export function createDefaultAccount(): Account {
  return {
    id: DEFAULT_ACCOUNT_ID,
    name: '默认账户',
    createdAt: Date.now()
  }
}
