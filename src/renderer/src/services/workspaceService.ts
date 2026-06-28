/**
 * Workspace Service
 * 工作区业务逻辑，处理工作区切换和初始化
 */

import type { Workspace, WorkspaceMetadata, ValidateWorkspaceResult } from '../types/workspace'
import type { WorkspaceRepairResult } from '../persistence/interfaces'
import { stores } from '../stores/registry'
import { persistence } from '../persistence/registry'
import { runSwitchTransaction } from './switchTransactionService'

// ==================== 工作区级 Stores 操作 ====================

/**
 * 初始化所有工作区级 stores
 */
async function initWorkspaceStores(): Promise<void> {
  const { page, folder, tab } = stores
  await Promise.all([page.init(), folder.init(), tab.init()])
}

/**
 * 重置所有工作区级 stores
 */
function resetWorkspaceStores(): void {
  const { page, folder, message, tab } = stores
  page.reset()
  folder.reset()
  message.reset()
  tab.reset()
}

function getApprovedWorkspacePaths(extraApprovedPaths: string[] = []): string[] {
  return Array.from(
    new Set([...stores.workspace.workspaces.map((workspace) => workspace.path), ...extraApprovedPaths])
  )
}

async function commitWorkspaceContext(
  accountId: string,
  workspacePath: string | null,
  extraApprovedPaths: string[] = []
): Promise<void> {
  await persistence.database.commitContext({
    accountId,
    workspacePath,
    approvedWorkspacePaths: getApprovedWorkspacePaths(extraApprovedPaths)
  })
}

export class WorkspaceRepairRequiredError extends Error {
  constructor(
    readonly dirPath: string,
    readonly validation: ValidateWorkspaceResult
  ) {
    super('Workspace repair required')
  }
}

async function cleanupWorkspaceTempAttachments(): Promise<void> {
  try {
    await window.api.attachment.cleanupTemp()
  } catch (error) {
    console.error('Failed to cleanup workspace temp attachments:', error)
  }
}

// ==================== 工作区初始化 ====================

/**
 * 初始化工作区系统
 * 在账户初始化后调用
 */
export async function initializeWorkspaceSystem(): Promise<void> {
  const { workspace } = stores

  // 初始化工作区 store
  await workspace.init()

  // 如果没有工作区，创建默认工作区
  if (workspace.workspaces.length === 0) {
    const defaultWorkspace = await workspace.initDefaultWorkspace()
    await workspace.setCurrentWorkspaceId(defaultWorkspace.id)
  }

  // 如果没有当前工作区，设置为第一个工作区
  if (!workspace.currentWorkspaceId && workspace.workspaces.length > 0) {
    await workspace.setCurrentWorkspaceId(workspace.workspaces[0].id)
  }

  if (workspace.currentWorkspace) {
    await commitWorkspaceContext(workspace.currentWorkspace.accountId, workspace.currentWorkspace.path)
  } else {
    const accountId = persistence.database.getActiveContext().accountId
    if (!accountId) {
      throw new Error('No active account context')
    }
    await commitWorkspaceContext(accountId, null)
  }
  await cleanupWorkspaceTempAttachments()

  // 初始化工作区级 stores
  await initWorkspaceStores()
}

// ==================== 工作区切换 ====================

/**
 * 切换工作区
 */
export async function switchWorkspace(workspaceId: string): Promise<void> {
  const { workspace } = stores

  // 验证工作区存在
  const targetWorkspace = await workspace.getById(workspaceId)
  if (!targetWorkspace) {
    throw new Error(`Workspace not found: ${workspaceId}`)
  }

  await runSwitchTransaction('workspace', targetWorkspace.name, async () => {
    await workspace.setCurrentWorkspaceId(workspaceId)
    await commitWorkspaceContext(targetWorkspace.accountId, targetWorkspace.path)
    await cleanupWorkspaceTempAttachments()
    resetWorkspaceStores()
    await initWorkspaceStores()
  })
}

// ==================== 自定义工作区 ====================

/**
 * 打开文件夹作为工作区
 */
export async function openFolderAsWorkspace(dirPath: string, name?: string): Promise<Workspace> {
  const { workspace } = stores

  await persistence.database.approveWorkspacePath(dirPath)

  // 验证路径
  const validation = await validateWorkspacePath(dirPath)

  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid workspace path')
  }

  if (validation.lockedByAccountId) {
    throw new Error(`This folder is already used by another account`)
  }

  if (validation.repairable) {
    throw new WorkspaceRepairRequiredError(dirPath, validation)
  }

  // 使用目录名作为默认名称
  const workspaceName = name || dirPath.split(/[/\\]/).pop() || 'Workspace'

  // 如果已经是工作区且属于当前账户，直接切换
  if (validation.isWorkspace && validation.workspaceId) {
    const existing = await workspace.getById(validation.workspaceId)
    if (existing) {
      await switchWorkspace(existing.id)
      return existing
    }
  }

  // 创建/初始化自定义工作区
  const newWorkspace = await workspace.openCustomWorkspace(dirPath, workspaceName)

  await runSwitchTransaction('workspace', newWorkspace.name, async () => {
    await workspace.setCurrentWorkspaceId(newWorkspace.id)
    await commitWorkspaceContext(newWorkspace.accountId, newWorkspace.path, [dirPath])
    await cleanupWorkspaceTempAttachments()
    resetWorkspaceStores()
    await initWorkspaceStores()
  })

  return newWorkspace
}

/**
 * 验证目录是否可作为工作区
 */
export async function validateWorkspacePath(dirPath: string): Promise<ValidateWorkspaceResult> {
  return stores.workspace.validateWorkspacePath(dirPath)
}

export async function repairWorkspacePath(dirPath: string): Promise<WorkspaceRepairResult> {
  const result = await stores.workspace.repairWorkspacePath(dirPath)
  await stores.workspace.init()
  return result
}

// ==================== 工作区管理 ====================

/**
 * 删除工作区
 * 注意：只从列表中移除，不删除文件
 */
export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const { workspace } = stores

  const targetWorkspace = await workspace.getById(workspaceId)
  if (!targetWorkspace) {
    throw new Error(`Workspace not found: ${workspaceId}`)
  }

  // 不能删除默认工作区
  if (targetWorkspace.type === 'default') {
    throw new Error('Cannot delete default workspace')
  }

  // 如果删除的是当前工作区，切换到默认工作区
  if (workspace.currentWorkspaceId === workspaceId) {
    const defaultWs = workspace.workspaces.find((w) => w.type === 'default')
    if (defaultWs) {
      await switchWorkspace(defaultWs.id)
    }
  }

  await workspace.delete(workspaceId)
  const activeContext = persistence.database.getActiveContext()
  if (!activeContext.accountId) {
    throw new Error('No active account context')
  }
  await commitWorkspaceContext(activeContext.accountId, activeContext.workspacePath)
}

/**
 * 获取当前工作区
 */
export function getCurrentWorkspace(): Workspace | null {
  return stores.workspace.currentWorkspace
}

/**
 * 获取所有工作区
 */
export function getAllWorkspaces(): WorkspaceMetadata[] {
  return stores.workspace.workspaces
}

/**
 * 重置工作区系统（用于账户切换）
 */
export function resetWorkspaceSystem(): void {
  resetWorkspaceStores()
  stores.workspace.reset()
}
