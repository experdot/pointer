/**
 * File System Layout Repository
 * Account-level storage: AppData/accounts/{accountId}/layout.json
 */

import type { ILayoutRepository, LayoutRecord } from '../../interfaces'
import { getLayoutFilePath, readJsonFile, writeJsonFile, deleteFile } from './core'

export function createLayoutRepository(): ILayoutRepository {
  return {
    async get(): Promise<LayoutRecord | undefined> {
      const data = await readJsonFile<LayoutRecord>(getLayoutFilePath())
      return data ?? undefined
    },

    async put(layout: LayoutRecord): Promise<void> {
      await writeJsonFile(getLayoutFilePath(), layout)
    },

    async clear(): Promise<void> {
      try {
        await deleteFile(getLayoutFilePath())
      } catch {
        // Ignore if file doesn't exist
      }
    }
  }
}
