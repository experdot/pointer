/**
 * File System Pages Repository
 * Workspace-level storage: {workspace}/pages/{pageId}.json
 * Each page file contains PageRecord + MessagesRecord combined
 */

import type { IPageRepository, PageRecord, MessagesRecord } from '../../interfaces'
import {
  getPagesDirectoryPath,
  getPageFilePath,
  isCustomWorkspacePath,
  getCurrentWorkspacePath,
  readJsonFile,
  writeJsonFile,
  deleteFile,
  listDirectory,
  ensureDirectory
} from './core'

/** Combined page file structure */
export interface PageFile extends PageRecord {
  messages: MessagesRecord['messages']
  topics: MessagesRecord['topics']
  rootMessageId?: string
  leafMessageId?: string
  selectedMessageId?: string
}

function pageRecordFromFile(file: PageFile): PageRecord {
  return {
    id: file.id,
    type: file.type,
    name: file.name,
    parentFolderId: file.parentFolderId,
    order: file.order,
    starred: file.starred,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt
  }
}

function getFileOptions(): { allowCustomPath?: boolean } {
  const wsPath = getCurrentWorkspacePath()
  return wsPath && isCustomWorkspacePath(wsPath) ? { allowCustomPath: true } : {}
}

export function createPageRepository(): IPageRepository {
  return {
    async getAll(): Promise<PageRecord[]> {
      const options = getFileOptions()
      const pagesDir = getPagesDirectoryPath()

      try {
        const entries = await listDirectory(pagesDir, options)
        const pages: PageRecord[] = []

        for (const entry of entries) {
          if (!entry.isDirectory && entry.name.endsWith('.json')) {
            const pageId = entry.name.replace('.json', '')
            const filePath = getPageFilePath(pageId)
            const file = await readJsonFile<PageFile>(filePath, options)
            if (file) {
              pages.push(pageRecordFromFile(file))
            }
          }
        }

        return pages
      } catch {
        return []
      }
    },

    async getById(id: string): Promise<PageRecord | undefined> {
      const options = getFileOptions()
      const file = await readJsonFile<PageFile>(getPageFilePath(id), options)
      return file ? pageRecordFromFile(file) : undefined
    },

    async put(page: PageRecord): Promise<void> {
      const options = getFileOptions()
      const filePath = getPageFilePath(page.id)

      // Read existing file to preserve messages
      const existing = await readJsonFile<PageFile>(filePath, options)

      const file: PageFile = {
        ...page,
        messages: existing?.messages ?? [],
        topics: existing?.topics ?? [],
        rootMessageId: existing?.rootMessageId,
        leafMessageId: existing?.leafMessageId,
        selectedMessageId: existing?.selectedMessageId
      }

      // Ensure pages directory exists
      await ensureDirectory(getPagesDirectoryPath(), options)
      await writeJsonFile(filePath, file, options)
    },

    async putBatch(pages: PageRecord[]): Promise<void> {
      for (const page of pages) {
        await this.put(page)
      }
    },

    async delete(id: string): Promise<void> {
      const options = getFileOptions()
      try {
        await deleteFile(getPageFilePath(id), options)
      } catch {
        // Ignore if file doesn't exist
      }
    },

    async deleteBatch(ids: string[]): Promise<void> {
      for (const id of ids) {
        await this.delete(id)
      }
    },

    async clear(): Promise<void> {
      const options = getFileOptions()
      try {
        await deleteFile(getPagesDirectoryPath(), { ...options, recursive: true })
        await ensureDirectory(getPagesDirectoryPath(), options)
      } catch {
        // Ignore errors
      }
    },

    async deleteWithMessages(id: string): Promise<void> {
      // Messages are stored in the same file, so just delete the page file
      await this.delete(id)
    },

    async deleteWithMessagesBatch(ids: string[]): Promise<void> {
      await this.deleteBatch(ids)
    },

    async clearAllWithMessages(): Promise<void> {
      await this.clear()
    }
  }
}
