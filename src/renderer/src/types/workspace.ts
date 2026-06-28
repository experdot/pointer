/**
 * Workspace 相关类型定义
 */

/** 工作区类型 */
export type WorkspaceType = 'default' | 'custom'

/** 工作区元数据（轻量级，用于列表显示） */
export interface WorkspaceMetadata {
  id: string
  name: string
  type: WorkspaceType
  path: string
}

/** 完整工作区信息 */
export interface Workspace extends WorkspaceMetadata {
  accountId: string
  createdAt: number
  updatedAt?: number
}

/** 工作区列表文件结构 */
export interface WorkspaceListFile {
  currentWorkspaceId: string | null
  workspaces: WorkspaceMetadata[]
}

/** 工作区目录中的 workspace.json 结构（用于锁定检测） */
export interface WorkspaceConfigFile {
  id: string
  accountId: string
  name: string
  createdAt: number
  updatedAt?: number
}

export type WorkspaceRepairIssue =
  | 'missing_pointer_dir'
  | 'missing_pages_dir'
  | 'missing_workspace_config'
  | 'missing_message_queue_dir'
  | 'missing_attachments_dir'
  | 'missing_workspace_registry_entry'

/** 创建工作区的 DTO */
export interface CreateWorkspaceDTO {
  name: string
  type: WorkspaceType
  path: string
}

/** 验证工作区结果 */
export interface ValidateWorkspaceResult {
  /** 路径是否有效 */
  valid: boolean
  /** 是否已经是工作区（包含 .pointer 目录） */
  isWorkspace: boolean
  /** 如果是工作区，其 ID */
  workspaceId?: string
  /** 如果被其他账户占用，占用账户 ID */
  lockedByAccountId?: string
  /** 是否可以通过补齐目录/元数据进行修复 */
  repairable?: boolean
  /** 需要修复的问题列表 */
  repairIssues?: WorkspaceRepairIssue[]
  /** 错误信息 */
  error?: string
}
