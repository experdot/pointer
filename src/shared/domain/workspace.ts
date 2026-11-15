/**
 * 工作区领域模型
 */

import type { Timestamps } from './common'

export type WorkspaceType = 'default' | 'custom'

export interface Workspace extends Timestamps {
  id: string
  accountId: string
  name: string
  type: WorkspaceType
  /** 系统默认名称在展示时翻译；旧数据可能没有此字段。 */
  usesDefaultName?: boolean
  /** 工作区根目录的绝对路径，仅内核层可见 */
  path: string
}

/** 用于列表展示的轻量工作区信息 */
export interface WorkspaceSummary {
  id: string
  name: string
  type: WorkspaceType
  usesDefaultName?: boolean
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

interface CreateWorkspaceInput {
  id: string
  accountId: string
  name: string
  type: WorkspaceType
  usesDefaultName?: boolean
  path: string
}

export function createWorkspace(input: CreateWorkspaceInput, at: number): Workspace {
  return {
    id: input.id,
    accountId: input.accountId,
    name: input.name,
    type: input.type,
    usesDefaultName: input.usesDefaultName ?? false,
    path: input.path,
    createdAt: at
  }
}

export function toWorkspaceSummary(workspace: Workspace): WorkspaceSummary {
  return {
    id: workspace.id,
    name: workspace.name,
    type: workspace.type,
    usesDefaultName: workspace.usesDefaultName,
    path: workspace.path
  }
}
