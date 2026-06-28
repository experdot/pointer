/**
 * Workspace persistence interface
 * Account-level storage for workspace management
 */

import type {
  Workspace,
  WorkspaceMetadata,
  ValidateWorkspaceResult,
  WorkspaceRepairIssue
} from '../../types/workspace'

export interface WorkspaceRepairResult {
  repaired: boolean
  issues: WorkspaceRepairIssue[]
}

/**
 * Workspace repository interface
 */
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

  /** Repair a partially initialized workspace owned by the current account */
  repairWorkspacePath(dirPath: string): Promise<WorkspaceRepairResult>
}
