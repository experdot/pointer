/**
 * File System Pages Repository
 * Workspace-level storage with .pointer.md files
 * Files are named by page name and organized in folder hierarchy
 * Page identity is determined by metadata inside the file
 */

import type { PageFolder } from '../../../types/type'
import type { IPageRepository, PageRecord } from '../../interfaces'
import { getPersistenceRegistry } from '../../registry'
import {
  getPagesDirectoryPath,
  buildPageFilePath,
  scanPageFiles,
  sanitizeFileName,
  isCustomWorkspacePath,
  getCurrentWorkspacePath,
  readTextFile,
  writeTextFile,
  deleteFile,
  ensureDirectory,
  pathExists
} from './core'
import { parseMarkdownPage, serializePageToMarkdown, type PageFile } from './markdown'
import { withWriteLock } from './writeLock'

// Cache for pageId -> filePath mapping
const pageFileCache: Map<string, string> = new Map()
let cacheValid = false

function getFileOptions(): { allowCustomPath?: boolean } {
  const wsPath = getCurrentWorkspacePath()
  return wsPath && isCustomWorkspacePath(wsPath) ? { allowCustomPath: true } : {}
}

/**
 * Generate a unique file path for a page
 * If the target path already exists (for a different page), adds numeric suffix
 * e.g., "MyPage.pointer.md" -> "MyPage (1).pointer.md" -> "MyPage (2).pointer.md"
 */
async function generateUniqueFilePath(
  baseName: string,
  folderPath: string | undefined,
  currentPageId: string,
  options: { allowCustomPath?: boolean }
): Promise<string> {
  const sanitizedName = sanitizeFileName(baseName)
  let targetPath = buildPageFilePath(sanitizedName, folderPath)

  // Check if file exists and belongs to a different page
  let suffix = 0
  const maxAttempts = 1000 // Prevent infinite loop

  while (suffix < maxAttempts) {
    const { exists } = await pathExists(targetPath, options)

    if (!exists) {
      // Path is available
      return targetPath
    }

    // Check if the existing file belongs to the current page
    try {
      const content = await readTextFile(targetPath, options)
      if (content) {
        const existingFile = parseMarkdownPage(content)
        if (existingFile && existingFile.id === currentPageId) {
          // This file belongs to the current page, can overwrite
          return targetPath
        }
      }
    } catch {
      // Can't read the file, assume it's not ours
    }

    // File exists and belongs to a different page, try next suffix
    suffix++
    const nameWithSuffix = `${sanitizedName} (${suffix})`
    targetPath = buildPageFilePath(nameWithSuffix, folderPath)
  }

  // Fallback: use page ID as filename (should never happen in practice)
  console.warn(`Could not generate unique filename for "${baseName}" after ${maxAttempts} attempts`)
  return buildPageFilePath(currentPageId, folderPath)
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

/**
 * Build folder path from folder ID using folder hierarchy
 */
async function buildFolderPath(folderId: string | undefined): Promise<string | undefined> {
  if (!folderId) return undefined

  // Use the registry to get the cached folder repository
  const folders = await getPersistenceRegistry().folders.getAll()
  const folderMap = new Map<string, PageFolder>()
  for (const f of folders) {
    folderMap.set(f.id, f)
  }

  // Build path by traversing up the folder hierarchy
  const pathParts: string[] = []
  let currentId: string | undefined = folderId

  while (currentId) {
    const folder = folderMap.get(currentId)
    if (!folder) break
    pathParts.unshift(sanitizeFileName(folder.name))
    currentId = folder.parentFolderId
  }

  return pathParts.length > 0 ? pathParts.join('/') : undefined
}

/**
 * Scan all page files and build cache
 */
async function scanAllPages(): Promise<Map<string, { file: PageFile; path: string }>> {
  const options = getFileOptions()
  const pagesDir = getPagesDirectoryPath()
  const results = new Map<string, { file: PageFile; path: string }>()

  try {
    const filePaths = await scanPageFiles(pagesDir, options)

    for (const filePath of filePaths) {
      try {
        const content = await readTextFile(filePath, options)
        if (!content) continue

        const file = parseMarkdownPage(content)
        if (file) {
          results.set(file.id, { file, path: filePath })
          pageFileCache.set(file.id, filePath)
        }
      } catch {
        // Skip invalid files
      }
    }

    cacheValid = true
  } catch {
    // Directory doesn't exist yet
  }

  return results
}

/**
 * Find page file by ID (uses cache if valid)
 */
async function findPageFile(pageId: string): Promise<{ file: PageFile; path: string } | null> {
  const options = getFileOptions()

  // Try cache first
  if (cacheValid && pageFileCache.has(pageId)) {
    const cachedPath = pageFileCache.get(pageId)!
    try {
      const content = await readTextFile(cachedPath, options)
      if (content) {
        const file = parseMarkdownPage(content)
        if (file && file.id === pageId) {
          return { file, path: cachedPath }
        }
      }
    } catch {
      // Cache miss, file moved or deleted
    }
    // Remove invalid cache entry
    pageFileCache.delete(pageId)
  }

  // Scan all files to find the page
  const allPages = await scanAllPages()
  const result = allPages.get(pageId)
  return result ?? null
}

/**
 * Invalidate cache (call when workspace changes)
 */
export function invalidatePageCache(): void {
  pageFileCache.clear()
  cacheValid = false
}

export function createPageRepository(): IPageRepository {
  return {
    async getAll(): Promise<PageRecord[]> {
      const allPages = await scanAllPages()
      return Array.from(allPages.values()).map(({ file }) => pageRecordFromFile(file))
    },

    async getById(id: string): Promise<PageRecord | undefined> {
      const result = await findPageFile(id)
      return result ? pageRecordFromFile(result.file) : undefined
    },

    async put(page: PageRecord): Promise<void> {
      // Wrap in write lock to prevent concurrent writes for the same page
      await withWriteLock(page.id, async () => {
        const options = getFileOptions()

        // Find existing file
        const existing = await findPageFile(page.id)

        // Build target path based on page name and folder
        // Uses unique path generation to handle filename conflicts
        const folderPath = await buildFolderPath(page.parentFolderId)
        const targetPath = await generateUniqueFilePath(page.name, folderPath, page.id, options)

        // Prepare file content
        const file: PageFile = {
          ...page,
          messages: existing?.file.messages ?? [],
          topics: existing?.file.topics ?? [],
          leafMessageId: existing?.file.leafMessageId,
          selectedMessageId: existing?.file.selectedMessageId
        }

        const content = serializePageToMarkdown(file)

        // Ensure target directory exists
        const targetDir = targetPath.substring(0, targetPath.lastIndexOf('/'))
        await ensureDirectory(targetDir, options)

        // Delete old file if path changed
        if (existing && existing.path !== targetPath) {
          try {
            await deleteFile(existing.path, options)
          } catch {
            // Ignore deletion errors
          }
        }

        // Write to new path
        await writeTextFile(targetPath, content, options)

        // Update cache
        pageFileCache.set(page.id, targetPath)
      })
    },

    async putBatch(pages: PageRecord[]): Promise<void> {
      for (const page of pages) {
        await this.put(page)
      }
    },

    async delete(id: string): Promise<void> {
      const options = getFileOptions()
      const result = await findPageFile(id)

      if (result) {
        try {
          await deleteFile(result.path, options)
        } catch {
          // Ignore if file doesn't exist
        }
        pageFileCache.delete(id)
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
      invalidatePageCache()
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

// Re-export PageFile type for messagesRepository
export type { PageFile }
// Export findPageFile for messagesRepository
export { findPageFile, scanAllPages }
