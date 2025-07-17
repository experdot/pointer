import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { Page, PageFolder, PageLineage } from '../types/type'
import { createPersistConfig, handleStoreError } from './persistence/storeConfig'
import { removeFromArray, createNewFolder, updateFolderById } from './helpers/helpers'
import { useTabsStore } from './tabsStore'
import { v4 as uuidv4 } from 'uuid'
import { useUIStore } from './uiStore'

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
  createAndOpenChat: (title: string, folderId?: string, lineage?: PageLineage) => string
  createAndOpenCrosstabChat: (title: string, folderId?: string, lineage?: PageLineage) => string
  createAndOpenObjectChat: (title: string, folderId?: string, lineage?: PageLineage) => string

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

  // 工具方法
  clearAllPages: () => void
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
      createAndOpenChat: (title, folderId, lineage) => {
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
            rootMessageId: undefined,
            ...(lineage && { lineage })
          }

          set((state) => {
            state.pages.push(newPage)
          })

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
            },
            ...(lineage && { lineage })
          }

          set((state) => {
            state.pages.push(newPage)
          })

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
            },
            ...(lineage && { lineage })
          }

          set((state) => {
            state.pages.push(newPage)
          })

          const { setSelectedNode } = useUIStore.getState()
          setSelectedNode(newPage.id, 'chat')

          return newPage.id
        } catch (error) {
          handleStoreError('pagesStore', 'createAndOpenObjectChat', error)
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
              state.pages[sourcePageIndex] = {
                ...state.pages[sourcePageIndex],
                lineage: {
                  ...state.pages[sourcePageIndex].lineage!,
                  generatedPageIds: [
                    ...state.pages[sourcePageIndex].lineage!.generatedPageIds,
                    newPage.id
                  ]
                }
              }
            }
          })

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
              state.pages[sourcePageIndex] = {
                ...state.pages[sourcePageIndex],
                lineage: {
                  ...state.pages[sourcePageIndex].lineage!,
                  generatedPageIds: [
                    ...state.pages[sourcePageIndex].lineage!.generatedPageIds,
                    newPage.id
                  ]
                }
              }
            }
          })

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
              state.pages[sourcePageIndex] = {
                ...state.pages[sourcePageIndex],
                lineage: {
                  ...state.pages[sourcePageIndex].lineage!,
                  generatedPageIds: [
                    ...state.pages[sourcePageIndex].lineage!.generatedPageIds,
                    newPage.id
                  ]
                }
              }
            }
          })

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
      },

      importPages: (pages) => {
        set((state) => {
          state.pages = [...state.pages, ...pages]
        })
      },

      importFolders: (folders) => {
        set((state) => {
          state.folders = [...state.folders, ...folders]
        })
      },

      exportPages: () => {
        return get().pages
      }
    })),
    createPersistConfig('pages-store', 1)
  )
)
