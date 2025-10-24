import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { Page, PageFolder, PageLineage } from '../types/type'
import {
  createPagesPersistConfig,
  handleStoreError,
  pagesStorage,
  foldersStorage
} from './persistence/storeConfig'
import {
  removeFromArray,
  createNewFolder,
  updateFolderById,
  createNewCrosstabChat
} from './helpers/helpers'
import { v4 as uuidv4 } from 'uuid'
import { useUIStore } from './uiStore'

export interface PagesState {
  pages: Page[]
  folders: PageFolder[]
}

export interface PagesActions {
  // 页面管理
  updatePage: (id: string, updates: Partial<Page>) => void
  updatePageCurrentPath: (id: string, path: string[], messageId?: string) => void
  deletePage: (id: string) => void
  deleteMultiplePages: (chatIds: string[]) => void
  movePage: (chatId: string, targetFolderId?: string, newOrder?: number) => void
  reorderPagesInFolder: (folderId: string | undefined, chatIds: string[]) => void
  toggleStarPage: (id: string) => void

  // 页面溯源
  updatePageLineage: (pageId: string, lineage: Partial<PageLineage>) => void
  addGeneratedPage: (sourcePageId: string, generatedPageId: string) => void

  // 文件夹管理
  createFolder: (name: string, parentId?: string, order?: number) => PageFolder
  updateFolder: (id: string, updates: Partial<PageFolder>) => void
  deleteFolder: (id: string) => void
  moveFolder: (folderId: string, newOrder: number, targetParentId?: string) => void

  // 页面查找
  findPageById: (id: string) => Page | undefined
  findFolderById: (id: string) => PageFolder | undefined
  getPagesByFolderId: (folderId?: string) => Page[]
  getFoldersByParentId: (parentId?: string) => PageFolder[]

  // 页面创建和打开
  createAndOpenChat: (
    title: string,
    folderId?: string,
    order?: number,
    lineage?: PageLineage
  ) => string
  createAndOpenCrosstabChat: (title: string, folderId?: string, lineage?: PageLineage) => string
  createAndOpenObjectChat: (title: string, folderId?: string, lineage?: PageLineage) => string
  createAndOpenSettingsPage: (defaultActiveTab?: string) => string
  createChatWithInitialMessage: (
    title: string,
    initialMessage: string,
    folderId?: string,
    sourcePageId?: string
  ) => string

  // 复杂页面创建功能
  createChatFromCell: (params: {
    folderId?: string
    horizontalItem: string
    verticalItem: string
    cellContent: string
    metadata: any
    sourcePageId: string
  }) => string
  createChatFromObjectNode: (params: {
    folderId?: string
    nodeId: string
    nodeName: string
    nodeContext: string
    sourcePageId: string
  }) => string
  createCrosstabFromObjects: (params: {
    title: string
    folderId?: string
    horizontalNodeId: string
    verticalNodeId: string
    objectData: any
    horizontalContext: any
    verticalContext: any
    sourcePageId: string
  }) => string

  // 复制功能
  copyPage: (pageId: string, newTitle?: string, targetFolderId?: string) => string

  // 工具方法
  clearAllPages: () => void
  clearChatPages: () => void
  importPages: (pages: Page[]) => void
  importFolders: (folders: PageFolder[]) => void
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
              const updatedPage = {
                ...state.pages[pageIndex],
                ...updates,
                updatedAt: Date.now()
              }
              state.pages[pageIndex] = updatedPage

