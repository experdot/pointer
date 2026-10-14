/**
 * 工作区 Store（镜像 + 命令）
 */

import { create } from 'zustand'
import type { WorkspacePathValidation, WorkspaceSummary } from '@shared/domain'
import { command } from '../runtime/client'

interface WorkspaceState {
  workspaces: WorkspaceSummary[]
  currentWorkspaceId: string | null
  currentWorkspace: WorkspaceSummary | null
  initialized: boolean
}

interface WorkspaceActions {
  getById: (id: string) => WorkspaceSummary | undefined
  getAll: () => WorkspaceSummary[]
  switchWorkspace: (id: string) => Promise<void>
  openCustomWorkspace: (dirPath: string, name?: string) => Promise<WorkspaceSummary>
  createWorkspace: (name: string) => Promise<WorkspaceSummary>
  renameWorkspace: (id: string, name: string) => Promise<void>
  deleteWorkspace: (id: string) => Promise<void>
  validatePath: (dirPath: string) => Promise<WorkspacePathValidation>
  repairPath: (dirPath: string) => Promise<WorkspacePathValidation>
  pickDirectory: (title?: string) => Promise<string | null>
  openInFileManager: () => Promise<void>
  reset: () => void
}

type WorkspaceStore = WorkspaceState & WorkspaceActions

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: [],
  currentWorkspaceId: null,
  currentWorkspace: null,
  initialized: false,

  getById: (id) => get().workspaces.find((workspace) => workspace.id === id),

  getAll: () => get().workspaces,

  switchWorkspace: async (id) => {
    await command('session.selectWorkspace', { workspaceId: id })
  },

  openCustomWorkspace: async (dirPath, name) =>
    command('workspace.create', {
      name: name?.trim() || dirPath.split(/[\\/]/).pop() || '工作区',
      type: 'custom',
      path: dirPath
    }),

  createWorkspace: async (name) => {
    const dirPath = await command('workspace.pickDirectory', { title: '选择工作区目录' })
    if (!dirPath) throw new Error('已取消选择目录')
    return command('workspace.create', { name, type: 'custom', path: dirPath })
  },

  renameWorkspace: async (id, name) => {
    await command('workspace.rename', { workspaceId: id, name })
  },

  deleteWorkspace: async (id) => {
    await command('workspace.delete', { workspaceId: id })
  },

  validatePath: (dirPath) => command('workspace.validatePath', { dirPath }),

  repairPath: (dirPath) => command('workspace.repairPath', { dirPath }),

  pickDirectory: (title) => command('workspace.pickDirectory', { title }),

  openInFileManager: async () => {
    await command('workspace.openInFileManager', {})
  },

  reset: () =>
    set({ workspaces: [], currentWorkspaceId: null, currentWorkspace: null, initialized: false })
}))
