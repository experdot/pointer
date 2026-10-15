/**
 * 文件夹 Store
 *
 * 展开状态保存在 viewState 中，读取时合并到实体上供树组件使用。
 */

import { create } from 'zustand'
import type { Folder } from '@shared/domain'
import { command } from '../runtime/client'
import { useViewStateStore } from './viewStateStore'

export interface FolderView extends Folder {
  expanded: boolean
}

interface FoldersState {
  folders: FolderView[]
  initialized: boolean
}

interface FoldersActions {
  setFolders: (folders: Folder[]) => void
  upsert: (folder: Folder) => void
  getById: (id: string) => FolderView | undefined
  getAll: () => FolderView[]
  findByParentId: (parentId: string | undefined) => FolderView[]
  create: (input?: {
    name?: string
    parentFolderId?: string
    afterNodeId?: string
  }) => Promise<Folder>
  update: (id: string, patch: { name?: string }) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  move: (id: string, targetFolderId?: string, beforeNodeId?: string) => Promise<void>
  delete: (ids: string | string[], mode?: 'promote' | 'cascade') => Promise<void>
  clear: (id: string) => Promise<void>
  toggleExpanded: (id: string) => void
  syncExpanded: (expandedIds: string[]) => void
  reset: () => void
}

type FoldersStore = FoldersState & FoldersActions

function withExpanded(folders: Folder[], expandedIds: string[]): FolderView[] {
  const set = new Set(expandedIds)
  return folders.map((folder) => ({ ...folder, expanded: set.has(folder.id) }))
}

export const useFoldersStore = create<FoldersStore>((set, get) => ({
  folders: [],
  initialized: false,

  setFolders: (folders) =>
    set({
      folders: withExpanded(folders, useViewStateStore.getState().viewState.expandedFolderIds),
      initialized: true
    }),

  upsert: (folder) =>
    set((state) => ({
      folders: state.folders.some((item) => item.id === folder.id)
        ? state.folders.map((item) =>
            item.id === folder.id ? { ...folder, expanded: item.expanded } : item
          )
        : [...state.folders, { ...folder, expanded: false }]
    })),

  getById: (id) => get().folders.find((folder) => folder.id === id),

  getAll: () => get().folders,

  findByParentId: (parentId) =>
    get().folders.filter((folder) => folder.parentFolderId === parentId),

  create: (input) =>
    command('folder.create', {
      name: input?.name,
      parentFolderId: input?.parentFolderId,
      afterNodeId: input?.afterNodeId
    }),

  update: async (id, patch) => {
    await command('folder.update', { folderId: id, patch })
  },

  rename: async (id, name) => {
    await command('folder.update', { folderId: id, patch: { name } })
  },

  move: async (id, targetFolderId, beforeNodeId) => {
    await command('folder.move', { folderId: id, targetFolderId, beforeNodeId })
  },

  delete: async (ids, mode = 'promote') => {
    const list = Array.isArray(ids) ? ids : [ids]
    if (list.length === 0) return
    await command('folder.delete', { folderIds: list, mode })
  },

  clear: async (id) => {
    await command('folder.clear', { folderId: id })
  },

  toggleExpanded: (id) => {
    const viewState = useViewStateStore.getState().viewState
    const expanded = new Set(viewState.expandedFolderIds)
    if (expanded.has(id)) {
      expanded.delete(id)
    } else {
      expanded.add(id)
    }
    const expandedFolderIds = [...expanded]
    useViewStateStore.getState().patch({ expandedFolderIds })
    set((state) => ({
      folders: state.folders.map((folder) =>
        folder.id === id ? { ...folder, expanded: expanded.has(id) } : folder
      )
    }))
  },

  syncExpanded: (expandedIds) =>
    set((state) => ({ folders: withExpanded(state.folders, expandedIds) })),

  reset: () => set({ folders: [], initialized: false })
}))
