/**
 * IndexedDB Messages Repository Implementation
 */

import type { IMessagesRepository, MessagesRecord } from '../../interfaces/userData'
import { getUserDB, USER_STORES, dbGetAll, dbGet, dbPut, dbPutBatch, dbDelete } from './core'

export function createMessagesRepository(): IMessagesRepository {
  const storeName = USER_STORES.messages

  return {
    get: (pageId) => dbGet<MessagesRecord>(getUserDB, storeName, pageId),

    put: (pageId, record) => dbPut(getUserDB, storeName, { ...record, pageId }),

    delete: (pageId) => dbDelete(getUserDB, storeName, pageId),

    getAll: () => dbGetAll<MessagesRecord>(getUserDB, storeName),

    putBatch: (records) => dbPutBatch(getUserDB, storeName, records)
  }
}
