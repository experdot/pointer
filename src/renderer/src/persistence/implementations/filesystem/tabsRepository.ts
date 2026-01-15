/**
 * File System Tabs Repository
 * Workspace-level storage: {workspace}/tabs.json
 */

import type { ITabsRepository, TabsRecord } from '../../interfaces'
import {
  getTabsFilePath,
  isCustomWorkspacePath,
  getCurrentWorkspacePath,
  readJsonFile,
  writeJsonFile,
  deleteFile
} from './core'

function getFileOptions(): { allowCustomPath?: boolean } {
  const wsPath = getCurrentWorkspacePath()
  return wsPath && isCustomWorkspacePath(wsPath) ? { allowCustomPath: true } : {}
}

export function createTabsRepository(): ITabsRepository {
  return {
    async get(): Promise<TabsRecord | undefined> {
      const options = getFileOptions()
      const data = await readJsonFile<TabsRecord>(getTabsFilePath(), options)
      return data ?? undefined
    },

    async put(tabs: TabsRecord): Promise<void> {
      const options = getFileOptions()
      await writeJsonFile(getTabsFilePath(), tabs, options)
    },

    async clear(): Promise<void> {
      const options = getFileOptions()
      try {
        await deleteFile(getTabsFilePath(), options)
      } catch {
        // Ignore if file doesn't exist
      }
    }
  }
}
