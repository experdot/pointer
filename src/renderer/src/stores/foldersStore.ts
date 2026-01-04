import { create } from 'zustand'
import * as db from '../utils/database'
import type { PageFolder } from '../types/type'

interface FoldersState {
  folders: PageFolder[]
  initialized: boolean
}

interface FoldersActions {
  init: () => Promise<void>
  addFolder: (folder: PageFolder) => Promise<void>
  updateFolder: (id: string, updates: Partial<PageFolder>) => Promise<void>
  removeFolder: (id: string) => Promise<void>
  removeFolders: (ids: string[]) => Promise<void>
  batchUpdateFolders: (
    updates: Array<{ id: string; updates: Partial<PageFolder> }>
  ) => Promise<void>
  reset: () => Promise<void>
}

type FoldersStore = FoldersState & FoldersActions

const initialState: FoldersState = {
  folders: [],
  initialized: false
}

export const useFoldersStore = create<FoldersStore>((set, get) => ({
  ...initialState,

  init: async () => {
    const folders = await db.getAllFolders()
    set({ folders, initialized: true })
  },

  addFolder: async (folder) => {
    await db.putFolder(folder)
    set((state) => ({ folders: [...state.folders, folder] }))
  },

  updateFolder: async (id, updates) => {
    const folder = get().folders.find((f) => f.id === id)
    if (!folder) return

    const updated = { ...folder, ...updates, updatedAt: Date.now() }
    await db.putFolder(updated)
    set((state) => ({
      folders: state.folders.map((f) => (f.id === id ? updated : f))
    }))
  },

  removeFolder: async (id) => {
    await db.deleteFolder(id)
    set((state) => ({ folders: state.folders.filter((f) => f.id !== id) }))
  },

  removeFolders: async (ids) => {
    if (ids.length === 0) return
    await db.deleteFoldersBatch(ids)
    const idSet = new Set(ids)
    set((state) => ({ folders: state.folders.filter((f) => !idSet.has(f.id)) }))
  },

  batchUpdateFolders: async (updates) => {
    const folders = get().folders
    const updatedFolders = folders.map((f) => {
      const update = updates.find((u) => u.id === f.id)
      return update ? { ...f, ...update.updates, updatedAt: Date.now() } : f
    })
    await Promise.all(
      updates.map((u) => {
        const folder = updatedFolders.find((f) => f.id === u.id)
        return folder ? db.putFolder(folder) : Promise.resolve()
      })
    )
    set({ folders: updatedFolders })
  },

  reset: async () => {
    await db.clearAllFolders()
    set(initialState)
  }
}))
