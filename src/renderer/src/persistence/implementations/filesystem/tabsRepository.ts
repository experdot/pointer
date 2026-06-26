/**
 * File System Tabs Repository
 * Workspace-level storage: {workspace}/tabs.json
 */

import type { ITabsRepository, TabsRecord, WorkspaceScope } from '../../interfaces'
import {
  getTabsFilePath,
  getWorkspaceFileOptions,
  readJsonFile,
  writeJsonFile,
  deleteFile
} from './core'

export function createTabsRepository(scope: WorkspaceScope): ITabsRepository {
  return {
    async get(): Promise<TabsRecord | undefined> {
      const options = getWorkspaceFileOptions(scope)
      const data = await readJsonFile<TabsRecord>(getTabsFilePath(scope), options)
      return data ?? undefined
    },

    async put(tabs: TabsRecord): Promise<void> {
      const options = getWorkspaceFileOptions(scope)
      await writeJsonFile(getTabsFilePath(scope), tabs, options)
    },

    async clear(): Promise<void> {
      const options = getWorkspaceFileOptions(scope)
      try {
        await deleteFile(getTabsFilePath(scope), options)
      } catch {
        // Ignore if file doesn't exist
      }
    }
  }
}
