/**
 * 工作区领域模型
 */

import type { Diagnostic, Timestamps } from './common'

export type WorkspaceType = 'default' | 'custom'

export interface Workspace extends Timestamps {
  id: string
  accountId: string
  name: string
  type: WorkspaceType
  /** 工作区根目录的绝对路径，仅内核层可见 */
  path: string
}

/** 用于列表展示的轻量工作区信息 */
export interface WorkspaceSummary {
  id: string
  name: string
  type: WorkspaceType
  path: string
}

export type WorkspaceRepairIssue =
  | 'missing-pointer-dir'
  | 'missing-pages-dir'
  | 'missing-config'
  | 'missing-attachments-dir'
  | 'missing-index'
  | 'not-registered'

export interface WorkspacePathValidation {
  valid: boolean
  isWorkspace: boolean
  workspaceId?: string
  /** 已被其他账户登记时，占用者账户 id */
  lockedByAccountId?: string
  repairable?: boolean
  repairIssues?: WorkspaceRepairIssue[]
  error?: string
}

export interface CreateWorkspaceInput {
  id: string
  accountId: string
  name: string
  type: WorkspaceType
  path: string
}

export function createWorkspace(input: CreateWorkspaceInput, at: number): Workspace {
  return {
    id: input.id,
    accountId: input.accountId,
    name: input.name,
    type: input.type,
    path: input.path,
    createdAt: at
  }
}

export function toWorkspaceSummary(workspace: Workspace): WorkspaceSummary {
  return {
    id: workspace.id,
    name: workspace.name,
    type: workspace.type,
    path: workspace.path
  }
}

export function validateWorkspace(workspace: Workspace): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  if (!workspace.id) {
    diagnostics.push({ code: 'workspace.id-required', message: '工作区缺少 id' })
  }
  if (!workspace.accountId) {
    diagnostics.push({
      code: 'workspace.account-required',
      message: '工作区必须归属某个账户',
      entityId: workspace.id
    })
  }
  if (!workspace.name.trim()) {
    diagnostics.push({
      code: 'workspace.name-required',
      message: '工作区名称不能为空',
      entityId: workspace.id
    })
  }
  if (!workspace.path.trim()) {
    diagnostics.push({
      code: 'workspace.path-required',
      message: '工作区路径不能为空',
      entityId: workspace.id
    })
  }

  return diagnostics
}
