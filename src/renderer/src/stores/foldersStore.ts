/**
 * 文件夹 Store
 * 管理文件夹列表
 */

import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { persistence } from '../persistence/registry'
import { getCurrentWorkspaceScope, tryGetCurrentWorkspaceScope } from '../persistence/scope'
import { queueFoldersSnapshot } from './persistenceQueue'
import type { PageFolder } from '../types/type'
import type { IFolderStore, FolderCreateDTO } from './interfaces/entities'

interface FoldersState {
  folders: PageFolder[]
  initialized: boolean
}

interface FoldersActions {
  // IEntityStore 接口方法
  init: () => Promise<void>
  getById: (id: string) => PageFolder | undefined
  getAll: () => PageFolder[]
  create: (data: FolderCreateDTO) => Promise<PageFolder>
  createMany: (data: FolderCreateDTO[]) => Promise<PageFolder[]>
  update: (id: string, changes: Partial<PageFolder>) => Promise<void>
  updateMany: (updates: Array<{ id: string; changes: Partial<PageFolder> }>) => Promise<void>
  delete: (id: string) => Promise<void>
  deleteMany: (ids: string[]) => Promise<void>
  reset: () => Promise<void>
  // 扩展方法
  findByParentId: (parentId: string | undefined) => PageFolder[]
  toggleExpanded: (id: string) => Promise<void>
}

type FoldersStore = FoldersState & FoldersActions

const initialState: FoldersState = {
  folders: [],
  initialized: false
}

function persistFolders(folders: PageFolder[]): void {
  queueFoldersSnapshot(getCurrentWorkspaceScope(), folders)
}

export const useFoldersStore = create<FoldersStore>((set, get) => ({
  ...initialState,

  init: async () => {
    const scope = tryGetCurrentWorkspaceScope()
    if (!scope) {
      set(initialState)
      return
    }

    const folders = await persistence.workspace(scope).folders.getAll()
    set({ folders, initialized: true })
  },

  getById: (id) => get().folders.find((f) => f.id === id),

  getAll: () => get().folders,

  create: async (data) => {
    const createdAt = data.createdAt ?? Date.now()
    const folder: PageFolder = {
      type: 'folder',
      id: data.id || uuidv4(),
      name: data.name,
      parentFolderId: data.parentFolderId,
      order: data.order ?? 0,
      expanded: data.expanded ?? true,
      createdAt,
      updatedAt: data.updatedAt
    }
    const nextFolders = get().folders.some((item) => item.id === folder.id)
      ? get().folders.map((item) => (item.id === folder.id ? folder : item))
      : [...get().folders, folder]
    persistFolders(nextFolders)
    set({ folders: nextFolders })
    return folder
  },

  createMany: async (items) => {
    if (items.length === 0) return []
    const folders: PageFolder[] = items.map((data) => ({
      type: 'folder',
      id: data.id || uuidv4(),
      name: data.name,
      parentFolderId: data.parentFolderId,
      order: data.order ?? 0,
      expanded: data.expanded ?? true,
      createdAt: data.createdAt ?? Date.now(),
      updatedAt: data.updatedAt
    }))
    const folderMap = new Map(get().folders.map((folder) => [folder.id, folder]))
    folders.forEach((folder) => folderMap.set(folder.id, folder))
    const nextFolders = Array.from(folderMap.values())
    persistFolders(nextFolders)
    set({ folders: nextFolders })
    return folders
  },

  update: async (id, changes) => {
    const folder = get().folders.find((f) => f.id === id)
    if (!folder) return

    const updated = { ...folder, ...changes, updatedAt: Date.now() }
    const nextFolders = get().folders.map((f) => (f.id === id ? updated : f))
    persistFolders(nextFolders)
    set({ folders: nextFolders })
  },

  updateMany: async (updates) => {
    if (updates.length === 0) return
    const folders = get().folders
    const updatedAt = Date.now()
    const updatedFolders = folders.map((f) => {
      const update = updates.find((u) => u.id === f.id)
      return update ? { ...f, ...update.changes, updatedAt } : f
    })
    persistFolders(updatedFolders)
    set({ folders: updatedFolders })
  },

  delete: async (id) => {
    const nextFolders = get().folders.filter((f) => f.id !== id)
    persistFolders(nextFolders)
    set({ folders: nextFolders })
  },

  deleteMany: async (ids) => {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    const nextFolders = get().folders.filter((f) => !idSet.has(f.id))
    persistFolders(nextFolders)
    set({ folders: nextFolders })
  },

  reset: async () => {
    // Only reset memory state, don't clear persistence data
    set(initialState)
  },

  findByParentId: (parentId) => {
    return get().folders.filter((f) => f.parentFolderId === parentId)
  },

  toggleExpanded: async (id) => {
    const folder = get().folders.find((f) => f.id === id)
    if (folder) {
      await get().update(id, { expanded: !folder.expanded })
    }
  }
}))

/**
 * 获取文件夹 Store 的接口实现
 */
export function getFolderStoreInterface(): IFolderStore {
  const store = useFoldersStore
  return {
    get initialized() {
      return store.getState().initialized
    },
    get folders() {
      return store.getState().folders
    },
    init: () => store.getState().init(),
    reset: () => store.getState().reset(),
    getById: (id) => store.getState().getById(id),
    getAll: () => store.getState().getAll(),
    create: (data) => store.getState().create(data),
    createMany: (data) => store.getState().createMany(data),
    update: (id, changes) => store.getState().update(id, changes),
    updateMany: (updates) => store.getState().updateMany(updates),
    delete: (id) => store.getState().delete(id),
    deleteMany: (ids) => store.getState().deleteMany(ids),
    findByParentId: (parentId) => store.getState().findByParentId(parentId),
    toggleExpanded: (id) => store.getState().toggleExpanded(id)
  }
}
