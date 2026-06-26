/**
 * File System Settings Repository
 * Account-level storage: AppData/accounts/{accountId}/settings.json
 */

import type { Settings } from '../../../types/type'
import type { AccountScope, ISettingsRepository } from '../../interfaces'
import { getSettingsFilePath, readJsonFile, writeJsonFile, deleteFile } from './core'

export function createSettingsRepository(scope: AccountScope): ISettingsRepository {
  return {
    async get(): Promise<Settings | undefined> {
      const data = await readJsonFile<Settings>(getSettingsFilePath(scope))
      return data ?? undefined
    },

    async put(settings: Settings): Promise<void> {
      await writeJsonFile(getSettingsFilePath(scope), settings)
    },

    async clear(): Promise<void> {
      try {
        await deleteFile(getSettingsFilePath(scope))
      } catch {
        // Ignore if file doesn't exist
      }
    }
  }
}
