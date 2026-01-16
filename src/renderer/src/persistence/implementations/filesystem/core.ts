/**
 * File System Persistence Core
 * Path management and file operations for persistence layer
 */

// ==================== Constants ====================

export const PAGE_FILE_EXTENSION = '.pointer.md'

// ==================== Path Utilities ====================

/**
 * Simple cross-platform path join
 * Works in browser environment without Node.js path module
 */
function joinPath(...parts: string[]): string {
  return parts
    .map((part, index) => {
      // Remove leading slashes except for first part
      if (index > 0) {
        part = part.replace(/^[/\\]+/, '')
      }
      // Remove trailing slashes
      return part.replace(/[/\\]+$/, '')
    })
    .filter((part) => part.length > 0)
    .join('/')
}

// ==================== Path State ====================

let appDataPath: string | null = null
let currentAccountId: string | null = null
let currentWorkspacePath: string | null = null

// ==================== Path Initialization ====================

/**
 * Initialize app data path (call once at startup)
 */
export async function initAppDataPath(): Promise<string> {
  if (!appDataPath) {
    appDataPath = await window.api.fs.getAppDataPath()
  }
  return appDataPath
}

/**
 * Get the app data path (must be initialized first)
 */
export function getAppDataPath(): string {
  if (!appDataPath) {
    throw new Error('App data path not initialized. Call initAppDataPath() first.')
  }
  return appDataPath
}

// ==================== Account Path Management ====================

/**
 * Set current account ID and update paths
 */
export function setCurrentAccount(accountId: string): void {
  currentAccountId = accountId
  // Reset workspace path when account changes
  currentWorkspacePath = null
}

/**
 * Get current account ID
 */
export function getCurrentAccountId(): string | null {
  return currentAccountId
}

/**
 * Get account directory path
 */
export function getAccountPath(accountId?: string): string {
  const id = accountId ?? currentAccountId
  if (!id) {
    throw new Error('No account ID specified and no current account set')
  }
  return joinPath(getAppDataPath(), 'accounts', id)
}

/**
 * Get accounts list file path
 */
export function getAccountsFilePath(): string {
  return joinPath(getAppDataPath(), 'accounts.json')
}

// ==================== Workspace Path Management ====================

/**
 * Set current workspace path
 */
export function setCurrentWorkspace(workspacePath: string): void {
  currentWorkspacePath = workspacePath
}

/**
 * Get current workspace path
 */
export function getCurrentWorkspacePath(): string | null {
  return currentWorkspacePath
}

/**
 * Get default workspace path for an account
 */
export function getDefaultWorkspacePath(accountId?: string): string {
  return joinPath(getAccountPath(accountId), 'workspaces', 'default')
}

/**
 * Get workspaces list file path for an account
 */
export function getWorkspacesFilePath(accountId?: string): string {
  return joinPath(getAccountPath(accountId), 'workspaces.json')
}

/**
 * Get workspace data directory path (for user data: pages, folders, tabs)
 * For default workspace: account/workspaces/default/
 * For custom workspace: {custom-path}/ (root directory)
 */
export function getWorkspaceDataPath(workspacePath?: string): string {
  const wsPath = workspacePath ?? currentWorkspacePath
  if (!wsPath) {
    throw new Error('No workspace path specified and no current workspace set')
  }
  // Both default and custom workspaces store user data directly in workspace root
  return wsPath
}

/**
 * Get workspace internal directory path (for config/cache: workspace.json, messageQueue, attachments)
 * Always uses .pointer subdirectory for both default and custom workspaces
 */
export function getWorkspaceInternalPath(workspacePath?: string): string {
  const wsPath = workspacePath ?? currentWorkspacePath
  if (!wsPath) {
    throw new Error('No workspace path specified and no current workspace set')
  }

  // Both default and custom workspaces use .pointer for internal data
  return joinPath(wsPath, '.pointer')
}

/**
 * Check if workspace path is a default workspace (inside account directory)
 */
export function isDefaultWorkspace(wsPath: string): boolean {
  const accountPath = currentAccountId ? getAccountPath() : null
  return !!accountPath && wsPath.startsWith(accountPath)
}

// ==================== File Paths ====================

