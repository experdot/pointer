import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createPersistConfig, handleStoreError } from './persistence/storeConfig'
import { usePagesStore } from './pagesStore'
import { ChatMessage } from '../types/type'

// 构建到指定消息的路径
function buildPathToMessage(messages: ChatMessage[], targetMessageId: string): string[] {
  const messageMap = new Map<string, ChatMessage>()
  messages.forEach((msg) => messageMap.set(msg.id, msg))

  const targetMessage = messageMap.get(targetMessageId)
  if (!targetMessage) return []

  // 构建从根到目标消息的路径
  const path: string[] = []
  let currentMsg: ChatMessage | undefined = targetMessage

  while (currentMsg) {
    path.unshift(currentMsg.id)
    if (currentMsg.parentId) {
      currentMsg = messageMap.get(currentMsg.parentId)
    } else {
      break
    }
  }

  // 如果目标消息有子节点，继续延伸到第一个子节点
  let lastNode = targetMessage
  while (lastNode.children && lastNode.children.length > 0) {
    const firstChildId = lastNode.children[0]
    const firstChild = messageMap.get(firstChildId)
    if (firstChild) {
      path.push(firstChildId)
      lastNode = firstChild
    } else {
      break
    }
  }

  return path
}

export interface TabsState {
  openTabs: string[] // 所有打开的 tab ID
  activeTabId: string | null // 当前激活的 tab ID
  pinnedTabs: Record<string, boolean> // 所有 tab 的 pinned 状态（统一管理）
}

export interface TabsActions {
  // 标签页基本操作
  openTab: (chatId: string, messageId?: string) => void
  closeTab: (chatId: string) => void
  closeOtherTabs: (chatId: string) => void
  closeTabsToRight: (chatId: string) => void
  closeAllTabs: () => void
  setActiveTab: (chatId: string) => void

  // 标签页固定（统一逻辑，不区分普通页面或收藏页）
  pinTab: (chatId: string) => void
  unpinTab: (chatId: string) => void
  isTabPinned: (chatId: string) => boolean

  // 标签页重排序
  reorderTabs: (newOrder: string[]) => void

  // 工具方法
  isTabOpen: (chatId: string) => boolean
  getTabIndex: (chatId: string) => number
  getNextActiveTab: (closedTabId: string) => string | null
  clearAllTabs: () => void
}

const initialState: TabsState = {
  openTabs: [],
  activeTabId: null,
  pinnedTabs: {}
}

