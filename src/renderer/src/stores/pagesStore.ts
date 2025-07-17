import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { Page, PageFolder, PageLineage } from '../types/type'
import { createPersistConfig, handleStoreError } from './storeConfig'
import { removeFromArray, createNewFolder, updateFolderById } from '../store/helpers'
import { useTabsStore } from './tabsStore'

export interface PagesState {
  pages: Page[]
  folders: PageFolder[]
}

export interface PagesActions {
  // 页面管理
  updatePage: (id: string, updates: Partial<Page>) => void
  deletePage: (id: string) => void
  deleteMultiplePages: (chatIds: string[]) => void
  movePage: (chatId: string, targetFolderId?: string, newOrder?: number) => void
  reorderPagesInFolder: (folderId: string | undefined, chatIds: string[]) => void

  // 页面溯源
  updatePageLineage: (pageId: string, lineage: Partial<PageLineage>) => void
  addGeneratedPage: (sourcePageId: string, generatedPageId: string) => void

  // 文件夹管理
  createFolder: (name: string, parentId?: string) => PageFolder
  updateFolder: (id: string, updates: Partial<PageFolder>) => void
  deleteFolder: (id: string) => void
  moveFolder: (folderId: string, newOrder: number, targetParentId?: string) => void

  // 页面查找
  findPageById: (id: string) => Page | undefined
  findFolderById: (id: string) => PageFolder | undefined
  getPagesByFolderId: (folderId?: string) => Page[]
  getFoldersByParentId: (parentId?: string) => PageFolder[]

  // 页面创建和打开
  createAndOpenChat: (title: string, folderId?: string) => string
  createAndOpenCrosstabChat: (title: string, folderId?: string) => string
  createAndOpenObjectChat: (title: string, folderId?: string) => string

  // 工具方法
  clearAllPages: () => void
  importPages: (pages: Page[]) => void
  exportPages: () => Page[]
}

const initialState: PagesState = {
  pages: [],
  folders: []
}

