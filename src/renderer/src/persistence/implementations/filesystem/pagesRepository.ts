/**
 * File System Pages Repository
 * Workspace-level storage with .pointer.md files
 * Files are named by page name and organized in folder hierarchy
 * Page identity is determined by metadata inside the file
 */

import type { PageFolder } from '../../../types/type'
import type { IPageRepository, PageRecord, WorkspaceScope } from '../../interfaces'
import { getPersistenceRegistry } from '../../registry'
import {
  getPagesDirectoryPath,
  buildPageFilePath,
  scanPageFiles,
  sanitizeFileName,
  getWorkspaceFileOptions,
  getMessageQueueFilePath,
  readTextFile,
  writeTextFile,
  deleteFile,
  ensureDirectory,
  pathExists
} from './core'
import { parseMarkdownPage, serializePageToMarkdown, type PageFile } from './markdown'
import { withWriteLock } from './writeLock'

// Cache for pageId -> filePath mapping
const pageFileCache = new Map<string, Map<string, string>>()
const validWorkspaceCache = new Set<string>()

/**
 * Generate a unique file path for a page
 * If the target path already exists (for a different page), adds numeric suffix
 * e.g., "MyPage.pointer.md" -> "MyPage (1).pointer.md" -> "MyPage (2).pointer.md"
 */
async function generateUniqueFilePath(
  baseName: string,
  folderPath: string | undefined,
  currentPageId: string,
  scope: WorkspaceScope,
  options: { allowCustomPath?: boolean }
): Promise<string> {
  const sanitizedName = sanitizeFileName(baseName)
  let targetPath = buildPageFilePath(sanitizedName, folderPath, scope)

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
    targetPath = buildPageFilePath(nameWithSuffix, folderPath, scope)
  }

  // Fallback: use page ID as filename (should never happen in practice)
  console.warn(`Could not generate unique filename for "${baseName}" after ${maxAttempts} attempts`)
  return buildPageFilePath(currentPageId, folderPath, scope)
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
function getWorkspaceKey(scope: WorkspaceScope): string {
  return scope.workspacePath
}

function getWorkspaceCache(scope: WorkspaceScope): Map<string, string> {
  const key = getWorkspaceKey(scope)
  let cache = pageFileCache.get(key)
  if (!cache) {
    cache = new Map<string, string>()
    pageFileCache.set(key, cache)
  }
  return cache
}

async function scanAllPages(scope: WorkspaceScope): Promise<Map<string, { file: PageFile; path: string }>> {
  const options = getWorkspaceFileOptions(scope)
  const pagesDir = getPagesDirectoryPath(scope)
  const results = new Map<string, { file: PageFile; path: string }>()
  const cache = getWorkspaceCache(scope)

  try {
    const filePaths = await scanPageFiles(pagesDir, options)

    for (const filePath of filePaths) {
      try {
        const content = await readTextFile(filePath, options)
        if (!content) continue

        const file = parseMarkdownPage(content)
        if (file) {
          results.set(file.id, { file, path: filePath })
          cache.set(file.id, filePath)
        }
      } catch {
        // Skip invalid files
      }
    }

    validWorkspaceCache.add(getWorkspaceKey(scope))
  } catch {
    // Directory doesn't exist yet
  }

  return results
}

/**
 * Find page file by ID (uses cache if valid)
 */
async function findPageFile(
  pageId: string,
  scope: WorkspaceScope
): Promise<{ file: PageFile; path: string } | null> {
  const options = getWorkspaceFileOptions(scope)
  const key = getWorkspaceKey(scope)
  const cache = getWorkspaceCache(scope)

  // Try cache first
  if (validWorkspaceCache.has(key) && cache.has(pageId)) {
    const cachedPath = cache.get(pageId)!
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
    cache.delete(pageId)
  }

  // Scan all files to find the page
  const allPages = await scanAllPages(scope)
  const result = allPages.get(pageId)
  return result ?? null
}

/**
 * Invalidate cache (call when workspace changes)
 */
export function invalidatePageCache(workspacePath?: string): void {
  if (workspacePath) {
    pageFileCache.delete(workspacePath)
    validWorkspaceCache.delete(workspacePath)
    return
  }
  pageFileCache.clear()
  validWorkspaceCache.clear()
}

export function createPageRepository(scope: WorkspaceScope): IPageRepository {
  return {
    async getAll(): Promise<PageRecord[]> {
      const allPages = await scanAllPages(scope)
      return Array.from(allPages.values()).map(({ file }) => pageRecordFromFile(file))
    },

    async getById(id: string): Promise<PageRecord | undefined> {
      const result = await findPageFile(id, scope)
      return result ? pageRecordFromFile(result.file) : undefined
    },

    async put(page: PageRecord): Promise<void> {
      // Wrap in write lock to prevent concurrent writes for the same page
      await withWriteLock(page.id, async () => {
        const options = getWorkspaceFileOptions(scope)

        // Find existing file
        const existing = await findPageFile(page.id, scope)

        // Build target path based on page name and folder
        // Uses unique path generation to handle filename conflicts
        const folderPath = await buildFolderPath(page.parentFolderId)
        const targetPath = await generateUniqueFilePath(page.name, folderPath, page.id, scope, options)

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
        getWorkspaceCache(scope).set(page.id, targetPath)
      })
    },

    async putBatch(pages: PageRecord[]): Promise<void> {
      for (const page of pages) {
        await this.put(page)
      }
    },

    async delete(id: string): Promise<void> {
      const options = getWorkspaceFileOptions(scope)
      const result = await findPageFile(id, scope)

      if (result) {
        try {
          await deleteFile(result.path, options)
        } catch {
          // Ignore if file doesn't exist
        }
        getWorkspaceCache(scope).delete(id)
      }

      try {
        await deleteFile(getMessageQueueFilePath(id, scope), options)
      } catch {
        // Ignore if queue file doesn't exist
      }
    },

    async deleteBatch(ids: string[]): Promise<void> {
      for (const id of ids) {
        await this.delete(id)
      }
    },

    async clear(): Promise<void> {
      const options = getWorkspaceFileOptions(scope)
      try {
        await deleteFile(getPagesDirectoryPath(scope), { ...options, recursive: true })
        await ensureDirectory(getPagesDirectoryPath(scope), options)
      } catch {
        // Ignore errors
      }
      invalidatePageCache(scope.workspacePath)
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
