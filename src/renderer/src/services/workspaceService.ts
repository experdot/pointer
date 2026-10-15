/**
 * 工作区服务
 *
 * 会话切换由内核负责资源的打开与关闭，这里只转发命令并读取镜像状态。
 */

import type { WorkspacePathValidation, WorkspaceSummary } from '@shared/domain'
import { useSettingsStore } from '../stores/settingsStore'
import { useWorkspaceStore } from '../stores/workspaceStore'

export async function switchWorkspace(workspaceId: string): Promise<void> {
  useSettingsStore.getState().flush()
  await useWorkspaceStore.getState().switchWorkspace(workspaceId)
}

export async function openFolderAsWorkspace(
  dirPath: string,
  name?: string
): Promise<WorkspaceSummary> {
  useSettingsStore.getState().flush()
  const validation = await useWorkspaceStore.getState().validatePath(dirPath)
  if (!validation.valid) {
    throw new Error(validation.error ?? '目录不可用')
  }
  if (validation.lockedByAccountId) {
    throw new Error('该目录已被其他账户使用')
  }
  return useWorkspaceStore.getState().openCustomWorkspace(dirPath, name)
}

export async function validateWorkspacePath(dirPath: string): Promise<WorkspacePathValidation> {
  return useWorkspaceStore.getState().validatePath(dirPath)
}

export async function repairWorkspacePath(dirPath: string): Promise<WorkspacePathValidation> {
  return useWorkspaceStore.getState().repairPath(dirPath)
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  await useWorkspaceStore.getState().deleteWorkspace(workspaceId)
}

export async function pickWorkspaceDirectory(title?: string): Promise<string | null> {
  return useWorkspaceStore.getState().pickDirectory(title)
}

export async function openWorkspaceInFileManager(): Promise<void> {
  await useWorkspaceStore.getState().openInFileManager()
}