              // 同时更新 IndexedDB 中的单个页面记录
              pagesStorage.savePage(updatedPage)
            }
          })
        } catch (error) {
          handleStoreError('pagesStore', 'updatePage', error)
        }
      },

      updatePageCurrentPath: (id, path, messageId?) => {
        try {
          set((state) => {
            const pageIndex = state.pages.findIndex((p) => p.id === id)
            if (pageIndex !== -1) {
              const page = state.pages[pageIndex]
              if (page.type === 'regular') {
                const updatedPage = {
                  ...page,
                  currentPath: path,
                  selectedMessageId:
                    messageId || (path.length > 0 ? path[path.length - 1] : undefined),
                  updatedAt: Date.now()
                }
                state.pages[pageIndex] = updatedPage

                // 同时更新 IndexedDB 中的单个页面记录
                pagesStorage.savePage(updatedPage)
              }
            }
          })
        } catch (error) {
          handleStoreError('pagesStore', 'updatePageCurrentPath', error)
        }
      },

      deletePage: (id) => {
        try {
          // 获取要删除的页面，用于清理附件
          const state = get()
          const pageToDelete = state.pages.find((p) => p.id === id)

          set((state) => {
            state.pages = state.pages.filter((p) => p.id !== id)
          })

          // 同时从 IndexedDB 中删除单个页面记录
          pagesStorage.deletePage(id)

          // 异步清理页面的所有附件
          if (pageToDelete) {
            window.api.attachment.cleanupPage(id).catch((error) => {
              console.error('清理页面附件失败:', error)
            })
          }
        } catch (error) {
          handleStoreError('pagesStore', 'deletePage', error)
        }
      },

      deleteMultiplePages: (chatIds) => {
        try {
          set((state) => {
            state.pages = state.pages.filter((p) => !chatIds.includes(p.id))
          })

          // 同时从 IndexedDB 中删除多个页面记录
          chatIds.forEach((id) => pagesStorage.deletePage(id))

          // 异步清理所有页面的附件
          chatIds.forEach((id) => {
            window.api.attachment.cleanupPage(id).catch((error) => {
              console.error('清理页面附件失败:', id, error)
            })
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
              const updatedPage = {
                ...state.pages[pageIndex],
                folderId: targetFolderId,
                order: newOrder ?? state.pages[pageIndex].order,
                updatedAt: Date.now()
              }
              state.pages[pageIndex] = updatedPage

              // 同时更新 IndexedDB 中的单个页面记录
              pagesStorage.savePage(updatedPage)
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
            const updatedPages: any[] = []

            state.pages = state.pages.map((page) => {
              const newIndex = chatIds.indexOf(page.id)
              if (newIndex !== -1 && page.folderId === folderId) {
                const updatedPage = {
                  ...page,
                  order: baseOrder + newIndex,
                  updatedAt: Date.now()
                }
                updatedPages.push(updatedPage)
                return updatedPage
              }
              return page
            })

            // 批量更新 IndexedDB 中的页面记录
            updatedPages.forEach((page) => pagesStorage.savePage(page))
          })
        } catch (error) {
          handleStoreError('pagesStore', 'reorderPagesInFolder', error)
        }
      },

      toggleStarPage: (id) => {
        try {
          set((state) => {
            const pageIndex = state.pages.findIndex((p) => p.id === id)
            if (pageIndex !== -1) {
              const updatedPage = {
                ...state.pages[pageIndex],
                starred: !state.pages[pageIndex].starred,
                updatedAt: Date.now()
              }
              state.pages[pageIndex] = updatedPage

              // 同时更新 IndexedDB 中的页面记录
              pagesStorage.savePage(updatedPage)
            }
          })
        } catch (error) {
          handleStoreError('pagesStore', 'toggleStarPage', error)
        }
      },

      // 页面溯源
      updatePageLineage: (pageId, lineage) => {
        try {
          set((state) => {
            const pageIndex = state.pages.findIndex((p) => p.id === pageId)
            if (pageIndex !== -1) {
              const updatedPage = {
                ...state.pages[pageIndex],
                lineage: {
                  ...state.pages[pageIndex].lineage,
                  ...lineage
                },
                updatedAt: Date.now()
              }
              state.pages[pageIndex] = updatedPage

              // 同时更新 IndexedDB 中的单个页面记录
              pagesStorage.savePage(updatedPage)
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
              const updatedPage = {
                ...page,
                lineage: {
                  ...page.lineage!,
                  generatedPageIds: [...page.lineage!.generatedPageIds, generatedPageId]
                },
                updatedAt: Date.now()
              }
              state.pages[pageIndex] = updatedPage

              // 同时更新 IndexedDB 中的单个页面记录
              pagesStorage.savePage(updatedPage)
            }
          })
        } catch (error) {
          handleStoreError('pagesStore', 'addGeneratedPage', error)
        }
      },

      // 文件夹管理
      createFolder: (name, parentId, order) => {
        try {
          // 如果没有指定order，获取同级文件夹的最小order值
          let finalOrder = order
          if (finalOrder === undefined) {
            const siblingFolders = get().folders.filter((f) => f.parentId === parentId)
            const siblingPages = get().pages.filter(
              (p) => p.folderId === parentId && p.type !== 'settings'
            )

            // 获取所有同级项的最小order值
            const allOrders = [
              ...siblingFolders.map((f) => f.order || 0),
              ...siblingPages.map((p) => p.order || 0)
            ]

            const minOrder = allOrders.length > 0 ? Math.min(...allOrders) : 1000
            finalOrder = minOrder - 1000 // 新文件夹添加到最前面
          }

          const newFolder = {
            ...createNewFolder(name, parentId),
            order: finalOrder
          }

          set((state) => {
            state.folders.push(newFolder)
          })

          // 同时保存到 IndexedDB
          foldersStorage.saveFolder(newFolder)

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
              const updatedFolder = {
                ...state.folders[folderIndex],
                ...updates
              }
              state.folders[folderIndex] = updatedFolder

              // 同时更新 IndexedDB 中的单个文件夹记录
              foldersStorage.saveFolder(updatedFolder)
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

          // 同时从 IndexedDB 中删除文件夹记录
          foldersStorage.deleteFolder(id)
        } catch (error) {
          handleStoreError('pagesStore', 'deleteFolder', error)
        }
      },

      moveFolder: (folderId, newOrder, targetParentId) => {
        try {
          set((state) => {
            const folderIndex = state.folders.findIndex((f) => f.id === folderId)
            if (folderIndex !== -1) {
              const updatedFolder = {
                ...state.folders[folderIndex],
                parentId: targetParentId,
                order: newOrder
              }
              state.folders[folderIndex] = updatedFolder

              // 同时更新 IndexedDB 中的文件夹记录
              foldersStorage.saveFolder(updatedFolder)
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
      createAndOpenChat: (title, folderId, order, lineage) => {
        try {
          const timestamp = Date.now()

          // 如果没有指定order，获取同文件夹下的最小order值
          let finalOrder = order
          if (finalOrder === undefined) {
            const siblingFolders = get().folders.filter((f) => f.parentId === folderId)
            const siblingPages = get().pages.filter(
              (p) => p.folderId === folderId && p.type !== 'settings'
            )

            // 获取所有同级项的最小order值
            const allOrders = [
              ...siblingFolders.map((f) => f.order || 0),
              ...siblingPages.map((p) => p.order || 0)
            ]

            const minOrder = allOrders.length > 0 ? Math.min(...allOrders) : 1000
            finalOrder = minOrder - 1000 // 新聊天添加到最前面
          }

          const newPage: Page = {
            id: uuidv4(),
            title,
            type: 'regular',
            createdAt: timestamp,
            updatedAt: timestamp,
            order: finalOrder,
            folderId,
            messages: [],
            messageMap: {},
            currentPath: [],
            rootMessageId: undefined,
            ...(lineage && { lineage })
          }

          set((state) => {
            state.pages.push(newPage)
          })

          // 同时保存到 IndexedDB
          pagesStorage.savePage(newPage)

          // 使用tabsStore打开标签页
          const { setSelectedNode } = useUIStore.getState()
          setSelectedNode(newPage.id, 'chat')

          return newPage.id
        } catch (error) {
          handleStoreError('pagesStore', 'createAndOpenChat', error)
          throw error
        }
      },

      createAndOpenCrosstabChat: (title, folderId, lineage) => {
        try {
          // 获取同文件夹下的最小order值
          const siblingFolders = get().folders.filter((f) => f.parentId === folderId)
          const siblingPages = get().pages.filter(
            (p) => p.folderId === folderId && p.type !== 'settings'
          )

          // 获取所有同级项的最小order值
          const allOrders = [
            ...siblingFolders.map((f) => f.order || 0),
            ...siblingPages.map((p) => p.order || 0)
          ]

          const minOrder = allOrders.length > 0 ? Math.min(...allOrders) : 1000

          const newPage: Page = {
            title,
            folderId,
            ...createNewCrosstabChat(title, folderId, lineage),
            order: minOrder - 1000, // 新节点添加到最前面
            ...(lineage && { lineage })
          }

          set((state) => {
            state.pages.push(newPage)
          })

          // 同时保存到 IndexedDB
          pagesStorage.savePage(newPage)

          const { setSelectedNode } = useUIStore.getState()
          setSelectedNode(newPage.id, 'chat')

          return newPage.id
        } catch (error) {
          handleStoreError('pagesStore', 'createAndOpenCrosstabChat', error)
          throw error
        }
      },

      createAndOpenObjectChat: (title, folderId, lineage) => {
        try {
          const timestamp = Date.now()

          // 获取同文件夹下的最小order值
          const siblingFolders = get().folders.filter((f) => f.parentId === folderId)
          const siblingPages = get().pages.filter(
            (p) => p.folderId === folderId && p.type !== 'settings'
          )

          // 获取所有同级项的最小order值
          const allOrders = [
            ...siblingFolders.map((f) => f.order || 0),
            ...siblingPages.map((p) => p.order || 0)
          ]

          const minOrder = allOrders.length > 0 ? Math.min(...allOrders) : 1000

          const newPage: Page = {
            id: uuidv4(),
            title,
            type: 'object',
            createdAt: timestamp,
            updatedAt: timestamp,
            order: minOrder - 1000, // 新节点添加到最前面
            folderId,
            objectData: {
              rootNodeId: '',
              nodes: {},
              selectedNodeId: undefined,
              expandedNodes: [],
              generationHistory: []
            },
            ...(lineage && { lineage })
          }

          set((state) => {
            state.pages.push(newPage)
          })

          // 同时保存到 IndexedDB
          pagesStorage.savePage(newPage)

          const { setSelectedNode } = useUIStore.getState()
          setSelectedNode(newPage.id, 'chat')

          return newPage.id
        } catch (error) {
          handleStoreError('pagesStore', 'createAndOpenObjectChat', error)
          throw error
        }
      },

      createAndOpenSettingsPage: (defaultActiveTab = 'appearance') => {
        try {
          // 检查是否已经存在设置页面，如果存在就更新tab并打开
          const existingPage = get().pages.find((p) => p.type === 'settings')
          if (existingPage) {
            // 更新设置页面的默认tab
            const updatedPage = {
              ...existingPage,
              data: { defaultActiveTab },
              updatedAt: Date.now()
            }
            set((state) => {
              const pageIndex = state.pages.findIndex((p) => p.id === existingPage.id)
              if (pageIndex !== -1) {
                state.pages[pageIndex] = updatedPage
              }
            })

            // 同时更新 IndexedDB
            pagesStorage.savePage(updatedPage)

            const { setSelectedNode } = useUIStore.getState()
            setSelectedNode(existingPage.id, 'chat')
            return existingPage.id
          }

          const newPage: Page = {
            id: uuidv4(),
            title: '应用设置',
            type: 'settings',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            data: { defaultActiveTab }
          }

          set((state) => {
            state.pages.push(newPage)
          })

          // 同时保存到 IndexedDB
          pagesStorage.savePage(newPage)

          const { setSelectedNode } = useUIStore.getState()
          setSelectedNode(newPage.id, 'chat')

          return newPage.id
        } catch (error) {
          handleStoreError('pagesStore', 'createAndOpenSettingsPage', error)
          throw error
        }
      },

      createChatWithInitialMessage: (title, initialMessage, folderId, sourcePageId) => {
        try {
          const timestamp = Date.now()

          // 如果没有指定order，获取同文件夹下的最小order值
          const siblingFolders = get().folders.filter((f) => f.parentId === folderId)
          const siblingPages = get().pages.filter(
            (p) => p.folderId === folderId && p.type !== 'settings'
          )

          // 获取所有同级项的最小order值
          const allOrders = [
            ...siblingFolders.map((f) => f.order || 0),
            ...siblingPages.map((p) => p.order || 0)
          ]

          const minOrder = allOrders.length > 0 ? Math.min(...allOrders) : 1000

          // 创建用户消息
          const userMessage = {
            id: uuidv4(),
            role: 'user' as const,
            content: initialMessage,
            timestamp: timestamp
          }

          const newPage: Page = {
            id: uuidv4(),
            title,
            type: 'regular',
            createdAt: timestamp,
            updatedAt: timestamp,
            order: minOrder - 1000, // 新页面添加到最前面
            folderId,
            messages: [userMessage],
            messageMap: { [userMessage.id]: userMessage },
            currentPath: [userMessage.id],
            rootMessageId: undefined,
            ...(sourcePageId && {
              lineage: {
                source: 'other' as const,
                sourcePageId,
                sourceContext: {
                  customContext: {
                    action: 'create_chat_with_text',
                    originalText: initialMessage
                  }
                },
                generatedPageIds: [],
                generatedAt: timestamp,
                description: `从消息文本创建新对话`
              }
            })
          }

          set((state) => {
            state.pages.push(newPage)
          })

          // 同时保存到 IndexedDB
          pagesStorage.savePage(newPage)

          const { setSelectedNode } = useUIStore.getState()
          setSelectedNode(newPage.id, 'chat')

          return newPage.id
        } catch (error) {
          handleStoreError('pagesStore', 'createChatWithInitialMessage', error)
          throw error
        }
      },

      // 复杂页面创建功能
      createChatFromCell: (params) => {
        try {
          // 从metadata中提取维度信息
          const horizontalDimensionNames =
            params.metadata?.horizontalDimensions?.map((d: any) => d.name).join(' > ') || '未知'
          const verticalDimensionNames =
            params.metadata?.verticalDimensions?.map((d: any) => d.name).join(' > ') || '未知'
          const valueDimensionNames =
            params.metadata?.valueDimensions?.map((d: any) => d.name).join(', ') || '未知'

          // 构建用户提示词
          const prompt = `# 基于交叉分析表单元格的深度分析

## 背景信息
- **主题**: ${params.metadata?.topic || '未知'}
- **横轴维度**: ${horizontalDimensionNames}
- **纵轴维度**: ${verticalDimensionNames}
- **值维度**: ${valueDimensionNames}

## 单元格位置
- **横轴路径**: ${params.horizontalItem}
- **纵轴路径**: ${params.verticalItem}

## 单元格内容
${params.cellContent}

## 请求
请基于以上信息进行深度分析，你可以：
1. 详细解释这个单元格内容的含义和背景
2. 分析其在整个交叉分析表中的作用和重要性
3. 提供相关的扩展信息或见解
4. 探讨可能的改进方向或相关问题

请开始你的分析：`

          // 创建用户消息
          const userMessage = {
            id: uuidv4(),
            role: 'user' as const,
            content: prompt,
            timestamp: Date.now()
          }

          const newPage: Page = {
            id: uuidv4(),
            title: `${params.horizontalItem} × ${params.verticalItem} - 深度分析`,
            type: 'regular',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            folderId: params.folderId,
            messages: [userMessage],
            messageMap: { [userMessage.id]: userMessage },
            currentPath: [userMessage.id],
            rootMessageId: undefined,
            lineage: {
              source: 'crosstab_to_chat' as const,
              sourcePageId: params.sourcePageId,
              sourceContext: {
                crosstabChat: {
                  horizontalItem: params.horizontalItem,
                  verticalItem: params.verticalItem,
                  cellContent: params.cellContent
                }
              },
              generatedPageIds: [],
              generatedAt: Date.now(),
              description: `从交叉分析表的单元格 "${params.horizontalItem} × ${params.verticalItem}" 生成的深度分析聊天`
            }
          }

          set((state) => {
            state.pages.push(newPage)

            // 更新源页面的generatedPageIds
            const sourcePageIndex = state.pages.findIndex((p) => p.id === params.sourcePageId)
            if (sourcePageIndex !== -1 && state.pages[sourcePageIndex].lineage) {
              const updatedSourcePage = {
                ...state.pages[sourcePageIndex],
                lineage: {
                  ...state.pages[sourcePageIndex].lineage!,
                  generatedPageIds: [
                    ...state.pages[sourcePageIndex].lineage!.generatedPageIds,
                    newPage.id
                  ]
                }
              }
              state.pages[sourcePageIndex] = updatedSourcePage

              // 同时更新 IndexedDB 中的源页面记录
              pagesStorage.savePage(updatedSourcePage)
            }
          })

          // 同时保存新页面到 IndexedDB
          pagesStorage.savePage(newPage)

          const { setSelectedNode } = useUIStore.getState()
          setSelectedNode(newPage.id, 'chat')

          return newPage.id
        } catch (error) {
          handleStoreError('pagesStore', 'createChatFromCell', error)
          throw error
        }
      },

      createChatFromObjectNode: (params) => {
        try {
          // 构建用户提示词
          const prompt = `# 基于对象节点的深度分析

## 节点信息
- **节点名称**: ${params.nodeName}
- **节点ID**: ${params.nodeId}

## 节点上下文
${params.nodeContext}

## 请求
请基于以上节点信息和上下文进行深度分析，你可以：
1. 详细解释这个节点的含义、作用和在整个对象结构中的位置
2. 分析节点的层级关系、属性特征和引用关系
3. 基于上下文信息提供相关的扩展见解和建议
4. 探讨可能的改进方向、相关问题或进一步的发展方向

请开始你的分析：`

          // 创建用户消息
          const userMessage = {
            id: uuidv4(),
            role: 'user' as const,
            content: prompt,
            timestamp: Date.now()
          }

          const newPage: Page = {
            id: uuidv4(),
            title: `${params.nodeName} - 深度分析`,
            type: 'regular',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            folderId: params.folderId,
            messages: [userMessage],
            messageMap: { [userMessage.id]: userMessage },
            currentPath: [userMessage.id],
            rootMessageId: undefined,
            lineage: {
              source: 'object_to_chat' as const,
              sourcePageId: params.sourcePageId,
              sourceContext: {
                customContext: {
                  nodeId: params.nodeId,
                  nodeName: params.nodeName,
                  context: params.nodeContext
                }
              },
              generatedPageIds: [],
              generatedAt: Date.now(),
              description: `从对象页面的节点 "${params.nodeName}" 生成的深度分析聊天`
            }
          }

          set((state) => {
            state.pages.push(newPage)

            // 更新源页面的generatedPageIds
            const sourcePageIndex = state.pages.findIndex((p) => p.id === params.sourcePageId)
            if (sourcePageIndex !== -1 && state.pages[sourcePageIndex].lineage) {
              const updatedSourcePage = {
                ...state.pages[sourcePageIndex],
                lineage: {
                  ...state.pages[sourcePageIndex].lineage!,
                  generatedPageIds: [
                    ...state.pages[sourcePageIndex].lineage!.generatedPageIds,
                    newPage.id
                  ]
                }
              }
              state.pages[sourcePageIndex] = updatedSourcePage

              // 同时更新 IndexedDB 中的源页面记录
              pagesStorage.savePage(updatedSourcePage)
            }
          })

          // 同时保存新页面到 IndexedDB
          pagesStorage.savePage(newPage)

          const { setSelectedNode } = useUIStore.getState()
          setSelectedNode(newPage.id, 'chat')

          return newPage.id
        } catch (error) {
          handleStoreError('pagesStore', 'createChatFromObjectNode', error)
          throw error
        }
      },

      createCrosstabFromObjects: (params) => {
        try {
          const newPage: Page = {
            id: uuidv4(),
            title: params.title,
            type: 'crosstab',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            folderId: params.folderId,
            crosstabData: {
              metadata: null,
              tableData: {},
              currentStep: 0,
              steps: []
            },
            lineage: {
              source: 'object_to_crosstab' as const,
              sourcePageId: params.sourcePageId,
              sourceContext: {
                objectCrosstab: {
                  horizontalNodeId: params.horizontalNodeId,
                  verticalNodeId: params.verticalNodeId,
                  horizontalNodeName: params.horizontalContext?.name || 'Unknown',
                  verticalNodeName: params.verticalContext?.name || 'Unknown'
                }
              },
              generatedPageIds: [],
              generatedAt: Date.now(),
              description: `从对象页面生成的交叉分析表`
            }
          }

          set((state) => {
            state.pages.push(newPage)

            // 更新源页面的generatedPageIds
            const sourcePageIndex = state.pages.findIndex((p) => p.id === params.sourcePageId)
            if (sourcePageIndex !== -1 && state.pages[sourcePageIndex].lineage) {
              const updatedSourcePage = {
                ...state.pages[sourcePageIndex],
                lineage: {
                  ...state.pages[sourcePageIndex].lineage!,
                  generatedPageIds: [
                    ...state.pages[sourcePageIndex].lineage!.generatedPageIds,
                    newPage.id
                  ]
                }
              }
              state.pages[sourcePageIndex] = updatedSourcePage

              // 同时更新 IndexedDB 中的源页面记录
              pagesStorage.savePage(updatedSourcePage)
            }
          })

          // 同时保存新页面到 IndexedDB
          pagesStorage.savePage(newPage)

          const { setSelectedNode } = useUIStore.getState()
          setSelectedNode(newPage.id, 'chat')

          return newPage.id
        } catch (error) {
          handleStoreError('pagesStore', 'createCrosstabFromObjects', error)
          throw error
        }
      },

      // 工具方法
      clearAllPages: () => {
        set((state) => {
          state.pages = []
          state.folders = []
        })

        // 同时清除 IndexedDB 中的数据
        pagesStorage.clearAllPages()
        foldersStorage.clearAllFolders()
      },

      clearChatPages: () => {
        set((state) => {
          // 只清除聊天相关页面（regular, crosstab, object类型），保留settings页面
          state.pages = state.pages.filter(page => page.type === 'settings')
          // 清除所有文件夹（文件夹主要用于组织聊天页面）
          state.folders = []
        })

        // 同步到 IndexedDB
        const remainingPages = get().pages.filter(page => page.type === 'settings')
        pagesStorage.savePages(remainingPages)
        foldersStorage.clearAllFolders()
      },

      importPages: (pages) => {
        set((state) => {
          state.pages = [...state.pages, ...pages]
        })

        // 同时保存到 IndexedDB
        pages.forEach((page) => pagesStorage.savePage(page))
      },

      importFolders: (folders) => {
        set((state) => {
          state.folders = [...state.folders, ...folders]
        })

        // 同时保存到 IndexedDB
        folders.forEach((folder) => foldersStorage.saveFolder(folder))
      },

      copyPage: (pageId, newTitle, targetFolderId) => {
        try {
          const state = get()
          const originalPage = state.pages.find((p) => p.id === pageId)

          if (!originalPage) {
            throw new Error(`Page with id ${pageId} not found`)
          }

          const timestamp = Date.now()

          // 生成新的页面ID
          const newPageId = uuidv4()

          // 创建统一的ID映射表
          const createIdMapping = (messages?: any[], messageMap?: { [messageId: string]: any }) => {
            const idMap = new Map<string, string>()

            // 为messages数组中的每个消息生成新ID
            if (messages) {
              messages.forEach((msg) => {
                idMap.set(msg.id, uuidv4())
              })
            }

            // 为messageMap中可能存在但不在messages数组中的消息生成新ID
            if (messageMap) {
              Object.keys(messageMap).forEach((oldId) => {
                if (!idMap.has(oldId)) {
                  idMap.set(oldId, uuidv4())
                }
              })
            }

            return idMap
          }

          // 创建统一的ID映射
          const idMap = createIdMapping(originalPage.messages, originalPage.messageMap)

          // 深度复制消息并重新生成ID
          const copyMessagesWithNewIds = (messages?: any[]): any[] => {
            if (!messages || messages.length === 0) return []

            return messages.map((msg) => ({
              ...msg,
              id: idMap.get(msg.id)!,
              parentId: msg.parentId ? idMap.get(msg.parentId) : undefined,
              replies:
                msg.replies?.map((replyId: string) => idMap.get(replyId)).filter(Boolean) || [],
              children:
                msg.children?.map((childId: string) => idMap.get(childId)).filter(Boolean) || [],
              // 保持branchIndex（分支索引在消息关系中是相对的，不需要重新生成）
              branchIndex: msg.branchIndex,
              // 重置流式状态
              isStreaming: false
            }))
          }

          // 深度复制消息映射并重新生成ID
          const copyMessageMapWithNewIds = (messageMap?: {
            [messageId: string]: any
          }): { [messageId: string]: any } => {
            if (!messageMap) return {}

            const newMessageMap: { [messageId: string]: any } = {}

            Object.entries(messageMap).forEach(([oldId, msg]) => {
              const newId = idMap.get(oldId)!
              newMessageMap[newId] = {
                ...msg,
                id: newId,
                parentId: msg.parentId ? idMap.get(msg.parentId) : undefined,
                replies:
                  msg.replies?.map((replyId: string) => idMap.get(replyId)).filter(Boolean) || [],
                children:
                  msg.children?.map((childId: string) => idMap.get(childId)).filter(Boolean) || [],
                // 保持branchIndex（分支索引在消息关系中是相对的，不需要重新生成）
                branchIndex: msg.branchIndex,
                // 重置流式状态
                isStreaming: false
              }
            })

            return newMessageMap
          }

          // 更新当前路径中的消息ID
          const updateCurrentPath = (currentPath?: string[]): string[] => {
            if (!currentPath) return []

            return currentPath.map((oldId) => idMap.get(oldId)).filter(Boolean) as string[]
          }

          // 深度复制特定类型的数据
          const copyTypeSpecificData = () => {
            const result: any = {}

            // 对于crosstab类型，深度复制crosstabData
            if (originalPage.type === 'crosstab' && originalPage.crosstabData) {
              result.crosstabData = JSON.parse(JSON.stringify(originalPage.crosstabData))
            }

            // 对于object类型，深度复制objectData
            if (originalPage.type === 'object' && originalPage.objectData) {
              result.objectData = JSON.parse(JSON.stringify(originalPage.objectData))
            }

            return result
          }

          // 创建复制的页面
          const copiedPage: Page = {
            ...originalPage,
            ...copyTypeSpecificData(), // 复制类型特定的数据
            id: newPageId,
            title: newTitle || `${originalPage.title} - 副本`,
            folderId: targetFolderId !== undefined ? targetFolderId : originalPage.folderId,
            createdAt: timestamp,
            updatedAt: timestamp,
            // 复制消息和相关数据，重新生成所有ID
            messages: copyMessagesWithNewIds(originalPage.messages),
            messageMap: copyMessageMapWithNewIds(originalPage.messageMap),
            // 重置一些状态
            streamingMessage: undefined,
            selectedMessageId: undefined,
            // 处理溯源信息
            lineage: originalPage.lineage
              ? {
                  ...originalPage.lineage,
                  source: 'user' as const, // 标记为用户手动复制
                  sourcePageId: pageId, // 记录原始页面ID
                  generatedPageIds: [], // 重置生成的页面列表
                  generatedAt: timestamp,
                  description: `复制自 "${originalPage.title}"`
                }
              : {
                  source: 'user' as const,
                  sourcePageId: pageId,
                  generatedPageIds: [],
                  generatedAt: timestamp,
                  description: `复制自 "${originalPage.title}"`
                }
          }

          // 更新当前路径
          copiedPage.currentPath = updateCurrentPath(originalPage.currentPath)

          // 如果有根消息ID，需要找到新的根消息ID
          if (originalPage.rootMessageId) {
            copiedPage.rootMessageId = idMap.get(originalPage.rootMessageId)
          }

          // 添加到状态
          set((state) => {
            state.pages.push(copiedPage)
          })

          // 同时保存到 IndexedDB
          pagesStorage.savePage(copiedPage)

          return newPageId
        } catch (error) {
          handleStoreError('pagesStore', 'copyPage', error)
          throw error
        }
      },

      exportPages: () => {
        return get().pages
      }
    })),
    createPagesPersistConfig('pages-store', 1)
  )
)
