import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createIndexedDBStorage } from '../utils/indexedDB'
import { registerStoreReset } from '../utils/storeRegistry'

// 标签页类型
export type TabType = 'welcome' | 'chat' | 'settings'

export interface Tab {
  id: string
  type: TabType
  title: string
  pageId?: string // 关联的页面ID（chat类型）
  closable?: boolean // 是否可关闭，默认 true
  pinned?: boolean // 是否固定
}

const WELCOME_TAB: Tab = {
  id: 'welcome',
  type: 'welcome',
  title: '欢迎',
  closable: true
}

interface TabsState {
  tabs: Tab[]
  activeTabId: string | null
}

interface TabsActions {
  openTab: (tab: Tab) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateTabTitle: (tabId: string, title: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  togglePinTab: (tabId: string) => void
  closeOtherTabs: (tabId: string) => void
  closeRightTabs: (tabId: string) => void
  closeAllTabs: () => void
  // 清理无效的 chat tabs（pageId 不存在于 pages 中）
  cleanupInvalidTabs: (validPageIds: string[]) => void
  reset: () => void
}

type TabsStore = TabsState & TabsActions

const initialState: TabsState = {
  tabs: [WELCOME_TAB],
  activeTabId: WELCOME_TAB.id
}

export const useTabsStore = create<TabsStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      openTab: (tab) => {
        const { tabs } = get()
        const existingTab = tabs.find((t) => t.id === tab.id)

        if (existingTab) {
          set({ activeTabId: tab.id })
        } else {
          set({
            tabs: [...tabs, tab],
            activeTabId: tab.id
          })
        }
      },

      closeTab: (tabId) => {
        const { tabs, activeTabId } = get()
        const index = tabs.findIndex((t) => t.id === tabId)
        if (index === -1) return

        const newTabs = tabs.filter((t) => t.id !== tabId)
        let newActiveTabId = activeTabId

        if (activeTabId === tabId) {
          // 关闭当前激活的标签页，切换到相邻标签
          if (newTabs.length > 0) {
            newActiveTabId = newTabs[Math.min(index, newTabs.length - 1)].id
          } else {
            newActiveTabId = null
          }
        }

        set({ tabs: newTabs, activeTabId: newActiveTabId })
      },

      setActiveTab: (tabId) => set({ activeTabId: tabId }),

      updateTabTitle: (tabId, title) =>
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, title } : t))
        })),

      reorderTabs: (fromIndex, toIndex) => {
        const { tabs } = get()
        const removed = tabs[fromIndex]
        if (!removed) return

        // 使用原始数组计算固定标签数量
        const pinnedCount = tabs.filter((t) => t.pinned).length

        if (removed.pinned && toIndex >= pinnedCount) {
          // 固定标签不能移动到非固定区域
          return
        }
        if (!removed.pinned && toIndex < pinnedCount) {
          // 非固定标签不能移动到固定区域
          return
        }

        const newTabs = [...tabs]
        newTabs.splice(fromIndex, 1)
        newTabs.splice(toIndex, 0, removed)
        set({ tabs: newTabs })
      },

      togglePinTab: (tabId) =>
        set((state) => {
          const tabs = state.tabs.map((t) =>
            t.id === tabId ? { ...t, pinned: !t.pinned } : t
          )
          // 重新排序：固定的标签在前
          const pinnedTabs = tabs.filter(t => t.pinned)
          const unpinnedTabs = tabs.filter(t => !t.pinned)
          return { tabs: [...pinnedTabs, ...unpinnedTabs] }
        }),

      closeOtherTabs: (tabId) =>
        set((state) => {
          const newTabs = state.tabs.filter((t) => t.id === tabId || t.pinned)
          return { tabs: newTabs, activeTabId: tabId }
        }),

      closeRightTabs: (tabId) =>
        set((state) => {
          const index = state.tabs.findIndex((t) => t.id === tabId)
          if (index === -1) return state
          // 保留左侧标签和右侧固定标签
          const newTabs = state.tabs.filter((t, i) => i <= index || t.pinned)
          const newActiveTabId = newTabs.some((t) => t.id === state.activeTabId)
            ? state.activeTabId
            : tabId
          return { tabs: newTabs, activeTabId: newActiveTabId }
        }),

      closeAllTabs: () =>
        set((state) => {
          const pinnedTabs = state.tabs.filter((t) => t.pinned)
          return {
            tabs: pinnedTabs,
            activeTabId: pinnedTabs[0]?.id || null
          }
        }),

      cleanupInvalidTabs: (validPageIds) =>
        set((state) => {
          const newTabs = state.tabs.filter(
            (t) => t.type !== 'chat' || (t.pageId && validPageIds.includes(t.pageId))
          )
          // 如果当前激活的 tab 被清理了，切换到第一个 tab
          const newActiveTabId =
            newTabs.some((t) => t.id === state.activeTabId)
              ? state.activeTabId
              : newTabs[0]?.id || null
          return { tabs: newTabs, activeTabId: newActiveTabId }
        }),

      reset: () => set(initialState)
    }),
    {
      name: 'tabs-store',
      storage: createIndexedDBStorage(),
      skipHydration: true, // 延迟加载，等待数据库名设置
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId
      })
    }
  )
)

// 注册重置回调
registerStoreReset(
  () => useTabsStore.getState().reset(),
  () => useTabsStore.persist.rehydrate()
)
