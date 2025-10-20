import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { v4 as uuidv4 } from 'uuid'
import {
  FavoriteItem,
  FavoriteFolder,
  FavoriteItemType,
  FavoriteSource,
  Page,
  ChatMessage
} from '../types/type'
import { createFavoritesPersistConfig, handleStoreError } from './persistence/storeConfig'
import { usePagesStore } from './pagesStore'
import { MessageTree } from '../components/pages/chat/messageTree'

// Store 状态接口
export interface FavoritesState {
  items: FavoriteItem[]
  folders: FavoriteFolder[]

  // UI 状态
  selectedItemId?: string
  selectedFolderId?: string
  searchQuery?: string
  filterType?: FavoriteItemType
  filterTags?: string[]
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'order'
  sortOrder?: 'asc' | 'desc'
}

// Store 操作接口
export interface FavoritesActions {
  // 收藏项操作
  addFavorite: (item: Omit<FavoriteItem, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateFavorite: (id: string, updates: Partial<FavoriteItem>) => void
  deleteFavorite: (id: string) => void
  moveFavorite: (id: string, targetFolderId?: string, newOrder?: number) => void
  toggleStarFavorite: (id: string) => void

  // 批量操作
  deleteFavorites: (ids: string[]) => void
  moveFavorites: (ids: string[], targetFolderId?: string) => void

  // 文件夹操作
  createFolder: (folder: Omit<FavoriteFolder, 'id' | 'createdAt'>) => string
  updateFolder: (id: string, updates: Partial<FavoriteFolder>) => void
  deleteFolder: (id: string, deleteItems?: boolean) => void
  moveFolder: (id: string, targetParentId?: string) => void
  toggleFolderExpanded: (id: string) => void

  // 查询操作
  getFavoriteById: (id: string) => FavoriteItem | undefined
  getFavoritesByFolder: (folderId?: string) => FavoriteItem[]
  getFavoritesByType: (type: FavoriteItemType) => FavoriteItem[]
  getFavoritesByTag: (tag: string) => FavoriteItem[]
  getFavoritesByPage: (pageId: string) => FavoriteItem[]
  searchFavorites: (query: string) => FavoriteItem[]
  getStarredFavorites: () => FavoriteItem[]

  // 快捷方法
  favoriteCurrentPage: (pageId: string, folderId?: string, title?: string) => string
  favoriteMessage: (
    chatId: string,
    messageId: string,
    includeContext?: boolean,
    folderId?: string,
    title?: string
  ) => string
  favoriteTextFragment: (
    chatId: string,
    messageId: string,
    text: string,
    folderId?: string,
    title?: string
  ) => string

  // 溯源操作
  checkSourceExists: (source: FavoriteSource) => boolean
  navigateToSource: (favoriteId: string) => void
  incrementViewCount: (id: string) => void

  // UI 状态
  setSelectedItem: (id?: string) => void
  setSelectedFolder: (id?: string) => void
  setSearchQuery: (query: string) => void
  setFilter: (
    filter: Partial<Pick<FavoritesState, 'filterType' | 'filterTags' | 'sortBy' | 'sortOrder'>>
  ) => void
  clearFilters: () => void

  // 统计
  getStats: () => {
    totalCount: number
    pageCount: number
    messageCount: number
    textFragmentCount: number
    folderCount: number
  }
}

const initialState: FavoritesState = {
  items: [],
  folders: [],
  sortBy: 'createdAt',
  sortOrder: 'desc'
}

export const useFavoritesStore = create<FavoritesState & FavoritesActions>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        ...initialState,

        // ==================== 收藏项操作 ====================

        addFavorite: (item) => {
          try {
            const id = uuidv4()
            const now = Date.now()

            // 计算新的 order 值（放在同级最后）
            const siblings = get().items.filter((i) => i.folderId === item.folderId)
            const maxOrder =
              siblings.length > 0 ? Math.max(...siblings.map((s) => s.order || 0)) : 0
            const newOrder = maxOrder + 1000

            const newItem: FavoriteItem = {
              ...item,
              id,
              createdAt: now,
              updatedAt: now,
              viewCount: 0,
              order: item.order ?? newOrder
            }

            set((state) => {
              state.items.push(newItem)
            })

            return id
          } catch (error) {
            handleStoreError('favoritesStore', 'addFavorite', error)
            throw error
          }
        },

