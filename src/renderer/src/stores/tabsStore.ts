import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createPersistConfig, handleStoreError } from './persistence/storeConfig'
import { usePagesStore } from './pagesStore'
import { ChatMessage } from '../types/type'

// 构建到指定消息的路径
function buildPathToMessage(messages: ChatMessage[], targetMessageId: string): string[] {
  const messageMap = new Map<string, ChatMessage>()
  messages.forEach(msg => messageMap.set(msg.id, msg))

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
  openTabs: string[]
  activeTabId: string | null
}

export interface TabsActions {
  // 标签页基本操作
  openTab: (chatId: string, messageId?: string) => void
  closeTab: (chatId: string) => void
  closeOtherTabs: (chatId: string) => void
  closeTabsToRight: (chatId: string) => void
  closeAllTabs: () => void
  setActiveTab: (chatId: string) => void

  // 标签页固定
  pinTab: (chatId: string) => void
  unpinTab: (chatId: string) => void

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
  activeTabId: null
}

export const useTabsStore = create<TabsState & TabsActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // 标签页基本操作
      openTab: (chatId, messageId?) => {
        try {
          const { openTabs } = get()
          const { findPageById, updatePageCurrentPath } = usePagesStore.getState()

          // 如果标签页已经打开，只需激活它
          if (openTabs.includes(chatId)) {
            set((state) => {
              state.activeTabId = chatId
            })

            // 如果提供了 messageId，更新页面的当前路径
            if (messageId) {
              const page = findPageById(chatId)
              if (page && page.type === 'regular' && page.messages) {
                // 构建到该消息的路径
                const path = buildPathToMessage(page.messages, messageId)
                if (path.length > 0) {
                  updatePageCurrentPath(chatId, path, messageId)
                }
              }
            }
            return
          }

          // 检查是否是虚拟tab（如收藏详情页）
          const isVirtualTab = chatId.startsWith('favorite-')

          // 检查页面是否存在（虚拟tab不需要检查）
          if (!isVirtualTab) {
            const page = findPageById(chatId)
            if (!page) return
          }

          set((state) => {
            // 根据是否固定来决定插入位置（虚拟tab总是非固定的）
            const page = isVirtualTab ? null : findPageById(chatId)
            const isPinned = page?.pinned || false
            let newOpenTabs

            if (isPinned) {
              // 固定标签页插入到所有固定标签页的末尾
              const pinnedTabs = state.openTabs.filter((id) => {
                const tab = usePagesStore.getState().findPageById(id)
                return tab?.pinned || false
              })
              const unpinnedTabs = state.openTabs.filter((id) => {
                const tab = usePagesStore.getState().findPageById(id)
                return !(tab?.pinned || false)
              })
              newOpenTabs = [...pinnedTabs, chatId, ...unpinnedTabs]
            } else {
              // 普通标签页（包括虚拟tab）添加到末尾
              newOpenTabs = [...state.openTabs, chatId]
            }

            state.openTabs = newOpenTabs
            state.activeTabId = chatId
          })

          // 如果提供了 messageId，更新页面的当前路径
          if (messageId) {
            const page = findPageById(chatId)
            if (page && page.type === 'regular' && page.messages) {
              // 构建到该消息的路径
              const path = buildPathToMessage(page.messages, messageId)
              if (path.length > 0) {
                const { updatePageCurrentPath } = usePagesStore.getState()
                updatePageCurrentPath(chatId, path, messageId)
              }
            }
          }
        } catch (error) {
          handleStoreError('tabsStore', 'openTab', error)
        }
      },

      closeTab: (chatId) => {
        try {
          set((state) => {
            const newOpenTabs = state.openTabs.filter((id) => id !== chatId)

            let newActiveTabId = state.activeTabId
            if (state.activeTabId === chatId) {
              if (newOpenTabs.length > 0) {
                const closedIndex = state.openTabs.indexOf(chatId)
                // 如果关闭的不是最后一个tab，激活后面的tab；否则激活前面的tab
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

      closeOtherTabs: (chatId) => {
        try {
          const { findPageById } = usePagesStore.getState()
          const page = findPageById(chatId)
          if (!page) return

          set((state) => {
            state.openTabs = [chatId]
            state.activeTabId = chatId
          })
        } catch (error) {
          handleStoreError('tabsStore', 'closeOtherTabs', error)
        }
      },

      closeTabsToRight: (chatId) => {
        try {
          set((state) => {
            const currentIndex = state.openTabs.indexOf(chatId)
            if (currentIndex === -1) return

            const newOpenTabs = state.openTabs.slice(0, currentIndex + 1)
            let newActiveTabId = state.activeTabId

            // 如果当前激活的tab在关闭的tabs中，激活指定的tab
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

      setActiveTab: (chatId) => {
        try {
          const { findPageById } = usePagesStore.getState()
          const page = findPageById(chatId)
          if (!page) return

          set((state) => {
            state.activeTabId = chatId
          })
        } catch (error) {
          handleStoreError('tabsStore', 'setActiveTab', error)
        }
      },

      // 标签页固定
      pinTab: (chatId) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)
          if (!page) return

          // 更新页面的固定状态
          updatePage(chatId, { pinned: true })

          set((state) => {
            // 重新排序标签页，将新固定的标签页移到所有固定标签页的末尾
            if (state.openTabs.includes(chatId)) {
              // 移除当前位置的标签页
              const filteredTabs = state.openTabs.filter((id) => id !== chatId)

              // 找到所有固定标签页的位置
              const pinnedTabs = filteredTabs.filter((id) => {
                const tab = usePagesStore.getState().findPageById(id)
                return tab?.pinned || false
              })
              const unpinnedTabs = filteredTabs.filter((id) => {
                const tab = usePagesStore.getState().findPageById(id)
                return !(tab?.pinned || false)
              })

              // 将新固定的标签页插入到固定标签页的末尾
              state.openTabs = [...pinnedTabs, chatId, ...unpinnedTabs]
            }
          })
        } catch (error) {
          handleStoreError('tabsStore', 'pinTab', error)
        }
      },

      unpinTab: (chatId) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)
          if (!page) return

          // 更新页面的固定状态
          updatePage(chatId, { pinned: false })

          set((state) => {
            // 重新排序标签页，将取消固定的标签页移到所有固定标签页的后面
            if (state.openTabs.includes(chatId)) {
              // 移除当前位置的标签页
              const filteredTabs = state.openTabs.filter((id) => id !== chatId)

              // 找到所有固定标签页的位置
              const pinnedTabs = filteredTabs.filter((id) => {
                const tab = usePagesStore.getState().findPageById(id)
                return tab?.pinned || false
              })
              const unpinnedTabs = filteredTabs.filter((id) => {
                const tab = usePagesStore.getState().findPageById(id)
                return !(tab?.pinned || false)
              })

              // 将取消固定的标签页插入到未固定标签页的开头
              state.openTabs = [...pinnedTabs, chatId, ...unpinnedTabs]
            }
          })
        } catch (error) {
          handleStoreError('tabsStore', 'unpinTab', error)
        }
      },

      // 标签页重排序
      reorderTabs: (newOrder) => {
        try {
          set((state) => {
            const { findPageById } = usePagesStore.getState()

            // 验证新顺序是否有效
            const validOrder = newOrder.filter(
              (id) => state.openTabs.includes(id) && findPageById(id)
            )

            // 如果有遗漏的标签页，添加到末尾
            const missingTabs = state.openTabs.filter((id) => !validOrder.includes(id))
            const reorderedTabs = [...validOrder, ...missingTabs]

            // 重新分离固定标签页和普通标签页，确保固定标签页在前
            const pinnedTabs = reorderedTabs.filter((id) => {
              const tab = findPageById(id)
              return tab?.pinned || false
            })
            const unpinnedTabs = reorderedTabs.filter((id) => {
              const tab = findPageById(id)
              return !(tab?.pinned || false)
            })

            state.openTabs = [...pinnedTabs, ...unpinnedTabs]
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
    createPersistConfig('tabs-store', 1, (state) => ({
      openTabs: state.openTabs,
      activeTabId: state.activeTabId
    }))
  )
)
