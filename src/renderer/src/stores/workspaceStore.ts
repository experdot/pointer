/**
 * 工作区 Store
 * 管理工作区列表和当前工作区
 */

import { create } from 'zustand'
import { persistence } from '../persistence/registry'
import { getCurrentAccountScope } from '../persistence/scope'
import type { Workspace, WorkspaceMetadata, ValidateWorkspaceResult } from '../types/workspace'
import type { WorkspaceRepairResult } from '../persistence/interfaces'
import type { IWorkspaceStore } from './interfaces/workspaceStore'

interface WorkspaceState {
  workspaces: WorkspaceMetadata[]
  currentWorkspaceId: string | null
  currentWorkspace: Workspace | null
  initialized: boolean
}

interface WorkspaceActions {
  // IInitializable
  init: () => Promise<void>
  // IResettable
  reset: () => Promise<void>
  // CRUD
  getById: (id: string) => Promise<Workspace | undefined>
  getAll: () => WorkspaceMetadata[]
  update: (id: string, changes: Partial<Workspace>) => Promise<void>
  delete: (id: string) => Promise<void>
  // 工作区切换
  switchWorkspace: (id: string) => Promise<void>
  setCurrentWorkspaceId: (id: string | null) => Promise<void>
  // 工作区创建
  initDefaultWorkspace: () => Promise<Workspace>
  validateWorkspacePath: (dirPath: string) => Promise<ValidateWorkspaceResult>
  openCustomWorkspace: (dirPath: string, name: string) => Promise<Workspace>
  repairWorkspacePath: (dirPath: string) => Promise<WorkspaceRepairResult>
}

type WorkspaceStore = WorkspaceState & WorkspaceActions