        updateFavorite: (id, updates) => {
          try {
            set((state) => {
              const item = state.items.find((i) => i.id === id)
              if (item) {
                Object.assign(item, updates, { updatedAt: Date.now() })
              }
            })
          } catch (error) {
            handleStoreError('favoritesStore', 'updateFavorite', error)
          }
        },

        deleteFavorite: (id) => {
          try {
            set((state) => {
              state.items = state.items.filter((i) => i.id !== id)
            })
          } catch (error) {
            handleStoreError('favoritesStore', 'deleteFavorite', error)
          }
        },

        moveFavorite: (id, targetFolderId, newOrder) => {
          try {
            set((state) => {
              const item = state.items.find((i) => i.id === id)
              if (item) {
                item.folderId = targetFolderId
                if (newOrder !== undefined) {
                  item.order = newOrder
                }
                item.updatedAt = Date.now()
              }
            })
          } catch (error) {
            handleStoreError('favoritesStore', 'moveFavorite', error)
          }
        },

        toggleStarFavorite: (id) => {
          try {
            set((state) => {
              const item = state.items.find((i) => i.id === id)
              if (item) {
                item.starred = !item.starred
                item.updatedAt = Date.now()
              }
            })
          } catch (error) {
            handleStoreError('favoritesStore', 'toggleStarFavorite', error)
          }
        },

        // ==================== 批量操作 ====================

        deleteFavorites: (ids) => {
          try {
            set((state) => {
              state.items = state.items.filter((i) => !ids.includes(i.id))
            })
          } catch (error) {
            handleStoreError('favoritesStore', 'deleteFavorites', error)
          }
        },

        moveFavorites: (ids, targetFolderId) => {
          try {
            set((state) => {
              const now = Date.now()
              state.items.forEach((item) => {
                if (ids.includes(item.id)) {
                  item.folderId = targetFolderId
                  item.updatedAt = now
                }
              })
            })
          } catch (error) {
            handleStoreError('favoritesStore', 'moveFavorites', error)
          }
        },

        // ==================== 文件夹操作 ====================

        createFolder: (folder) => {
          try {
            const id = uuidv4()

            // 计算新的 order 值（放在同级最后）
            const siblings = get().folders.filter((f) => f.parentId === folder.parentId)
            const maxOrder =
              siblings.length > 0 ? Math.max(...siblings.map((s) => s.order || 0)) : 0
            const newOrder = maxOrder + 1000

            const newFolder: FavoriteFolder = {
              ...folder,
              id,
              createdAt: Date.now(),
              expanded: true,
              order: folder.order ?? newOrder
            }

            set((state) => {
              state.folders.push(newFolder)
            })

            return id
          } catch (error) {
            handleStoreError('favoritesStore', 'createFolder', error)
            throw error
          }
        },

        updateFolder: (id, updates) => {
          try {
            set((state) => {
              const folder = state.folders.find((f) => f.id === id)
              if (folder) {
                Object.assign(folder, updates)
              }
            })
          } catch (error) {
            handleStoreError('favoritesStore', 'updateFolder', error)
          }
        },

        deleteFolder: (id, deleteItems = false) => {
          try {
            set((state) => {
              // 删除文件夹
              state.folders = state.folders.filter((f) => f.id !== id)

              // 删除子文件夹
              const deleteChildFolders = (parentId: string) => {
                const childFolders = state.folders.filter((f) => f.parentId === parentId)
                childFolders.forEach((child) => {
                  state.folders = state.folders.filter((f) => f.id !== child.id)
                  deleteChildFolders(child.id)
                })
              }
              deleteChildFolders(id)

              // 处理收藏项
              if (deleteItems) {
                // 删除文件夹内的所有收藏项
                state.items = state.items.filter((i) => i.folderId !== id)
              } else {
                // 将收藏项移动到父文件夹
                const folder = get().folders.find((f) => f.id === id)
                state.items.forEach((item) => {
                  if (item.folderId === id) {
                    item.folderId = folder?.parentId
                  }
                })
              }
            })
          } catch (error) {
            handleStoreError('favoritesStore', 'deleteFolder', error)
          }
        },

