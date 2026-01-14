/**
 * IndexedDB Account Repository Implementation
 */

import type { Account } from '../../../types/type'
import type { IAccountRepository } from '../../interfaces/accounts'
import {
  getAccountsDB,
  ACCOUNTS_STORES,
  dbGetAll,
  dbGet,
  dbPut,
  dbDelete,
  dbPutBatch,
  dbDeleteBatch,
  dbClear
} from './core'

export function createAccountRepository(): IAccountRepository {
  const storeName = ACCOUNTS_STORES.accounts
  const metaStoreName = ACCOUNTS_STORES.meta

  return {
    getAll: () => dbGetAll<Account>(getAccountsDB, storeName),

    getById: (id) => dbGet<Account>(getAccountsDB, storeName, id),

    put: (account) => dbPut(getAccountsDB, storeName, account),

    putBatch: (accounts) => dbPutBatch(getAccountsDB, storeName, accounts),

    delete: (id) => dbDelete(getAccountsDB, storeName, id),

    deleteBatch: (ids) => dbDeleteBatch(getAccountsDB, storeName, ids),

    clear: () => dbClear(getAccountsDB, storeName),

    getCurrentAccountId: async () => {
      const result = await dbGet<{ value?: string | null }>(
        getAccountsDB,
        metaStoreName,
        'currentAccountId'
      )
      return result?.value ?? null
    },

    setCurrentAccountId: (id) =>
      dbPut(getAccountsDB, metaStoreName, { key: 'currentAccountId', value: id })
  }
}
