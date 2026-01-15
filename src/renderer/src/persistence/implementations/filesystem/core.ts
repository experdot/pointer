/**
 * File System Persistence Core
 * Path management and file operations for persistence layer
 */

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
 * Get tabs file path (workspace level)
 */
export function getTabsFilePath(workspacePath?: string): string {
  return joinPath(getWorkspaceDataPath(workspacePath), 'tabs.json')
}

/**
 * Get pages directory path (workspace level)
 */
export function getPagesDirectoryPath(workspacePath?: string): string {
  return joinPath(getWorkspaceDataPath(workspacePath), 'pages')
}

/**
 * Get single page file path (workspace level)
 */
export function getPageFilePath(pageId: string, workspacePath?: string): string {
  return joinPath(getPagesDirectoryPath(workspacePath), `${pageId}.json`)
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
