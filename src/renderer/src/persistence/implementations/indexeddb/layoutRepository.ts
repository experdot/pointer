/**
 * IndexedDB Layout Repository Implementation
 */

import type { ILayoutRepository, LayoutRecord } from '../../interfaces/userData'
import { getUserDB, USER_STORES, dbGet, dbPut, dbClear } from './core'

export function createLayoutRepository(): ILayoutRepository {
  const storeName = USER_STORES.layout
  const recordKey = 'layout'

  return {
    get: () =>
      dbGet<LayoutRecord>(
        getUserDB,
        storeName,
        recordKey,
        (r) => (r as { data?: LayoutRecord } | undefined)?.data
      ),

    put: (layout) => dbPut(getUserDB, storeName, { id: recordKey, data: layout }),

    clear: () => dbClear(getUserDB, storeName)
  }
}