export const useTabsStore = create<TabsState & TabsActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // 获取 tab 的 pinned 状态
      isTabPinned: (chatId: string) => {
        return get().pinnedTabs[chatId] || false
      },

      // 打开标签页
      openTab: (chatId, messageId?) => {
        try {
          const { openTabs, pinnedTabs } = get()

          // 如果标签页已经打开，只需激活它
          if (openTabs.includes(chatId)) {
            set((state) => {
              state.activeTabId = chatId
            })

            // 如果提供了 messageId，更新页面的当前路径（仅对普通页面有效）
            if (messageId && !chatId.startsWith('favorite-')) {
              const { findPageById, updatePageCurrentPath } = usePagesStore.getState()
              const page = findPageById(chatId)
              if (page && page.type === 'regular' && page.messages) {
                const path = buildPathToMessage(page.messages, messageId)
                if (path.length > 0) {
                  updatePageCurrentPath(chatId, path, messageId)
                }
              }
            }
            return
          }

          // 新打开标签页
          set((state) => {
            const isPinned = pinnedTabs[chatId] || false

            if (isPinned) {
              // 固定标签页插入到所有固定标签页的末尾
              const pinnedTabIds = state.openTabs.filter((id) => state.pinnedTabs[id])
              const unpinnedTabIds = state.openTabs.filter((id) => !state.pinnedTabs[id])
              state.openTabs = [...pinnedTabIds, chatId, ...unpinnedTabIds]
            } else {
              // 普通标签页添加到末尾
              state.openTabs.push(chatId)
            }

            state.activeTabId = chatId
          })

          // 如果提供了 messageId，更新页面的当前路径（仅对普通页面有效）
          if (messageId && !chatId.startsWith('favorite-')) {
            const { findPageById, updatePageCurrentPath } = usePagesStore.getState()
            const page = findPageById(chatId)
            if (page && page.type === 'regular' && page.messages) {
              const path = buildPathToMessage(page.messages, messageId)
              if (path.length > 0) {
                updatePageCurrentPath(chatId, path, messageId)
              }
            }
          }
        } catch (error) {
          handleStoreError('tabsStore', 'openTab', error)
        }
      },

      // 关闭标签页
      closeTab: (chatId) => {
        try {
          set((state) => {
            const newOpenTabs = state.openTabs.filter((id) => id !== chatId)

            let newActiveTabId = state.activeTabId
            if (state.activeTabId === chatId) {
              if (newOpenTabs.length > 0) {
                const closedIndex = state.openTabs.indexOf(chatId)
                newActiveTabId = newOpenTabs[Math.min(closedIndex, newOpenTabs.length - 1)]
              } else {
                newActiveTabId = null
              }
            }

            state.openTabs = newOpenTabs
            state.activeTabId = newActiveTabId
          })
        } catch (error) {
          handleStoreError('tabsStore', 'closeTab', error)
        }
      },

      // 关闭其他标签页
      closeOtherTabs: (chatId) => {
        try {
          set((state) => {
            state.openTabs = [chatId]
            state.activeTabId = chatId
          })
        } catch (error) {
          handleStoreError('tabsStore', 'closeOtherTabs', error)
        }
      },

      // 关闭右侧标签页
      closeTabsToRight: (chatId) => {
        try {
          set((state) => {
            const currentIndex = state.openTabs.indexOf(chatId)
            if (currentIndex === -1) return

            const newOpenTabs = state.openTabs.slice(0, currentIndex + 1)
            let newActiveTabId = state.activeTabId

            if (state.activeTabId && !newOpenTabs.includes(state.activeTabId)) {
              newActiveTabId = chatId
            }

            state.openTabs = newOpenTabs
            state.activeTabId = newActiveTabId
          })
        } catch (error) {
          handleStoreError('tabsStore', 'closeTabsToRight', error)
        }
      },

      // 关闭所有标签页
      closeAllTabs: () => {
        try {
          set((state) => {
            state.openTabs = []
            state.activeTabId = null
          })
        } catch (error) {
          handleStoreError('tabsStore', 'closeAllTabs', error)
        }
      },

      // 设置激活的标签页
      setActiveTab: (chatId) => {
        try {
          set((state) => {
            state.activeTabId = chatId
          })
        } catch (error) {
          handleStoreError('tabsStore', 'setActiveTab', error)
        }
      },

      // 固定标签页
      pinTab: (chatId) => {
        try {
          set((state) => {
            // 设置 pinned 状态
            state.pinnedTabs[chatId] = true

            // 重新排序标签页
            if (state.openTabs.includes(chatId)) {
              const filteredTabs = state.openTabs.filter((id) => id !== chatId)
              const pinnedTabIds = filteredTabs.filter((id) => state.pinnedTabs[id])
              const unpinnedTabIds = filteredTabs.filter((id) => !state.pinnedTabs[id])
              state.openTabs = [...pinnedTabIds, chatId, ...unpinnedTabIds]
            }
          })
        } catch (error) {
          handleStoreError('tabsStore', 'pinTab', error)
        }
      },

      // 取消固定标签页
      unpinTab: (chatId) => {
        try {
          set((state) => {
            // 取消 pinned 状态
            state.pinnedTabs[chatId] = false

            // 重新排序标签页
            if (state.openTabs.includes(chatId)) {
              const filteredTabs = state.openTabs.filter((id) => id !== chatId)
              const pinnedTabIds = filteredTabs.filter((id) => state.pinnedTabs[id])
              const unpinnedTabIds = filteredTabs.filter((id) => !state.pinnedTabs[id])
              state.openTabs = [...pinnedTabIds, chatId, ...unpinnedTabIds]
            }
          })
        } catch (error) {
          handleStoreError('tabsStore', 'unpinTab', error)
        }
      },

      // 重新排序标签页
      reorderTabs: (newOrder) => {
        try {
          set((state) => {
            // 验证新顺序是否有效
            const validOrder = newOrder.filter((id) => state.openTabs.includes(id))

            // 如果有遗漏的标签页，添加到末尾
            const missingTabs = state.openTabs.filter((id) => !validOrder.includes(id))
            const reorderedTabs = [...validOrder, ...missingTabs]

            // 重新分离固定标签页和普通标签页，确保固定标签页在前
            const pinnedTabIds = reorderedTabs.filter((id) => state.pinnedTabs[id])
            const unpinnedTabIds = reorderedTabs.filter((id) => !state.pinnedTabs[id])

            state.openTabs = [...pinnedTabIds, ...unpinnedTabIds]
          })
        } catch (error) {
          handleStoreError('tabsStore', 'reorderTabs', error)
        }
      },

      // 工具方法
      isTabOpen: (chatId) => {
        return get().openTabs.includes(chatId)
      },

      getTabIndex: (chatId) => {
        return get().openTabs.indexOf(chatId)
      },

      getNextActiveTab: (closedTabId) => {
        const { openTabs } = get()
        const newOpenTabs = openTabs.filter((id) => id !== closedTabId)

        if (newOpenTabs.length === 0) return null

        const closedIndex = openTabs.indexOf(closedTabId)
        return newOpenTabs[Math.min(closedIndex, newOpenTabs.length - 1)]
      },

      clearAllTabs: () => {
        set((state) => {
          state.openTabs = []
          state.activeTabId = null
        })
      }
    })),
    createPersistConfig('tabs-store', 2, (state) => ({
      openTabs: state.openTabs,
      activeTabId: state.activeTabId,
      pinnedTabs: state.pinnedTabs
    }))
  )
)
