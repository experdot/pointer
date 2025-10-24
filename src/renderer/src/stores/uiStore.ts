import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createPersistConfig, handleStoreError } from './persistence/storeConfig'
import { constrainSidebarWidth } from './helpers/helpers'
import { useTabsStore } from './tabsStore'

export interface UIState {
  // 节点选择状态
  selectedNodeId: string | null
  selectedNodeType: 'folder' | 'chat' | null
  checkedNodeIds: string[]

  // 收藏面板选中状态
  selectedFavoriteId: string | null
  selectedFavoriteType: 'folder' | 'item' | null

  // 侧边栏状态
  sidebarCollapsed: boolean
  sidebarWidth: number
  activeTab: 'explore' | 'search' | 'tasks' | 'favorites'

  // 消息折叠状态
  collapsedMessages: { [chatId: string]: string[] }
  allMessagesCollapsed: { [chatId: string]: boolean }

  // 页面溯源显示折叠状态
  lineageDisplayCollapsed: { [pageId: string]: boolean }
}

export interface UIActions {
  // 节点选择
  setSelectedNode: (nodeId: string | null, nodeType: 'folder' | 'chat' | null) => void
  setCheckedNodes: (nodeIds: string[]) => void
  clearCheckedNodes: () => void
  toggleNodeCheck: (nodeId: string) => void

  // 收藏面板选择
  setSelectedFavorite: (favoriteId: string | null, favoriteType: 'folder' | 'item' | null) => void

  // 侧边栏
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  collapseSidebar: () => void
  expandSidebar: () => void
  setActiveTab: (tab: 'explore' | 'search' | 'tasks' | 'favorites') => void

  // 消息折叠
  toggleMessageCollapse: (chatId: string, messageId: string) => void
  collapseAllMessages: (chatId: string, messageIds: string[]) => void
  collapseAIMessages: (chatId: string, messageIds: string[]) => void
  expandAllMessages: (chatId: string) => void
  isMessageCollapsed: (chatId: string, messageId: string) => boolean

  // 页面溯源显示
  toggleLineageDisplayCollapse: (pageId: string) => void
  isLineageDisplayCollapsed: (pageId: string) => boolean

  // 工具方法
  clearAllUIState: () => void
  resetToDefaults: () => void
}

const initialState: UIState = {
  selectedNodeId: null,
  selectedNodeType: null,
  checkedNodeIds: [],
  selectedFavoriteId: null,
  selectedFavoriteType: null,
  sidebarCollapsed: false,
  sidebarWidth: 300,
  activeTab: 'explore',
  collapsedMessages: {},
  allMessagesCollapsed: {},
  lineageDisplayCollapsed: {}
}

