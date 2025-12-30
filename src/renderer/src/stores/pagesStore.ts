import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatPage, PageFolder } from '../types/type'
import { createIndexedDBStorage } from '../utils/indexedDB'
import { registerStoreReset } from '../utils/storeRegistry'

interface PagesState {
  pages: ChatPage[]
  folders: PageFolder[]
}

interface PagesActions {
  // 页面操作
  setPages: (pages: ChatPage[]) => void
  addPage: (page: ChatPage) => void
  updatePage: (id: string, updates: Partial<ChatPage>) => void
  removePage: (id: string) => void

  // 文件夹操作
  setFolders: (folders: PageFolder[]) => void
  addFolder: (folder: PageFolder) => void
  updateFolder: (id: string, updates: Partial<PageFolder>) => void
  removeFolder: (id: string) => void

  // 重置
  reset: () => void
}

type PagesStore = PagesState & PagesActions

const initialState: PagesState = {
  pages: [],
  folders: []
}

export const usePagesStore = create<PagesStore>()(
  persist(
    (set) => ({
      ...initialState,

      setPages: (pages) => set({ pages }),

      addPage: (page) =>
        set((state) => ({
          pages: [...state.pages, page]
        })),

      updatePage: (id, updates) =>
        set((state) => ({
          pages: state.pages.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
          )
        })),

      removePage: (id) =>
        set((state) => ({
          pages: state.pages.filter((p) => p.id !== id)
        })),

      setFolders: (folders) => set({ folders }),

      addFolder: (folder) =>
        set((state) => ({
          folders: [...state.folders, folder]
        })),

      updateFolder: (id, updates) =>
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === id ? { ...f, ...updates, updatedAt: Date.now() } : f
          )
        })),

      removeFolder: (id) =>
        set((state) => {
          // 递归获取所有子文件夹 ID
          const getAllSubFolderIds = (folderId: string): string[] => {
            const subFolders = state.folders.filter((f) => f.parentFolderId === folderId)
            return subFolders.flatMap((f) => [f.id, ...getAllSubFolderIds(f.id)])
          }
          const allFolderIds = [id, ...getAllSubFolderIds(id)]

          // 获取根目录现有页面的最大 order
          const rootPages = state.pages.filter((p) => !p.parentFolderId)
          const maxOrder = rootPages.reduce((max, p) => Math.max(max, p.order ?? 0), -1)

          // 移动页面到根目录并更新 order
          let orderOffset = 0
          const updatedPages = state.pages.map((p) => {
            if (p.parentFolderId && allFolderIds.includes(p.parentFolderId)) {
              orderOffset++
              return { ...p, parentFolderId: undefined, order: maxOrder + orderOffset }
            }
            return p
          })

          return {
            folders: state.folders.filter((f) => !allFolderIds.includes(f.id)),
            pages: updatedPages
          }
        }),

      reset: () => set(initialState)
    }),
    {
      name: 'pages-store',
      storage: createIndexedDBStorage(),
      skipHydration: true, // 延迟加载,等待数据库名设置
      partialize: (state) => ({
        pages: state.pages,
        folders: state.folders
      })
    }
  )
)

// 注册重置回调
registerStoreReset(
  () => usePagesStore.getState().reset(),
  () => usePagesStore.persist.rehydrate()
)
