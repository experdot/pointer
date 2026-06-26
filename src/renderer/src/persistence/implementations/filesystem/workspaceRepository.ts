/**
 * File System Workspace Repository
 * Account-level storage: AppData/accounts/{accountId}/workspaces.json
 */

import type {
  Workspace,
  WorkspaceMetadata,
  WorkspaceListFile,
  WorkspaceConfigFile,
  ValidateWorkspaceResult,
  WorkspaceRepairIssue
} from '../../../types/workspace'
import type { AccountScope } from '../../interfaces'
import type { WorkspaceRepairResult } from '../../interfaces'
import {
  getWorkspacesFilePath,
  getDefaultWorkspacePath,
  getPagesDirectoryPath,
  getMessageQueueDirectoryPath,
  getAttachmentsDirectoryPath,
  getWorkspaceInternalPath,
  getWorkspaceConfigFilePath,
  readJsonFile,
  writeJsonFile,
  ensureDirectory,
  pathExists
} from './core'

const DEFAULT_WORKSPACES_FILE: WorkspaceListFile = {
  currentWorkspaceId: null,
  workspaces: []
}

function collectWorkspaceIssues(
  hasRegistryEntry: boolean,
  config: WorkspaceConfigFile | null,
  pointerDirExists: boolean,
  pagesDirExists: boolean,
  messageQueueDirExists: boolean,
  attachmentsDirExists: boolean
): WorkspaceRepairIssue[] {
  const issues: WorkspaceRepairIssue[] = []

  if (!pointerDirExists) {
    issues.push('missing_pointer_dir')
  }
  if (!pagesDirExists) {
    issues.push('missing_pages_dir')
  }
  if (!messageQueueDirExists) {
    issues.push('missing_message_queue_dir')
  }
  if (!attachmentsDirExists) {
    issues.push('missing_attachments_dir')
  }
  if (!config) {
    issues.push('missing_workspace_config')
  }
  if (!hasRegistryEntry) {
    issues.push('missing_workspace_registry_entry')
  }

  return issues
}

async function readWorkspacesFile(scope: AccountScope): Promise<WorkspaceListFile> {
  const data = await readJsonFile<WorkspaceListFile>(getWorkspacesFilePath(scope))
  return data ?? DEFAULT_WORKSPACES_FILE
}

