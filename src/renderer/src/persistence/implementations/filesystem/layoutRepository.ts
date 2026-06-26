/**
 * File System Layout Repository
 * Account-level storage: AppData/accounts/{accountId}/layout.json
 */

import type { AccountScope, ILayoutRepository, LayoutRecord } from '../../interfaces'
import { getLayoutFilePath, readJsonFile, writeJsonFile, deleteFile } from './core'

export function createLayoutRepository(scope: AccountScope): ILayoutRepository {
  return {
    async get(): Promise<LayoutRecord | undefined> {
      const data = await readJsonFile<LayoutRecord>(getLayoutFilePath(scope))
      return data ?? undefined
    },

    async put(layout: LayoutRecord): Promise<void> {
      await writeJsonFile(getLayoutFilePath(scope), layout)
    },

    async clear(): Promise<void> {
      try {
        await deleteFile(getLayoutFilePath(scope))
      } catch {
        // Ignore if file doesn't exist
      }
    }
  }
}
