/**
 * File System Messages Repository
 * Workspace-level storage with .pointer.md files
 * Messages are stored together with page data in the same Markdown file
 */

import type { IMessagesRepository, MessagesRecord, WorkspaceScope } from '../../interfaces'
import {
  getWorkspaceFileOptions,
  writeTextFile,
  ensureDirectory
} from './core'
import { serializePageToMarkdown, type PageFile } from './markdown'
import { findPageFile, scanAllPages } from './pagesRepository'
import { withWriteLock } from './writeLock'

function messagesRecordFromFile(file: PageFile): MessagesRecord {
  return {
    pageId: file.id,
    messages: file.messages ?? [],
    topics: file.topics ?? [],
    leafMessageId: file.leafMessageId,
    selectedMessageId: file.selectedMessageId
  }
}

export function createMessagesRepository(scope: WorkspaceScope): IMessagesRepository {
  return {
    async get(pageId: string): Promise<MessagesRecord | undefined> {
      const result = await findPageFile(pageId, scope)
      return result ? messagesRecordFromFile(result.file) : undefined
    },

    async put(pageId: string, record: MessagesRecord): Promise<void> {
      // Wrap in write lock to prevent concurrent writes for the same page
      await withWriteLock(pageId, async () => {
        const options = getWorkspaceFileOptions(scope)

        // Find existing file
        const existing = await findPageFile(pageId, scope)

        if (!existing) {
          // Page doesn't exist yet - this shouldn't normally happen
          // as pages should be created first, but handle it gracefully
          console.warn(`messagesRepository.put: Page ${pageId} not found, cannot save messages`)
          return
        }

        // Update messages in existing file
        const file: PageFile = {
          ...existing.file,
          messages: record.messages,
          topics: record.topics,
          leafMessageId: record.leafMessageId,
          selectedMessageId: record.selectedMessageId
        }

        const content = serializePageToMarkdown(file)

        // Ensure directory exists
        const targetDir = existing.path.substring(0, existing.path.lastIndexOf('/'))
        await ensureDirectory(targetDir, options)

        // Write to same path
        await writeTextFile(existing.path, content, options)
      })
    },

    async delete(pageId: string): Promise<void> {
      await withWriteLock(pageId, async () => {
        const options = getWorkspaceFileOptions(scope)

        // Find existing file
        const existing = await findPageFile(pageId, scope)

        if (existing) {
          // Clear messages but keep the page
          const file: PageFile = {
            ...existing.file,
            messages: [],
            topics: [],
            leafMessageId: undefined,
            selectedMessageId: undefined
          }

          const content = serializePageToMarkdown(file)
          await writeTextFile(existing.path, content, options)
        }
      })
    },

    async getAll(): Promise<MessagesRecord[]> {
      const allPages = await scanAllPages(scope)
      return Array.from(allPages.values()).map(({ file }) => messagesRecordFromFile(file))
    },

    async putBatch(records: MessagesRecord[]): Promise<void> {
      for (const record of records) {
        await this.put(record.pageId, record)
      }
    }
  }
}
