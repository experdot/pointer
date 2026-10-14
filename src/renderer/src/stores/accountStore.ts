/**
 * 账户 Store（镜像 + 命令）
 */

import { create } from 'zustand'
import type { Account } from '@shared/domain'
import { command } from '../runtime/client'

interface AccountState {
  accounts: Account[]
  currentAccountId: string | null
  initialized: boolean
}

interface AccountActions {
  getById: (id: string) => Account | undefined
  getAll: () => Account[]
  create: (input: { name: string; avatar?: string }) => Promise<Account>
  update: (id: string, changes: { name?: string; avatar?: string }) => Promise<void>
  remove: (id: string) => Promise<void>
  setCurrentAccountId: (id: string | null) => Promise<void>
  reset: () => void
}

type AccountStore = AccountState & AccountActions

export const useAccountStore = create<AccountStore>((set, get) => ({
  accounts: [],
  currentAccountId: null,
  initialized: false,

  getById: (id) => get().accounts.find((account) => account.id === id),

  getAll: () => get().accounts,

  create: (input) => command('account.create', input),

  update: async (id, changes) => {
    await command('account.update', { accountId: id, patch: changes })
  },

  remove: async (id) => {
    await command('account.delete', { accountId: id })
  },

  setCurrentAccountId: async (id) => {
    if (!id) return
    await command('session.selectAccount', { accountId: id })
  },

  reset: () => set({ accounts: [], currentAccountId: null, initialized: false })
}))

/**
 * 默认账户 = 列表中的第一个账户
 *
 * 迁移后账户 id 由内核生成（uuid），不再有固定的 "default" id；
 * 内核创建首个账户的语义与旧 "default 账户" 一致，因此以第一个账户为准。
 */
export function getDefaultAccountId(): string {
  return useAccountStore.getState().accounts[0]?.id ?? 'default'
}
