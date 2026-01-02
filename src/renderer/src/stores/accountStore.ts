import { create } from 'zustand'
import * as db from '../utils/database'
import type { Account } from '../types/type'

interface AccountState {
  accounts: Account[]
  currentAccountId: string | null
  initialized: boolean
}

interface AccountActions {
  init: () => Promise<void>
  addAccount: (account: Account) => Promise<void>
  updateAccount: (id: string, updates: Partial<Account>) => Promise<void>
  removeAccount: (id: string) => Promise<void>
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
      db.getAllAccounts(),
      db.getCurrentAccountId()
    ])
    set({ accounts, currentAccountId, initialized: true })
  },

  addAccount: async (account) => {
    await db.putAccount(account)
    set((state) => {
      // 避免重复添加
      if (state.accounts.some((a) => a.id === account.id)) {
        return { accounts: state.accounts.map((a) => (a.id === account.id ? account : a)) }
      }
      return { accounts: [...state.accounts, account] }
    })
  },

  updateAccount: async (id, updates) => {
    const account = get().accounts.find((a) => a.id === id)
    if (!account) return
    const updated = { ...account, ...updates, updatedAt: Date.now() }
    await db.putAccount(updated)
    set((state) => ({
      accounts: state.accounts.map((a) => (a.id === id ? updated : a))
    }))
  },

  removeAccount: async (id) => {
    await db.deleteAccount(id)
    set((state) => ({
      accounts: state.accounts.filter((a) => a.id !== id),
      currentAccountId: state.currentAccountId === id ? null : state.currentAccountId
    }))
  },

  setCurrentAccountId: async (id) => {
    await db.setCurrentAccountId(id)
    set({ currentAccountId: id })
  },

  setInitialized: (initialized) => set({ initialized })
}))

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
