/**
 * File System Workspace Repository
 * Account-level storage: AppData/accounts/{accountId}/workspaces.json
 */

import type {
  Workspace,
  WorkspaceMetadata,
  WorkspaceListFile,
  WorkspaceConfigFile,
  ValidateWorkspaceResult
} from '../../../types/workspace'
import {
  getWorkspacesFilePath,
  getDefaultWorkspacePath,
  getWorkspaceConfigFilePath,
  getCurrentAccountId,
  readJsonFile,
  writeJsonFile,
  ensureDirectory,
  pathExists
} from './core'

const DEFAULT_WORKSPACES_FILE: WorkspaceListFile = {
  currentWorkspaceId: null,
  workspaces: []
}

async function readWorkspacesFile(): Promise<WorkspaceListFile> {
  const data = await readJsonFile<WorkspaceListFile>(getWorkspacesFilePath())
  return data ?? DEFAULT_WORKSPACES_FILE
}

async function writeWorkspacesFile(data: WorkspaceListFile): Promise<void> {
  await writeJsonFile(getWorkspacesFilePath(), data)
}

export interface IWorkspaceRepository {
  /** Get all workspaces for current account */
  getAll(): Promise<WorkspaceMetadata[]>

  /** Get workspace by ID */
  getById(id: string): Promise<Workspace | undefined>

  /** Create or update workspace */
  put(workspace: Workspace): Promise<void>

  /** Delete workspace (does not delete files for custom workspaces) */
  delete(id: string): Promise<void>

  /** Get current workspace ID */
  getCurrentWorkspaceId(): Promise<string | null>

  /** Set current workspace ID */
  setCurrentWorkspaceId(id: string | null): Promise<void>

  /** Initialize default workspace for account */
  initDefaultWorkspace(): Promise<Workspace>

  /** Validate a directory path for workspace usage */
  validateWorkspacePath(dirPath: string): Promise<ValidateWorkspaceResult>

  /** Initialize a custom workspace in given directory */
  initCustomWorkspace(dirPath: string, name: string): Promise<Workspace>
}

