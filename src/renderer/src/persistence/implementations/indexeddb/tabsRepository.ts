/**
 * IndexedDB Tabs Repository Implementation
 */

import type { ITabsRepository, TabsRecord } from '../../interfaces/userData'
import { getUserDB, USER_STORES, dbGet, dbPut, dbClear } from './core'

export function createTabsRepository(): ITabsRepository {
  const storeName = USER_STORES.tabs
  const recordKey = 'tabs'

  return {
    get: () =>
      dbGet<TabsRecord>(
        getUserDB,
        storeName,
        recordKey,
        (r) => (r as { data?: TabsRecord } | undefined)?.data
      ),

    put: (tabs) => dbPut(getUserDB, storeName, { id: recordKey, data: tabs }),

    clear: () => dbClear(getUserDB, storeName)
  }
}