/**
 * Get settings file path (account level)
 */
export function getSettingsFilePath(accountId?: string): string {
  return joinPath(getAccountPath(accountId), 'settings.json')
}

/**
 * Get layout file path (account level)
 */
export function getLayoutFilePath(accountId?: string): string {
  return joinPath(getAccountPath(accountId), 'layout.json')
}

/**
 * Get folders file path (workspace level)
 */
export function getFoldersFilePath(workspacePath?: string): string {
  return joinPath(getWorkspaceDataPath(workspacePath), 'folders.json')
}

/**
 * Get tabs file path (workspace level - internal)
 */
export function getTabsFilePath(workspacePath?: string): string {
  return joinPath(getWorkspaceInternalPath(workspacePath), 'tabs.json')
}

/**
 * Get pages directory path (workspace level)
 */
export function getPagesDirectoryPath(workspacePath?: string): string {
  return joinPath(getWorkspaceDataPath(workspacePath), 'pages')
}

// Windows reserved names (case-insensitive)
const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
])

// Max filename length (leave room for extension and suffix)
const MAX_FILENAME_LENGTH = 200

/**
 * Sanitize file name - remove/replace invalid characters
 * Handles:
 * - Invalid characters: < > : " / \ | ? *
 * - Control characters (ASCII 0-31)
 * - Leading/trailing spaces and dots
 * - Windows reserved names (CON, PRN, etc.)
 * - Filename length limits
 */
