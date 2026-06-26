/**
 * File System Message Queue Repository
 * Workspace-level storage: {workspace}/messageQueue/{pageId}.json
 */

import type { IMessageQueueRepository, MessageQueueRecord, WorkspaceScope } from '../../interfaces'
import {
  getMessageQueueDirectoryPath,
  getMessageQueueFilePath,
  getWorkspaceFileOptions,
  readJsonFile,
  writeJsonFile,
  deleteFile,
  listDirectory,
  ensureDirectory
} from './core'

export function createMessageQueueRepository(scope: WorkspaceScope): IMessageQueueRepository {
  return {
    async get(pageId: string): Promise<MessageQueueRecord | undefined> {
      const options = getWorkspaceFileOptions(scope)
      const data = await readJsonFile<MessageQueueRecord>(getMessageQueueFilePath(pageId, scope), options)
      return data ?? undefined
    },

    async put(pageId: string, record: MessageQueueRecord): Promise<void> {
      const options = getWorkspaceFileOptions(scope)
      await ensureDirectory(getMessageQueueDirectoryPath(scope), options)
      await writeJsonFile(getMessageQueueFilePath(pageId, scope), record, options)
    },

    async delete(pageId: string): Promise<void> {
      const options = getWorkspaceFileOptions(scope)
      try {
        await deleteFile(getMessageQueueFilePath(pageId, scope), options)
      } catch {
        // Ignore if file doesn't exist
      }
    },

    async getAll(): Promise<MessageQueueRecord[]> {
      const options = getWorkspaceFileOptions(scope)
      const queueDir = getMessageQueueDirectoryPath(scope)

      try {
        const entries = await listDirectory(queueDir, options)
        const records: MessageQueueRecord[] = []

        for (const entry of entries) {
          if (!entry.isDirectory && entry.name.endsWith('.json')) {
            const pageId = entry.name.replace('.json', '')
            const filePath = getMessageQueueFilePath(pageId, scope)
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