const initialState: WorkspaceState = {
  workspaces: [],
  currentWorkspaceId: null,
  currentWorkspace: null,
  initialized: false
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  ...initialState,

  init: async () => {
    const accountScope = getCurrentAccountScope()
    const [workspaces, currentWorkspaceId] = await Promise.all([
      persistence.account(accountScope).workspaces.getAll(),
      persistence.account(accountScope).workspaces.getCurrentWorkspaceId()
    ])

    // Allow reading custom workspace metadata before resolving the current workspace.
    await persistence.database.syncWorkspaceAccess(
      persistence.database.getActiveContext().workspacePath,
      workspaces.map((workspace) => workspace.path)
    )

    let currentWorkspace: Workspace | null = null
    if (currentWorkspaceId) {
      currentWorkspace =
        (await persistence.account(accountScope).workspaces.getById(currentWorkspaceId)) || null
    }

    set({ workspaces, currentWorkspaceId, currentWorkspace, initialized: true })
  },

  reset: async () => {
    set(initialState)
  },

  getById: async (id) => {
    return persistence.account(getCurrentAccountScope()).workspaces.getById(id)
  },

  getAll: () => get().workspaces,

  update: async (id, changes) => {
    const workspace = await persistence.account(getCurrentAccountScope()).workspaces.getById(id)
    if (!workspace) return

    const updated: Workspace = { ...workspace, ...changes, updatedAt: Date.now() }
    await persistence.account(getCurrentAccountScope()).workspaces.put(updated)

    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === id
          ? { id: updated.id, name: updated.name, type: updated.type, path: updated.path }
          : w
      ),
      currentWorkspace: state.currentWorkspaceId === id ? updated : state.currentWorkspace
    }))
  },

  delete: async (id) => {
    const workspace = await persistence.account(getCurrentAccountScope()).workspaces.getById(id)
    if (!workspace) return

    // 不能删除默认工作区
    if (workspace.type === 'default') {
      throw new Error('Cannot delete default workspace')
    }

    await persistence.account(getCurrentAccountScope()).workspaces.delete(id)

    set((state) => ({
      workspaces: state.workspaces.filter((w) => w.id !== id),
      currentWorkspaceId: state.currentWorkspaceId === id ? null : state.currentWorkspaceId,
      currentWorkspace: state.currentWorkspaceId === id ? null : state.currentWorkspace
    }))
  },

  switchWorkspace: async (id) => {
    const workspace = await persistence.account(getCurrentAccountScope()).workspaces.getById(id)
    if (!workspace) {
      throw new Error(`Workspace not found: ${id}`)
    }

    await persistence.account(getCurrentAccountScope()).workspaces.setCurrentWorkspaceId(id)

    set({
      currentWorkspaceId: id,
      currentWorkspace: workspace
    })
  },

  setCurrentWorkspaceId: async (id) => {
    if (id === null) {
      await persistence.account(getCurrentAccountScope()).workspaces.setCurrentWorkspaceId(null)
      set({ currentWorkspaceId: null, currentWorkspace: null })
      return
    }

    await get().switchWorkspace(id)
  },

  initDefaultWorkspace: async () => {
    const workspace = await persistence.account(getCurrentAccountScope()).workspaces.initDefaultWorkspace()

    set((state) => {
      const exists = state.workspaces.some((w) => w.id === workspace.id)
      const metadata: WorkspaceMetadata = {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
        path: workspace.path
      }
      return {
        workspaces: exists
          ? state.workspaces.map((w) => (w.id === workspace.id ? metadata : w))
          : [...state.workspaces, metadata]
      }
    })

    return workspace
  },

  validateWorkspacePath: async (dirPath) => {
    return persistence.account(getCurrentAccountScope()).workspaces.validateWorkspacePath(dirPath)
  },

  openCustomWorkspace: async (dirPath, name) => {
    // 验证路径
    const validation =
      await persistence.account(getCurrentAccountScope()).workspaces.validateWorkspacePath(dirPath)

    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid workspace path')
    }

    if (validation.lockedByAccountId) {
      throw new Error(`Workspace is locked by another account: ${validation.lockedByAccountId}`)
    }

    // 如果已经是工作区，直接加载
    if (validation.isWorkspace && validation.workspaceId) {
      const existing =
        await persistence.account(getCurrentAccountScope()).workspaces.getById(validation.workspaceId)
      if (existing) {
        await persistence.account(getCurrentAccountScope()).workspaces.setCurrentWorkspaceId(existing.id)
        set({
          currentWorkspaceId: existing.id,
          currentWorkspace: existing
        })
        return existing
      }
    }

    // 初始化新的自定义工作区
    const workspace =
      await persistence.account(getCurrentAccountScope()).workspaces.initCustomWorkspace(dirPath, name)

    // 更新状态
    set((state) => {
      const metadata: WorkspaceMetadata = {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
        path: workspace.path
      }
      return {
        workspaces: [...state.workspaces, metadata]
      }
    })

    return workspace
  },

  repairWorkspacePath: async (dirPath) => {
    return persistence.account(getCurrentAccountScope()).workspaces.repairWorkspacePath(dirPath)
  }
}))

/**
 * 获取工作区 Store 的接口实现
 */
export function getWorkspaceStoreInterface(): IWorkspaceStore {
  const store = useWorkspaceStore
  return {
    get workspaces() {
      return store.getState().workspaces
    },
    get currentWorkspaceId() {
      return store.getState().currentWorkspaceId
    },
    get currentWorkspace() {
      return store.getState().currentWorkspace
    },
    get initialized() {
      return store.getState().initialized
    },
    init: () => store.getState().init(),
    reset: () => store.getState().reset(),
    getById: (id) => store.getState().getById(id),
    getAll: () => store.getState().getAll(),
    update: (id, changes) => store.getState().update(id, changes),
    delete: (id) => store.getState().delete(id),
    switchWorkspace: (id) => store.getState().switchWorkspace(id),
    setCurrentWorkspaceId: (id) => store.getState().setCurrentWorkspaceId(id),
    initDefaultWorkspace: () => store.getState().initDefaultWorkspace(),
    validateWorkspacePath: (dirPath) => store.getState().validateWorkspacePath(dirPath),
    openCustomWorkspace: (dirPath, name) => store.getState().openCustomWorkspace(dirPath, name),
    repairWorkspacePath: (dirPath) => store.getState().repairWorkspacePath(dirPath)
  }
}
