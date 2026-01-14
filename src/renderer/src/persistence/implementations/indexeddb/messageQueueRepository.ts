/**
 * IndexedDB Message Queue Repository Implementation
 */

import type { IMessageQueueRepository, MessageQueueRecord } from '../../interfaces/userData'
import { getUserDB, USER_STORES, dbGetAll, dbGet, dbPut, dbDelete } from './core'

export function createMessageQueueRepository(): IMessageQueueRepository {
  const storeName = USER_STORES.messageQueue

  return {
    get: (pageId) =>
      dbGet<MessageQueueRecord>(
        getUserDB,
        storeName,
        pageId,
        (r) => (r as { data?: MessageQueueRecord } | undefined)?.data
      ),

    put: (pageId, record) => dbPut(getUserDB, storeName, { id: pageId, data: record }),

    delete: (pageId) => dbDelete(getUserDB, storeName, pageId),

    getAll: () =>
      dbGetAll<MessageQueueRecord>(getUserDB, storeName, (results) =>
        results.map((r) => (r as { data: MessageQueueRecord }).data)
      )
  }
}