export const usePagesStore = create<PagesState & PagesActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // 页面管理
      updatePage: (id, updates) => {
        try {
          set((state) => {
            const pageIndex = state.pages.findIndex((p) => p.id === id)
            if (pageIndex !== -1) {
              state.pages[pageIndex] = {
                ...state.pages[pageIndex],
                ...updates,
                updatedAt: Date.now()
              }
            }
          })
        } catch (error) {
          handleStoreError('pagesStore', 'updatePage', error)
        }
      },

      deletePage: (id) => {
        try {
          set((state) => {
            state.pages = state.pages.filter((p) => p.id !== id)
          })
        } catch (error) {
          handleStoreError('pagesStore', 'deletePage', error)
        }
      },

      deleteMultiplePages: (chatIds) => {
        try {
          set((state) => {
            state.pages = state.pages.filter((p) => !chatIds.includes(p.id))
          })
        } catch (error) {
          handleStoreError('pagesStore', 'deleteMultiplePages', error)
        }
      },

      movePage: (chatId, targetFolderId, newOrder) => {
        try {
          set((state) => {
            const pageIndex = state.pages.findIndex((p) => p.id === chatId)
            if (pageIndex !== -1) {
              state.pages[pageIndex] = {
                ...state.pages[pageIndex],
                folderId: targetFolderId,
                order: newOrder ?? state.pages[pageIndex].order,
                updatedAt: Date.now()
              }
            }
          })
        } catch (error) {
          handleStoreError('pagesStore', 'movePage', error)
        }
      },

      reorderPagesInFolder: (folderId, chatIds) => {
        try {
          set((state) => {
            const baseOrder = Date.now()
            state.pages = state.pages.map((page) => {
              const newIndex = chatIds.indexOf(page.id)
              if (newIndex !== -1 && page.folderId === folderId) {
                return {
                  ...page,
                  order: baseOrder + newIndex,
                  updatedAt: Date.now()
                }
              }
              return page
            })
          })
        } catch (error) {
          handleStoreError('pagesStore', 'reorderPagesInFolder', error)
        }
      },

      // 页面溯源
      updatePageLineage: (pageId, lineage) => {
        try {
          set((state) => {
            const pageIndex = state.pages.findIndex((p) => p.id === pageId)
            if (pageIndex !== -1) {
              state.pages[pageIndex] = {
                ...state.pages[pageIndex],
                lineage: {
                  ...state.pages[pageIndex].lineage,
                  ...lineage
                },
                updatedAt: Date.now()
              }
            }
          })
        } catch (error) {
          handleStoreError('pagesStore', 'updatePageLineage', error)
        }
      },

      addGeneratedPage: (sourcePageId, generatedPageId) => {
        try {
          set((state) => {
            const pageIndex = state.pages.findIndex((p) => p.id === sourcePageId)
            if (pageIndex !== -1 && state.pages[pageIndex].lineage) {
              const page = state.pages[pageIndex]
              state.pages[pageIndex] = {
                ...page,
                lineage: {
                  ...page.lineage!,
                  generatedPageIds: [...page.lineage!.generatedPageIds, generatedPageId]
                },
                updatedAt: Date.now()
              }
            }
          })
        } catch (error) {
          handleStoreError('pagesStore', 'addGeneratedPage', error)
        }
      },

      // 文件夹管理
      createFolder: (name, parentId) => {
        try {
          const newFolder = createNewFolder(name, parentId)
          set((state) => {
            state.folders.push(newFolder)
          })
          return newFolder
        } catch (error) {
          handleStoreError('pagesStore', 'createFolder', error)
          throw error
        }
      },

      updateFolder: (id, updates) => {
        try {
          set((state) => {
            const folderIndex = state.folders.findIndex((f) => f.id === id)
            if (folderIndex !== -1) {
              state.folders[folderIndex] = {
                ...state.folders[folderIndex],
                ...updates
              }
            }
          })
        } catch (error) {
          handleStoreError('pagesStore', 'updateFolder', error)
        }
      },

      deleteFolder: (id) => {
        try {
          set((state) => {
            const folderToDelete = state.folders.find((f) => f.id === id)

            // 删除文件夹
            state.folders = state.folders
              .filter((folder) => folder.id !== id)
              .map((folder) =>
                // 如果删除的是父文件夹，将子文件夹移到其父级
                folder.parentId === id ? { ...folder, parentId: folderToDelete?.parentId } : folder
              )

            // 将该文件夹下的页面移到父文件夹
            state.pages = state.pages.map((page) =>
              page.folderId === id ? { ...page, folderId: folderToDelete?.parentId } : page
            )
          })
        } catch (error) {
          handleStoreError('pagesStore', 'deleteFolder', error)
        }
      },

      moveFolder: (folderId, newOrder, targetParentId) => {
        try {
          set((state) => {
            const folderIndex = state.folders.findIndex((f) => f.id === folderId)
            if (folderIndex !== -1) {
              state.folders[folderIndex] = {
                ...state.folders[folderIndex],
                parentId: targetParentId,
                order: newOrder
              }
            }
          })
        } catch (error) {
          handleStoreError('pagesStore', 'moveFolder', error)
        }
      },

      // 页面查找
      findPageById: (id) => {
        return get().pages.find((p) => p.id === id)
      },

      findFolderById: (id) => {
        return get().folders.find((f) => f.id === id)
      },

      getPagesByFolderId: (folderId) => {
        return get().pages.filter((p) => p.folderId === folderId)
      },

      getFoldersByParentId: (parentId) => {
        return get().folders.filter((f) => f.parentId === parentId)
      },

      // 页面创建和打开
      createAndOpenChat: (title, folderId) => {
        try {
          const newPage: Page = {
            id: `chat-${Date.now()}`,
            title,
            type: 'regular',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            folderId,
            messages: [],
            messageMap: {},
            currentPath: [],
            rootMessageId: undefined
          }

          set((state) => {
            state.pages.push(newPage)
          })

          // 使用tabsStore打开标签页
          const { openTab } = useTabsStore.getState()
          openTab(newPage.id)

          return newPage.id
        } catch (error) {
          handleStoreError('pagesStore', 'createAndOpenChat', error)
          throw error
        }
      },

      createAndOpenCrosstabChat: (title, folderId) => {
        try {
          const newPage: Page = {
            id: `crosstab-${Date.now()}`,
            title,
            type: 'crosstab',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            folderId,
            crosstabData: {
              metadata: null,
              tableData: {},
              currentStep: 0,
              steps: []
            }
          }

          set((state) => {
            state.pages.push(newPage)
          })

          // 使用tabsStore打开标签页
          const { openTab } = useTabsStore.getState()
          openTab(newPage.id)

          return newPage.id
        } catch (error) {
          handleStoreError('pagesStore', 'createAndOpenCrosstabChat', error)
          throw error
        }
      },

      createAndOpenObjectChat: (title, folderId) => {
        try {
          const newPage: Page = {
            id: `object-${Date.now()}`,
            title,
            type: 'object',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            folderId,
            objectData: {
              rootNodeId: '',
              nodes: {},
              selectedNodeId: undefined,
              expandedNodes: [],
              generationHistory: []
            }
          }

          set((state) => {
            state.pages.push(newPage)
          })

          // 使用tabsStore打开标签页
          const { openTab } = useTabsStore.getState()
          openTab(newPage.id)

          return newPage.id
        } catch (error) {
          handleStoreError('pagesStore', 'createAndOpenObjectChat', error)
          throw error
        }
      },

      // 工具方法
      clearAllPages: () => {
        set((state) => {
          state.pages = []
          state.folders = []
        })
      },

      importPages: (pages) => {
        set((state) => {
          state.pages = [...state.pages, ...pages]
        })
      },

      exportPages: () => {
        return get().pages
      }
    })),
    createPersistConfig('pages-store', 1)
  )
)
