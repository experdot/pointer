/**
 * File System Settings Repository
 * Account-level storage: AppData/accounts/{accountId}/settings.json
 */

import type { Settings } from '../../../types/type'
import type { ISettingsRepository } from '../../interfaces'
import { getSettingsFilePath, readJsonFile, writeJsonFile, deleteFile } from './core'

export function createSettingsRepository(): ISettingsRepository {
  return {
    async get(): Promise<Settings | undefined> {
      const data = await readJsonFile<Settings>(getSettingsFilePath())
      return data ?? undefined
    },

    async put(settings: Settings): Promise<void> {
      await writeJsonFile(getSettingsFilePath(), settings)
    },

    async clear(): Promise<void> {
      try {
        await deleteFile(getSettingsFilePath())
      } catch {
        // Ignore if file doesn't exist
      }
    }
  }
}
