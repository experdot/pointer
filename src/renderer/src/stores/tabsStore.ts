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
        const newTabs = [...tabs]
        const [removed] = newTabs.splice(fromIndex, 1)
        newTabs.splice(toIndex, 0, removed)
        set({ tabs: newTabs })
      },

      closeOtherTabs: (tabId) =>
        set((state) => ({
          tabs: state.tabs.filter((t) => t.id === tabId),
          activeTabId: tabId
        })),

      closeRightTabs: (tabId) =>
        set((state) => {
          const index = state.tabs.findIndex((t) => t.id === tabId)
          if (index === -1) return state
          const newTabs = state.tabs.slice(0, index + 1)
          const newActiveTabId = newTabs.some((t) => t.id === state.activeTabId)
            ? state.activeTabId
            : tabId
          return { tabs: newTabs, activeTabId: newActiveTabId }
        }),

      closeAllTabs: () => set({ tabs: [], activeTabId: null }),

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
      skipHydration: true // 延迟加载，等待数据库名设置
    }
  )
)

// 注册重置回调
registerStoreReset(
  () => useTabsStore.getState().reset(),
  () => useTabsStore.persist.rehydrate()
)
