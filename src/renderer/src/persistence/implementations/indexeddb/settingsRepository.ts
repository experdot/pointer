/**
 * IndexedDB Settings Repository Implementation
 */

import type { Settings } from '../../../types/type'
import type { ISettingsRepository } from '../../interfaces/userData'
import { getUserDB, USER_STORES, dbGet, dbPut, dbClear } from './core'

export function createSettingsRepository(): ISettingsRepository {
  const storeName = USER_STORES.settings
  const recordKey = 'settings'

  return {
    get: () =>
      dbGet<Settings>(
        getUserDB,
        storeName,
        recordKey,
        (r) => (r as { data?: Settings } | undefined)?.data
      ),

    put: (settings) => dbPut(getUserDB, storeName, { id: recordKey, data: settings }),

    clear: () => dbClear(getUserDB, storeName)
  }
}
