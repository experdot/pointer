/**
 * File System Messages Repository
 * Workspace-level storage: {workspace}/pages/{pageId}.json
 * Messages are stored together with page data in the same file
 */

import type { IMessagesRepository, MessagesRecord } from '../../interfaces'
import type { PageFile } from './pagesRepository'
import {
  getPageFilePath,
  getPagesDirectoryPath,
  isCustomWorkspacePath,
  getCurrentWorkspacePath,
  readJsonFile,
  writeJsonFile,
  listDirectory,
  ensureDirectory
} from './core'

function getFileOptions(): { allowCustomPath?: boolean } {
  const wsPath = getCurrentWorkspacePath()
  return wsPath && isCustomWorkspacePath(wsPath) ? { allowCustomPath: true } : {}
}

function messagesRecordFromFile(file: PageFile): MessagesRecord {
  return {
    pageId: file.id,
    messages: file.messages ?? [],
    topics: file.topics ?? [],
    rootMessageId: file.rootMessageId,
    leafMessageId: file.leafMessageId,
    selectedMessageId: file.selectedMessageId
  }
}

export function createMessagesRepository(): IMessagesRepository {
  return {
    async get(pageId: string): Promise<MessagesRecord | undefined> {
      const options = getFileOptions()
      const file = await readJsonFile<PageFile>(getPageFilePath(pageId), options)
      return file ? messagesRecordFromFile(file) : undefined
    },

    async put(pageId: string, record: MessagesRecord): Promise<void> {
      const options = getFileOptions()
      const filePath = getPageFilePath(pageId)

      // Read existing file to preserve page metadata
      const existing = await readJsonFile<PageFile>(filePath, options)

      if (!existing) {
        // Page doesn't exist yet, create minimal page record
        const file: PageFile = {
          id: pageId,
          type: 'item',
          name: 'Untitled',
          createdAt: Date.now(),
          messages: record.messages,
          topics: record.topics,
          rootMessageId: record.rootMessageId,
          leafMessageId: record.leafMessageId,
          selectedMessageId: record.selectedMessageId
        }
        await ensureDirectory(getPagesDirectoryPath(), options)
        await writeJsonFile(filePath, file, options)
      } else {
        // Update messages in existing file
        const file: PageFile = {
          ...existing,
          messages: record.messages,
          topics: record.topics,
          rootMessageId: record.rootMessageId,
          leafMessageId: record.leafMessageId,
          selectedMessageId: record.selectedMessageId
        }
        await writeJsonFile(filePath, file, options)
      }
    },

    async delete(pageId: string): Promise<void> {
      // Messages are deleted when page is deleted
      // This is a no-op since we don't want to delete the page file
      // If you want to clear messages but keep the page:
      const options = getFileOptions()
      const filePath = getPageFilePath(pageId)
      const existing = await readJsonFile<PageFile>(filePath, options)

      if (existing) {
        const file: PageFile = {
          ...existing,
          messages: [],
          topics: [],
          rootMessageId: undefined,
          leafMessageId: undefined,
          selectedMessageId: undefined
        }
        await writeJsonFile(filePath, file, options)
      }
    },

    async getAll(): Promise<MessagesRecord[]> {
      const options = getFileOptions()
      const pagesDir = getPagesDirectoryPath()

      try {
        const entries = await listDirectory(pagesDir, options)
        const records: MessagesRecord[] = []

        for (const entry of entries) {
          if (!entry.isDirectory && entry.name.endsWith('.json')) {
            const pageId = entry.name.replace('.json', '')
            const filePath = getPageFilePath(pageId)
            const file = await readJsonFile<PageFile>(filePath, options)
            if (file) {
              records.push(messagesRecordFromFile(file))
            }
          }
        }

        return records
      } catch {
        return []
      }
    },

    async putBatch(records: MessagesRecord[]): Promise<void> {
      for (const record of records) {
        await this.put(record.pageId, record)
      }
    }
  }
}