async function writeWorkspacesFile(scope: AccountScope, data: WorkspaceListFile): Promise<void> {
  await writeJsonFile(getWorkspacesFilePath(scope), data)
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

export function createWorkspaceRepository(scope: AccountScope): IWorkspaceRepository {
  const { accountId } = scope

  return {
    async getAll(): Promise<WorkspaceMetadata[]> {
      const file = await readWorkspacesFile(scope)
      return file.workspaces
    },

    async getById(id: string): Promise<Workspace | undefined> {
      const file = await readWorkspacesFile(scope)
      const metadata = file.workspaces.find((w) => w.id === id)

      if (!metadata) {
        return undefined
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
      const file = await readWorkspacesFile(scope)
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

      await writeWorkspacesFile(scope, file)

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
      const file = await readWorkspacesFile(scope)
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

      await writeWorkspacesFile(scope, file)

      // Note: We don't delete the actual workspace directory for custom workspaces
      // User might want to keep the files
    },

    async getCurrentWorkspaceId(): Promise<string | null> {
      const file = await readWorkspacesFile(scope)
      return file.currentWorkspaceId
    },

    async setCurrentWorkspaceId(id: string | null): Promise<void> {
      const file = await readWorkspacesFile(scope)
      file.currentWorkspaceId = id
      await writeWorkspacesFile(scope, file)
    },

    async initDefaultWorkspace(): Promise<Workspace> {
      const defaultPath = getDefaultWorkspacePath(scope)

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
      // Check if directory exists
      const dirExists = await pathExists(dirPath, { allowCustomPath: true })
      if (!dirExists.exists) {
        return { valid: false, isWorkspace: false, error: 'Directory does not exist' }
      }

      if (!dirExists.isDirectory) {
        return { valid: false, isWorkspace: false, error: 'Path is not a directory' }
      }

      const file = await readWorkspacesFile(scope)
      const registryEntry = file.workspaces.find((workspace) => workspace.path === dirPath)

      const pointerDirExists = await pathExists(getWorkspaceInternalPath(dirPath), {
        allowCustomPath: true
      }).then((result) => result.exists)
      const pagesDirExists = await pathExists(getPagesDirectoryPath(dirPath), {
        allowCustomPath: true
      }).then((result) => result.exists)
      const messageQueueDirExists = await pathExists(getMessageQueueDirectoryPath(dirPath), {
        allowCustomPath: true
      }).then((result) => result.exists)
      const attachmentsDirExists = await pathExists(getAttachmentsDirectoryPath(dirPath), {
        allowCustomPath: true
      }).then((result) => result.exists)

      const configPath = getWorkspaceConfigFilePath(dirPath)
      const config =
        (await readJsonFile<WorkspaceConfigFile>(configPath, {
          allowCustomPath: true
        })) ?? null

      if (config && config.accountId !== accountId) {
        return {
          valid: false,
          isWorkspace: true,
          workspaceId: config.id,
          lockedByAccountId: config.accountId,
          error: 'Workspace is owned by another account'
        }
      }

      const isWorkspace = !!config || !!registryEntry || pointerDirExists
      const issues = isWorkspace
        ? collectWorkspaceIssues(
            !!registryEntry,
            config,
            pointerDirExists,
            pagesDirExists,
            messageQueueDirExists,
            attachmentsDirExists
          )
        : []

      if (!isWorkspace) {
        return {
          valid: true,
          isWorkspace: false
        }
      }

      return {
        valid: true,
        isWorkspace: true,
        workspaceId: config?.id ?? registryEntry?.id,
        repairable: issues.length > 0,
        repairIssues: issues
      }
    },

    async initCustomWorkspace(dirPath: string, name: string): Promise<Workspace> {
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
    },

    async repairWorkspacePath(dirPath: string): Promise<WorkspaceRepairResult> {
      const validation = await this.validateWorkspacePath(dirPath)

      if (!validation.isWorkspace || !validation.repairable || !validation.repairIssues?.length) {
        return {
          repaired: false,
          issues: validation.repairIssues ?? []
        }
      }

      const file = await readWorkspacesFile(scope)
      const registryEntry = file.workspaces.find((workspace) => workspace.path === dirPath)
      const configPath = getWorkspaceConfigFilePath(dirPath)
      const existingConfig =
        (await readJsonFile<WorkspaceConfigFile>(configPath, {
          allowCustomPath: true
        })) ?? null

      const workspaceId = existingConfig?.id ?? registryEntry?.id ?? crypto.randomUUID()
      const workspaceName = existingConfig?.name ?? registryEntry?.name ?? 'Workspace'
      const createdAt = existingConfig?.createdAt ?? Date.now()

      await ensureDirectory(getPagesDirectoryPath(dirPath), { allowCustomPath: true })
      await ensureDirectory(getWorkspaceInternalPath(dirPath), { allowCustomPath: true })
      await ensureDirectory(getMessageQueueDirectoryPath(dirPath), { allowCustomPath: true })
      await ensureDirectory(getAttachmentsDirectoryPath(dirPath), { allowCustomPath: true })

      const config: WorkspaceConfigFile = {
        id: workspaceId,
        accountId,
        name: workspaceName,
        createdAt,
        updatedAt: Date.now()
      }
      await writeJsonFile(configPath, config, { allowCustomPath: true })

      if (!registryEntry) {
        const workspace: Workspace = {
          id: workspaceId,
          name: workspaceName,
          type: 'custom',
          path: dirPath,
          accountId,
          createdAt,
          updatedAt: config.updatedAt
        }
        await this.put(workspace)
      }

      return {
        repaired: true,
        issues: validation.repairIssues
      }
    }
  }
}
