/**
 * Workspace Store 接口定义
 */

import type { IInitializable, IResettable } from './base'
import type { Workspace, WorkspaceMetadata, ValidateWorkspaceResult } from '../../types/workspace'
import type { WorkspaceRepairResult } from '../../persistence/interfaces'

/**
 * 工作区创建数据
 */
export type WorkspaceCreateDTO = {
  name: string
  path: string
}

/**
 * 工作区 Store 接口
 */
export interface IWorkspaceStore extends IInitializable, IResettable {
  /**
   * 工作区列表（只读）
   */
  readonly workspaces: WorkspaceMetadata[]

  /**
   * 当前工作区 ID
   */
  readonly currentWorkspaceId: string | null

  /**
   * 当前工作区（完整信息）
   */
  readonly currentWorkspace: Workspace | null

  /**
   * 是否已初始化
   */
  readonly initialized: boolean

  // ==================== CRUD 操作 ====================

  /**
   * 根据 ID 获取工作区
   */
  getById(id: string): Promise<Workspace | undefined>

  /**
   * 获取所有工作区
   */
  getAll(): WorkspaceMetadata[]

  /**
   * 更新工作区
   */
  update(id: string, changes: Partial<Workspace>): Promise<void>

  /**
   * 删除工作区
   */
  delete(id: string): Promise<void>

  // ==================== 工作区切换 ====================

  /**
   * 切换到指定工作区
   */
  switchWorkspace(id: string): Promise<void>

  // ==================== 工作区创建 ====================

  /**
   * 初始化默认工作区
   */
  initDefaultWorkspace(): Promise<Workspace>

  /**
   * 验证目录是否可作为工作区
   */
  validateWorkspacePath(dirPath: string): Promise<ValidateWorkspaceResult>

  /**
   * 打开/创建自定义工作区
   */
  openCustomWorkspace(dirPath: string, name: string): Promise<Workspace>

  /**
   * 修复半初始化工作区
   */
  repairWorkspacePath(dirPath: string): Promise<WorkspaceRepairResult>

  // ==================== 内部方法 ====================

  /**
   * 设置当前工作区 ID（内部使用）
   */
  setCurrentWorkspaceId(id: string | null): Promise<void>
}
