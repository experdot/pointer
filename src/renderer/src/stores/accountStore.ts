import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Account } from '../types/type'

// accountStore 使用独立的 localStorage，不随账户切换
// 因为它需要存储所有账户列表和当前账户信息

interface AccountState {
  accounts: Account[]
  currentAccountId: string | null
  initialized: boolean
}

interface AccountActions {
  setAccounts: (accounts: Account[]) => void
  addAccount: (account: Account) => void
  updateAccount: (id: string, updates: Partial<Account>) => void
  removeAccount: (id: string) => void
  setCurrentAccountId: (id: string | null) => void
  setInitialized: (initialized: boolean) => void
}

type AccountStore = AccountState & AccountActions

const DEFAULT_ACCOUNT_ID = 'default'

export const useAccountStore = create<AccountStore>()(
  persist(
    (set) => ({
      accounts: [],
      currentAccountId: null,
      initialized: false,

      setAccounts: (accounts) => set({ accounts }),

      addAccount: (account) =>
        set((state) => ({
          accounts: [...state.accounts, account]
        })),

      updateAccount: (id, updates) =>
        set((state) => ({
          accounts: state.accounts.map((acc) =>
            acc.id === id ? { ...acc, ...updates, updatedAt: Date.now() } : acc
          )
        })),

      removeAccount: (id) =>
        set((state) => ({
          accounts: state.accounts.filter((acc) => acc.id !== id),
          currentAccountId: state.currentAccountId === id ? null : state.currentAccountId
        })),

      setCurrentAccountId: (id) => set({ currentAccountId: id }),

      setInitialized: (initialized) => set({ initialized })
    }),
    {
      name: 'pointer-account-store',
      // 使用 localStorage，全局存储，不随账户切换
      partialize: (state) => ({
        accounts: state.accounts,
        currentAccountId: state.currentAccountId
      })
    }
  )
)

// 获取默认账户 ID
export function getDefaultAccountId(): string {
  return DEFAULT_ACCOUNT_ID
}

// 创建默认账户
export function createDefaultAccount(): Account {
  return {
    id: DEFAULT_ACCOUNT_ID,
    name: '默认账户',
    createdAt: Date.now()
  }
}