export const useUIStore = create<UIState & UIActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // 节点选择
      setSelectedNode: (nodeId, nodeType) => {
        set((state) => {
          state.selectedNodeId = nodeId
          state.selectedNodeType = nodeType

          if (nodeType === 'chat') {
            const { openTab } = useTabsStore.getState()
            openTab(nodeId)
          }
        })
      },

      setCheckedNodes: (nodeIds) => {
        set((state) => {
          state.checkedNodeIds = nodeIds
        })
      },

      clearCheckedNodes: () => {
        set((state) => {
          state.checkedNodeIds = []
        })
      },

      toggleNodeCheck: (nodeId) => {
        set((state) => {
          const isChecked = state.checkedNodeIds.includes(nodeId)
          if (isChecked) {
            state.checkedNodeIds = state.checkedNodeIds.filter((id) => id !== nodeId)
          } else {
            state.checkedNodeIds.push(nodeId)
          }
        })
      },

      // 收藏面板选择
      setSelectedFavorite: (favoriteId, favoriteType) => {
        set((state) => {
          state.selectedFavoriteId = favoriteId
          state.selectedFavoriteType = favoriteType
        })
      },

      // 侧边栏
      toggleSidebar: () => {
        set((state) => {
          state.sidebarCollapsed = !state.sidebarCollapsed
        })
      },

      setSidebarWidth: (width) => {
        try {
          set((state) => {
            state.sidebarWidth = constrainSidebarWidth(width)
          })
        } catch (error) {
          handleStoreError('uiStore', 'setSidebarWidth', error)
        }
      },

      collapseSidebar: () => {
        set((state) => {
          state.sidebarCollapsed = true
        })
      },

      expandSidebar: () => {
        set((state) => {
          state.sidebarCollapsed = false
        })
      },

      setActiveTab: (tab) => {
        set((state) => {
          state.activeTab = tab
        })
      },

      // 消息折叠
      toggleMessageCollapse: (chatId, messageId) => {
        try {
          set((state) => {
            const currentCollapsed = state.collapsedMessages[chatId] || []
            const isCollapsed = currentCollapsed.includes(messageId)

            if (isCollapsed) {
              state.collapsedMessages[chatId] = currentCollapsed.filter((id) => id !== messageId)
            } else {
              state.collapsedMessages[chatId] = [...currentCollapsed, messageId]
            }
          })
        } catch (error) {
          handleStoreError('uiStore', 'toggleMessageCollapse', error)
        }
      },

      collapseAllMessages: (chatId, messageIds) => {
        try {
          set((state) => {
            state.collapsedMessages[chatId] = messageIds
            state.allMessagesCollapsed[chatId] = true
          })
        } catch (error) {
          handleStoreError('uiStore', 'collapseAllMessages', error)
        }
      },

      collapseAIMessages: (chatId, messageIds) => {
        try {
          set((state) => {
            const currentCollapsed = state.collapsedMessages[chatId] || []
            // 合并当前已折叠的消息和AI消息，去重
            const newCollapsed = [...new Set([...currentCollapsed, ...messageIds])]
            state.collapsedMessages[chatId] = newCollapsed
          })
        } catch (error) {
          handleStoreError('uiStore', 'collapseAIMessages', error)
        }
      },

      expandAllMessages: (chatId) => {
        try {
          set((state) => {
            state.collapsedMessages[chatId] = []
            state.allMessagesCollapsed[chatId] = false
          })
        } catch (error) {
          handleStoreError('uiStore', 'expandAllMessages', error)
        }
      },

      isMessageCollapsed: (chatId, messageId) => {
        const collapsedMessages = get().collapsedMessages[chatId] || []
        return collapsedMessages.includes(messageId)
      },

      // 页面溯源显示
      toggleLineageDisplayCollapse: (pageId) => {
        try {
          set((state) => {
            const isCurrentlyCollapsed = state.lineageDisplayCollapsed[pageId] ?? true
            state.lineageDisplayCollapsed[pageId] = !isCurrentlyCollapsed
          })
        } catch (error) {
          handleStoreError('uiStore', 'toggleLineageDisplayCollapse', error)
        }
      },

      isLineageDisplayCollapsed: (pageId) => {
        return get().lineageDisplayCollapsed[pageId] ?? true
      },

      // 工具方法
      clearAllUIState: () => {
        set((state) => {
          state.selectedNodeId = null
          state.selectedNodeType = null
          state.checkedNodeIds = []
          state.selectedFavoriteId = null
          state.selectedFavoriteType = null
          state.collapsedMessages = {}
          state.allMessagesCollapsed = {}
          state.lineageDisplayCollapsed = {}
        })
      },

      resetToDefaults: () => {
        set((state) => {
          Object.assign(state, initialState)
        })
      }
    })),
    createPersistConfig('ui-store', 1, (state) => ({
      selectedNodeId: state.selectedNodeId,
      selectedNodeType: state.selectedNodeType,
      checkedNodeIds: state.checkedNodeIds,
      selectedFavoriteId: state.selectedFavoriteId,
      selectedFavoriteType: state.selectedFavoriteType,
      sidebarCollapsed: state.sidebarCollapsed,
      sidebarWidth: state.sidebarWidth,
      activeTab: state.activeTab,
      collapsedMessages: state.collapsedMessages,
      allMessagesCollapsed: state.allMessagesCollapsed
    }))
  )
)
