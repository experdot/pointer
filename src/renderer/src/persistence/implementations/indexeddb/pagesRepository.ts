/**
 * IndexedDB Page Repository Implementation
 */

import type { IPageRepository, PageRecord } from '../../interfaces/userData'
import {
  getUserDB,
  USER_STORES,
  dbGetAll,
  dbGet,
  dbPut,
  dbPutBatch,
  dbDeleteBatch,
  dbClear
} from './core'

export function createPageRepository(): IPageRepository {
  const storeName = USER_STORES.pages
  const messagesStoreName = USER_STORES.messages

  return {
    getAll: () => dbGetAll<PageRecord>(getUserDB, storeName),

    getById: (id) => dbGet<PageRecord>(getUserDB, storeName, id),

    put: (page) => dbPut(getUserDB, storeName, page),

    putBatch: (pages) => dbPutBatch(getUserDB, storeName, pages),

    delete: (id) => dbDeleteBatch(getUserDB, storeName, [id]),

    deleteBatch: (ids) => dbDeleteBatch(getUserDB, storeName, ids),

    clear: () => dbClear(getUserDB, storeName),

    // Extended methods - cascade delete with messages
    deleteWithMessages: (id) => dbDeleteBatch(getUserDB, [storeName, messagesStoreName], [id]),

    deleteWithMessagesBatch: (ids) => dbDeleteBatch(getUserDB, [storeName, messagesStoreName], ids),

    clearAllWithMessages: () => dbClear(getUserDB, [storeName, messagesStoreName])
  }
}