export function createWorkspaceRepository(): IWorkspaceRepository {
  return {
    async getAll(): Promise<WorkspaceMetadata[]> {
      const file = await readWorkspacesFile()
      return file.workspaces
    },

    async getById(id: string): Promise<Workspace | undefined> {
      const file = await readWorkspacesFile()
      const metadata = file.workspaces.find((w) => w.id === id)

      if (!metadata) {
        return undefined
      }

      const accountId = getCurrentAccountId()
      if (!accountId) {
        throw new Error('No current account set')
      }

      // For custom workspaces, read additional info from workspace.json
      if (metadata.type === 'custom') {
        const configPath = getWorkspaceConfigFilePath(metadata.path)
        const config = await readJsonFile<WorkspaceConfigFile>(configPath, {
          allowCustomPath: true
        })

        if (config) {
          return {
            ...metadata,
            accountId: config.accountId,
            createdAt: config.createdAt,
            updatedAt: config.updatedAt
          }
        }
      }

      // For default workspace, construct from known values
      return {
        ...metadata,
        accountId,
        createdAt: Date.now() // Will be overwritten if file exists
      }
    },

    async put(workspace: Workspace): Promise<void> {
      const file = await readWorkspacesFile()
      const metadata: WorkspaceMetadata = {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
        path: workspace.path
      }

      const index = file.workspaces.findIndex((w) => w.id === workspace.id)
      if (index >= 0) {
        file.workspaces[index] = metadata
      } else {
        file.workspaces.push(metadata)
      }

      await writeWorkspacesFile(file)

      // For custom workspaces, also write workspace.json in the directory
      if (workspace.type === 'custom') {
        const config: WorkspaceConfigFile = {
          id: workspace.id,
          accountId: workspace.accountId,
          name: workspace.name,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt
        }
        await writeJsonFile(getWorkspaceConfigFilePath(workspace.path), config, {
          allowCustomPath: true
        })
      }
    },

    async delete(id: string): Promise<void> {
      const file = await readWorkspacesFile()
      const workspace = file.workspaces.find((w) => w.id === id)

      if (!workspace) {
        return
      }

      // Don't allow deleting default workspace
      if (workspace.type === 'default') {
        throw new Error('Cannot delete default workspace')
      }

      file.workspaces = file.workspaces.filter((w) => w.id !== id)

      if (file.currentWorkspaceId === id) {
        // Switch to default workspace
        const defaultWs = file.workspaces.find((w) => w.type === 'default')
        file.currentWorkspaceId = defaultWs?.id ?? null
      }

      await writeWorkspacesFile(file)

      // Note: We don't delete the actual workspace directory for custom workspaces
      // User might want to keep the files
    },

    async getCurrentWorkspaceId(): Promise<string | null> {
      const file = await readWorkspacesFile()
      return file.currentWorkspaceId
    },

    async setCurrentWorkspaceId(id: string | null): Promise<void> {
      const file = await readWorkspacesFile()
      file.currentWorkspaceId = id
      await writeWorkspacesFile(file)
    },

    async initDefaultWorkspace(): Promise<Workspace> {
      const accountId = getCurrentAccountId()
      if (!accountId) {
        throw new Error('No current account set')
      }

      const defaultPath = getDefaultWorkspacePath()

      // Create directory structure (same as custom workspace)
      // User data directories at workspace root
      await ensureDirectory(defaultPath)
      await ensureDirectory(`${defaultPath}/pages`)

      // Internal/cache directories in .pointer
      const pointerDir = `${defaultPath}/.pointer`
      await ensureDirectory(pointerDir)
      await ensureDirectory(`${pointerDir}/messageQueue`)
      await ensureDirectory(`${pointerDir}/attachments`)

      const workspace: Workspace = {
        id: 'default',
        name: '默认工作区',
        type: 'default',
        path: defaultPath,
        accountId,
        createdAt: Date.now()
      }

      await this.put(workspace)
      return workspace
    },

    async validateWorkspacePath(dirPath: string): Promise<ValidateWorkspaceResult> {
      const accountId = getCurrentAccountId()
      if (!accountId) {
        return { valid: false, isWorkspace: false, error: 'No current account set' }
      }

      // Check if directory exists
      const dirExists = await pathExists(dirPath, { allowCustomPath: true })
      if (!dirExists.exists) {
        return { valid: false, isWorkspace: false, error: 'Directory does not exist' }
      }

      if (!dirExists.isDirectory) {
        return { valid: false, isWorkspace: false, error: 'Path is not a directory' }
      }

      // Check if .pointer directory exists
      const pointerPath = getWorkspaceConfigFilePath(dirPath)
      const configExists = await pathExists(pointerPath, { allowCustomPath: true })

      if (configExists.exists) {
        // Read config to check ownership
        const config = await readJsonFile<WorkspaceConfigFile>(pointerPath, {
          allowCustomPath: true
        })

        if (config) {
          if (config.accountId !== accountId) {
            return {
              valid: false,
              isWorkspace: true,
              workspaceId: config.id,
              lockedByAccountId: config.accountId,
              error: 'Workspace is owned by another account'
            }
          }

          return {
            valid: true,
            isWorkspace: true,
            workspaceId: config.id
          }
        }
      }

      // Directory is valid and can become a workspace
      return {
        valid: true,
        isWorkspace: false
      }
    },

    async initCustomWorkspace(dirPath: string, name: string): Promise<Workspace> {
      const accountId = getCurrentAccountId()
      if (!accountId) {
        throw new Error('No current account set')
      }

      // Validate first
      const validation = await this.validateWorkspacePath(dirPath)
      if (!validation.valid) {
        throw new Error(validation.error)
      }

      // If already a workspace owned by this account, return existing
      if (validation.isWorkspace && validation.workspaceId) {
        const existing = await this.getById(validation.workspaceId)
        if (existing) {
          return existing
        }
      }

      // Create directory structure
      // User data directories at workspace root
      await ensureDirectory(`${dirPath}/pages`, { allowCustomPath: true })

      // Internal/cache directories in .pointer
      const pointerDir = `${dirPath}/.pointer`
      await ensureDirectory(pointerDir, { allowCustomPath: true })
      await ensureDirectory(`${pointerDir}/messageQueue`, { allowCustomPath: true })
      await ensureDirectory(`${pointerDir}/attachments`, { allowCustomPath: true })

      const workspaceId = crypto.randomUUID()
      const workspace: Workspace = {
        id: workspaceId,
        name,
        type: 'custom',
        path: dirPath,
        accountId,
        createdAt: Date.now()
      }

      await this.put(workspace)
      return workspace
    }
  }
}
