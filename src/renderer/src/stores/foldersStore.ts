/**
 * 文件夹 Store
 * 管理文件夹列表
 */

import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { persistence } from '../persistence/registry'
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

export const useFoldersStore = create<FoldersStore>((set, get) => ({
  ...initialState,

  init: async () => {
    const folders = await persistence.folders.getAll()
    set({ folders, initialized: true })
  },

  getById: (id) => get().folders.find((f) => f.id === id),

  getAll: () => get().folders,

  create: async (data) => {
    const folder: PageFolder = {
      type: 'folder',
      id: data.id || uuidv4(),
      name: data.name,
      parentFolderId: data.parentFolderId,
      order: data.order ?? 0,
      expanded: data.expanded ?? true,
      createdAt: Date.now()
    }
    await persistence.folders.put(folder)
    set((state) => ({ folders: [...state.folders, folder] }))
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
      createdAt: Date.now()
    }))
    await Promise.all(folders.map((f) => persistence.folders.put(f)))
    set((state) => ({ folders: [...state.folders, ...folders] }))
    return folders
  },

  update: async (id, changes) => {
    const folder = get().folders.find((f) => f.id === id)
    if (!folder) return

    const updated = { ...folder, ...changes, updatedAt: Date.now() }
    await persistence.folders.put(updated)
    set((state) => ({
      folders: state.folders.map((f) => (f.id === id ? updated : f))
    }))
  },

  updateMany: async (updates) => {
    if (updates.length === 0) return
    const folders = get().folders
    const updatedFolders = folders.map((f) => {
      const update = updates.find((u) => u.id === f.id)
      return update ? { ...f, ...update.changes, updatedAt: Date.now() } : f
    })
    await Promise.all(
      updates.map((u) => {
        const folder = updatedFolders.find((f) => f.id === u.id)
        return folder ? persistence.folders.put(folder) : Promise.resolve()
      })
    )
    set({ folders: updatedFolders })
  },

  delete: async (id) => {
    await persistence.folders.delete(id)
    set((state) => ({ folders: state.folders.filter((f) => f.id !== id) }))
  },

  deleteMany: async (ids) => {
    if (ids.length === 0) return
    await persistence.folders.deleteBatch(ids)
    const idSet = new Set(ids)
    set((state) => ({ folders: state.folders.filter((f) => !idSet.has(f.id)) }))
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