        moveFolder: (id, targetParentId) => {
          try {
            set((state) => {
              const folder = state.folders.find((f) => f.id === id)
              if (folder) {
                // 防止循环嵌套
                if (targetParentId) {
                  let parent = state.folders.find((f) => f.id === targetParentId)
                  while (parent) {
                    if (parent.id === id) {
                      // 检测到循环，不执行移动
                      return
                    }
                    parent = parent.parentId
                      ? state.folders.find((f) => f.id === parent!.parentId)
                      : undefined
                  }
                }
                folder.parentId = targetParentId
              }
            })
          } catch (error) {
            handleStoreError('favoritesStore', 'moveFolder', error)
          }
        },

        toggleFolderExpanded: (id) => {
          try {
            set((state) => {
              const folder = state.folders.find((f) => f.id === id)
              if (folder) {
                folder.expanded = !folder.expanded
              }
            })
          } catch (error) {
            handleStoreError('favoritesStore', 'toggleFolderExpanded', error)
          }
        },

        // ==================== 查询操作 ====================

        getFavoriteById: (id) => {
          return get().items.find((i) => i.id === id)
        },

        getFavoritesByFolder: (folderId) => {
          return get().items.filter((i) => i.folderId === folderId)
        },

        getFavoritesByType: (type) => {
          return get().items.filter((i) => i.type === type)
        },

        getFavoritesByTag: (tag) => {
          return get().items.filter((i) => i.tags?.includes(tag))
        },

        getFavoritesByPage: (pageId) => {
          return get().items.filter((i) => i.source?.pageId === pageId)
        },

        searchFavorites: (query) => {
          const lowerQuery = query.toLowerCase()
          return get().items.filter(
            (item) =>
              item.title.toLowerCase().includes(lowerQuery) ||
              item.description?.toLowerCase().includes(lowerQuery) ||
              item.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
              item.notes?.toLowerCase().includes(lowerQuery)
          )
        },

        getStarredFavorites: () => {
          return get().items.filter((i) => i.starred)
        },

        // ==================== 快捷方法 ====================

        favoriteCurrentPage: (pageId, folderId, title) => {
          try {
            const page = usePagesStore.getState().pages.find((p) => p.id === pageId)
            if (!page) {
              throw new Error('Page not found')
            }

            const favoriteTitle = title || page.title || '未命名页面'

            // 如果是聊天页面，只保存当前分支路径的消息
            let pageSnapshot = JSON.parse(JSON.stringify(page))
            if (page.type === 'regular' && page.messages && page.messages.length > 0) {
              // 使用 MessageTree 来获取当前分支路径
              const messageTree = new MessageTree(page.messages)
              const currentPathMessages = messageTree.getCurrentPathMessages()

              // 只保存当前分支路径的消息
              pageSnapshot = {
                ...pageSnapshot,
                messages: currentPathMessages
              }
            }

            return get().addFavorite({
              type: 'page',
              title: favoriteTitle,
              folderId,
              source: {
                type: 'page',
                pageId: page.id,
                pageTitle: page.title,
                pageType: page.type,
                timestamp: Date.now()
              },
              data: {
                pageSnapshot
              }
            })
          } catch (error) {
            handleStoreError('favoritesStore', 'favoriteCurrentPage', error)
            throw error
          }
        },

        favoriteMessage: (chatId, messageId, includeContext = false, folderId, title) => {
          try {
            const page = usePagesStore.getState().pages.find((p) => p.id === chatId)
            if (!page || page.type !== 'regular') {
              throw new Error('Chat page not found')
            }

            const message = page.messages?.find((m) => m.id === messageId)
            if (!message) {
              throw new Error('Message not found')
            }

            const favoriteTitle = title || message.content.slice(0, 30) + '...'

            let contextMessages: ChatMessage[] | undefined
            if (includeContext && page.messages) {
              const messageIndex = page.messages.findIndex((m) => m.id === messageId)
              const start = Math.max(0, messageIndex - 2)
              const end = Math.min(page.messages.length, messageIndex + 3)
              contextMessages = page.messages.slice(start, end).filter((m) => m.id !== messageId)
            }

            return get().addFavorite({
              type: 'message',
              title: favoriteTitle,
              folderId,
              source: {
                type: 'message',
                pageId: chatId,
                messageId: message.id,
                pageTitle: page.title,
                pageType: page.type,
                timestamp: Date.now()
              },
              data: {
                message: JSON.parse(JSON.stringify(message)),
                contextMessages: contextMessages
                  ? JSON.parse(JSON.stringify(contextMessages))
                  : undefined,
                pageTitle: page.title || '未命名聊天',
                pageType: page.type
              }
            })
          } catch (error) {
            handleStoreError('favoritesStore', 'favoriteMessage', error)
            throw error
          }
        },

