/**
 * File System Message Queue Repository
 * Workspace-level storage: {workspace}/messageQueue/{pageId}.json
 */

import type { IMessageQueueRepository, MessageQueueRecord } from '../../interfaces'
import {
  getMessageQueueDirectoryPath,
  getMessageQueueFilePath,
  isCustomWorkspacePath,
  getCurrentWorkspacePath,
  readJsonFile,
  writeJsonFile,
  deleteFile,
  listDirectory,
  ensureDirectory
} from './core'

function getFileOptions(): { allowCustomPath?: boolean } {
  const wsPath = getCurrentWorkspacePath()
  return wsPath && isCustomWorkspacePath(wsPath) ? { allowCustomPath: true } : {}
}

export function createMessageQueueRepository(): IMessageQueueRepository {
  return {
    async get(pageId: string): Promise<MessageQueueRecord | undefined> {
      const options = getFileOptions()
      const data = await readJsonFile<MessageQueueRecord>(getMessageQueueFilePath(pageId), options)
      return data ?? undefined
    },

    async put(pageId: string, record: MessageQueueRecord): Promise<void> {
      const options = getFileOptions()
      await ensureDirectory(getMessageQueueDirectoryPath(), options)
      await writeJsonFile(getMessageQueueFilePath(pageId), record, options)
    },

    async delete(pageId: string): Promise<void> {
      const options = getFileOptions()
      try {
        await deleteFile(getMessageQueueFilePath(pageId), options)
      } catch {
        // Ignore if file doesn't exist
      }
    },

    async getAll(): Promise<MessageQueueRecord[]> {
      const options = getFileOptions()
      const queueDir = getMessageQueueDirectoryPath()

      try {
        const entries = await listDirectory(queueDir, options)
        const records: MessageQueueRecord[] = []

        for (const entry of entries) {
          if (!entry.isDirectory && entry.name.endsWith('.json')) {
            const pageId = entry.name.replace('.json', '')
            const filePath = getMessageQueueFilePath(pageId)
            const record = await readJsonFile<MessageQueueRecord>(filePath, options)
            if (record) {
              records.push(record)
            }
          }
        }

        return records
      } catch {
        return []
      }
    }
  }
}