export function sanitizeFileName(name: string): string {
  let result = name
    // Remove control characters (ASCII 0-31)
    .replace(/[\x00-\x1f]/g, '')
    // Replace invalid characters with underscore
    .replace(/[<>:"/\\|?*]/g, '_')
    // Normalize multiple spaces to single space
    .replace(/\s+/g, ' ')
    // Remove leading/trailing spaces and dots
    .replace(/^[\s.]+|[\s.]+$/g, '')

  // Check for empty result
  if (!result) {
    return 'Untitled'
  }

  // Check for Windows reserved names (case-insensitive)
  const upperName = result.toUpperCase()
  // Handle cases like "CON" or "CON.txt" -> "_CON" or "_CON.txt"
  const baseName = upperName.split('.')[0]
  if (WINDOWS_RESERVED_NAMES.has(baseName)) {
    result = '_' + result
  }

  // Truncate if too long (leave room for suffix like " (99)")
  if (result.length > MAX_FILENAME_LENGTH) {
    result = result.substring(0, MAX_FILENAME_LENGTH).trimEnd()
  }

  return result
}

/**
 * Build page file path from page name and optional folder path
 * @param pageName - The page name (will be sanitized)
 * @param folderPath - Optional relative folder path within pages directory
 */
export function buildPageFilePath(
  pageName: string,
  folderPath?: string,
  workspacePath?: string
): string {
  const sanitizedName = sanitizeFileName(pageName)
  const fileName = `${sanitizedName}${PAGE_FILE_EXTENSION}`
  const pagesDir = getPagesDirectoryPath(workspacePath)

  if (folderPath) {
    return joinPath(pagesDir, folderPath, fileName)
  }
  return joinPath(pagesDir, fileName)
}

/**
 * Recursively scan directory for .pointer.md files
 * Returns array of file paths relative to start directory
 */
export async function scanPageFiles(
  dirPath: string,
  options?: { allowCustomPath?: boolean }
): Promise<string[]> {
  const results: string[] = []

  async function scanDir(currentPath: string): Promise<void> {
    try {
      const entries = await listDirectory(currentPath, options)

      for (const entry of entries) {
        const entryPath = joinPath(currentPath, entry.name)

        if (entry.isDirectory) {
          // Skip hidden directories
          if (!entry.name.startsWith('.')) {
            await scanDir(entryPath)
          }
        } else if (entry.name.endsWith(PAGE_FILE_EXTENSION)) {
          results.push(entryPath)
        }
      }
    } catch {
      // Directory doesn't exist or can't be read, skip
    }
  }

  await scanDir(dirPath)
  return results
}

/**
 * @deprecated Use buildPageFilePath instead - pages can now be anywhere
 * Get single page file path by ID (legacy - for migration only)
 */
export function getPageFilePath(pageId: string, workspacePath?: string): string {
  return joinPath(getPagesDirectoryPath(workspacePath), `${pageId}${PAGE_FILE_EXTENSION}`)
}

/**
 * Get message queue directory path (workspace level - internal/cache)
 */
export function getMessageQueueDirectoryPath(workspacePath?: string): string {
  return joinPath(getWorkspaceInternalPath(workspacePath), 'messageQueue')
}

/**
 * Get single message queue file path (workspace level)
 */
export function getMessageQueueFilePath(pageId: string, workspacePath?: string): string {
  return joinPath(getMessageQueueDirectoryPath(workspacePath), `${pageId}.json`)
}

/**
 * Get attachments directory path (workspace level - internal/cache)
 */
export function getAttachmentsDirectoryPath(workspacePath?: string): string {
  return joinPath(getWorkspaceInternalPath(workspacePath), 'attachments')
}

/**
 * Get workspace config file path (for custom workspaces)
 */
export function getWorkspaceConfigFilePath(workspacePath: string): string {
  return joinPath(workspacePath, '.pointer', 'workspace.json')
}

// ==================== File Operations ====================

/**
 * Check if path is a custom workspace (not inside account directory)
 */
export function isCustomWorkspacePath(wsPath: string): boolean {
  return !isDefaultWorkspace(wsPath)
}

/**
 * Read JSON file with type safety
 */
export async function readJsonFile<T>(
  filePath: string,
  options?: { allowCustomPath?: boolean }
): Promise<T | null> {
  const result = await window.api.fs.readJson<T>(filePath, options)
  if (!result.success) {
    if (result.error === 'FILE_NOT_FOUND') {
      return null
    }
    throw new Error(result.error)
  }
  return result.data ?? null
}

/**
 * Write JSON file
 */
export async function writeJsonFile(
  filePath: string,
  data: unknown,
  options?: { allowCustomPath?: boolean }
): Promise<void> {
  const result = await window.api.fs.writeJson(filePath, data, options)
  if (!result.success) {
    throw new Error(result.error)
  }
}

/**
 * Delete file or directory
 */
export async function deleteFile(
  filePath: string,
  options?: { allowCustomPath?: boolean; recursive?: boolean }
): Promise<void> {
  const result = await window.api.fs.delete(filePath, options)
  if (!result.success) {
    throw new Error(result.error)
  }
}

/**
 * Ensure directory exists
 */
export async function ensureDirectory(
  dirPath: string,
  options?: { allowCustomPath?: boolean }
): Promise<void> {
  const result = await window.api.fs.ensureDir(dirPath, options)
  if (!result.success) {
    throw new Error(result.error)
  }
}

/**
 * Check if path exists
 */
export async function pathExists(
  targetPath: string,
  options?: { allowCustomPath?: boolean }
): Promise<{ exists: boolean; isDirectory?: boolean }> {
  const result = await window.api.fs.exists(targetPath, options)
  if (!result.success) {
    throw new Error(result.error)
  }
  return { exists: result.exists ?? false, isDirectory: result.isDirectory }
}

/**
 * List directory contents
 */
export async function listDirectory(
  dirPath: string,
  options?: { allowCustomPath?: boolean }
): Promise<Array<{ name: string; isDirectory: boolean }>> {
  const result = await window.api.fs.listDir(dirPath, options)
  if (!result.success) {
    throw new Error(result.error)
  }
  return result.entries ?? []
}

/**
 * Read text file
 */
export async function readTextFile(
  filePath: string,
  options?: { allowCustomPath?: boolean }
): Promise<string | null> {
  const result = await window.api.fs.readText(filePath, options)
  if (!result.success) {
    if (result.error === 'FILE_NOT_FOUND') {
      return null
    }
    throw new Error(result.error)
  }
  return result.content ?? null
}

/**
 * Write text file
 */
export async function writeTextFile(
  filePath: string,
  content: string,
  options?: { allowCustomPath?: boolean }
): Promise<void> {
  const result = await window.api.fs.writeText(filePath, content, options)
  if (!result.success) {
    throw new Error(result.error)
  }
}