        favoriteTextFragment: (chatId, messageId, text, folderId, title) => {
          try {
            const page = usePagesStore.getState().pages.find((p) => p.id === chatId)
            if (!page || page.type !== 'regular') {
              throw new Error('Chat page not found')
            }

            const message = page.messages?.find((m) => m.id === messageId)
            if (!message) {
              throw new Error('Message not found')
            }

            const favoriteTitle = title || text.slice(0, 30) + '...'

            return get().addFavorite({
              type: 'text-fragment',
              title: favoriteTitle,
              folderId,
              source: {
                type: 'message',
                pageId: chatId,
                messageId: message.id,
                pageTitle: page.title,
                pageType: page.type,
                timestamp: Date.now()
              },
              data: {
                text,
                fullMessage: JSON.parse(JSON.stringify(message)),
                pageTitle: page.title || '未命名聊天',
                pageType: page.type
              }
            })
          } catch (error) {
            handleStoreError('favoritesStore', 'favoriteTextFragment', error)
            throw error
          }
        },

        // ==================== 溯源操作 ====================

        checkSourceExists: (source) => {
          const { type, pageId, messageId } = source

          if (type === 'page') {
            const page = usePagesStore.getState().pages.find((p) => p.id === pageId)
            return page !== undefined
          }

          if (type === 'message') {
            const page = usePagesStore.getState().pages.find((p) => p.id === pageId)
            if (!page || page.type !== 'regular') return false

            const message = page.messages?.find((m) => m.id === messageId)
            return message !== undefined
          }

          return false
        },

        navigateToSource: (favoriteId) => {
          try {
            const favorite = get().getFavoriteById(favoriteId)
            if (!favorite || !favorite.source) {
              throw new Error('Favorite or source not found')
            }

            if (!get().checkSourceExists(favorite.source)) {
              throw new Error('Source no longer exists')
            }

            const { type, pageId, messageId } = favorite.source

            // 这里需要集成 tabsStore 来打开页面
            // 由于 tabsStore 可能还没导入，这里先预留接口
            // 实际实现时需要导入 useTabsStore
            console.log('Navigate to source:', { type, pageId, messageId })

            // 增加查看次数
            get().incrementViewCount(favoriteId)
          } catch (error) {
            handleStoreError('favoritesStore', 'navigateToSource', error)
            throw error
          }
        },

        incrementViewCount: (id) => {
          try {
            set((state) => {
              const item = state.items.find((i) => i.id === id)
              if (item) {
                item.viewCount = (item.viewCount || 0) + 1
                item.lastViewedAt = Date.now()
              }
            })
          } catch (error) {
            handleStoreError('favoritesStore', 'incrementViewCount', error)
          }
        },

        // ==================== UI 状态 ====================

        setSelectedItem: (id) => {
          set((state) => {
            state.selectedItemId = id
          })
        },

        setSelectedFolder: (id) => {
          set((state) => {
            state.selectedFolderId = id
          })
        },

        setSearchQuery: (query) => {
          set((state) => {
            state.searchQuery = query
          })
        },

        setFilter: (filter) => {
          set((state) => {
            Object.assign(state, filter)
          })
        },

        clearFilters: () => {
          set((state) => {
            state.filterType = undefined
            state.filterTags = undefined
            state.searchQuery = undefined
          })
        },

        // ==================== 统计 ====================

        getStats: () => {
          const items = get().items
          return {
            totalCount: items.length,
            pageCount: items.filter((i) => i.type === 'page').length,
            messageCount: items.filter((i) => i.type === 'message').length,
            textFragmentCount: items.filter((i) => i.type === 'text-fragment').length,
            folderCount: get().folders.length
          }
        }
      })),
      createFavoritesPersistConfig('favorites-store', 1)
    )
  )
)
