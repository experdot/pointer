import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createIndexedDBStorage } from '../utils/indexedDB'
import { registerStoreReset } from '../utils/storeRegistry'
import { tryRestoreTab, filterValidTabs } from '../utils/tabRegistry'
import type { Tab, TabHistoryEntry } from '../types/type'

// 重新导出 Tab 类型
export type { Tab, TabHistoryEntry } from '../types/type'

const WELCOME_TAB: Tab = {
  id: 'welcome',
  type: 'welcome',
  title: '欢迎',
  closable: true
}

const WELCOME_HISTORY_ENTRY: TabHistoryEntry = {
  tabId: WELCOME_TAB.id,
  type: WELCOME_TAB.type
}

interface TabsState {
  tabs: Tab[]
  activeTabId: string | null
  // 访问历史
  history: TabHistoryEntry[]
  historyIndex: number
}

interface TabsActions {
  openTab: (tab: Tab, preview?: boolean) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateTabTitle: (tabId: string, title: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  togglePinTab: (tabId: string) => void
  closeOtherTabs: (tabId: string) => void
  closeRightTabs: (tabId: string) => void
  closeAllTabs: () => void
  // 清理无效的 tabs（使用注册机制验证）
  cleanupInvalidTabs: () => void
  // 历史导航
  goBack: () => void
  goForward: () => void
  canGoBack: () => boolean
  canGoForward: () => boolean
  clearHistory: () => void
  navigateToHistoryIndex: (index: number) => void
  // 预览模式
  keepTab: (tabId: string) => void
  reset: () => void
}

type TabsStore = TabsState & TabsActions

const initialState: TabsState = {
  tabs: [WELCOME_TAB],
  activeTabId: WELCOME_TAB.id,
  history: [WELCOME_HISTORY_ENTRY],
  historyIndex: 0
}

// 内部标记：是否正在进行历史导航（避免导航时重复添加历史）
let isNavigating = false

// 从 Tab 创建 TabHistoryEntry
function toHistoryEntry(tab: Tab): TabHistoryEntry {
  return { tabId: tab.id, type: tab.type, dataId: tab.dataId }
}

// 统一的历史记录添加逻辑
function computeNewHistory(
  history: TabHistoryEntry[],
  historyIndex: number,
  tab: Tab
): { history: TabHistoryEntry[]; historyIndex: number } {
  // 导航时不修改历史
  if (isNavigating) {
    return { history, historyIndex }
  }
  // 避免重复：如果当前位置已经是该 tabId，不添加
  if (history[historyIndex]?.tabId === tab.id) {
    return { history, historyIndex }
  }
  // 截断并添加新记录
  const newHistory = [...history.slice(0, historyIndex + 1), toHistoryEntry(tab)]
  return { history: newHistory, historyIndex: newHistory.length - 1 }
}

// 尝试导航到历史记录中的某个位置
function tryNavigateToHistory(
  history: TabHistoryEntry[],
  startIndex: number,
  direction: 1 | -1,
  tabs: Tab[],
  openTab: (tab: Tab, preview?: boolean) => void
): { targetIndex: number; targetTabId: string } | null {
  for (let i = startIndex; direction === -1 ? i >= 0 : i < history.length; i += direction) {
    const entry = history[i]

    // 检查 tab 是否存在
    if (tabs.some((t) => t.id === entry.tabId)) {
      return { targetIndex: i, targetTabId: entry.tabId }
    }

    // tab 不存在，尝试通过注册机制恢复
    const restoredTab = tryRestoreTab(entry.type, entry.dataId)
    if (restoredTab) {
      isNavigating = true
      openTab({ ...restoredTab, preview: true }, true)
      isNavigating = false
      return { targetIndex: i, targetTabId: restoredTab.id }
    }
    // 无法恢复，继续查找下一个
  }

  return null
}

export const useTabsStore = create<TabsStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      openTab: (tab, preview = false) => {
        const { tabs, history, historyIndex } = get()
        const existingTab = tabs.find((t) => t.id === tab.id)
        const historyUpdate = computeNewHistory(history, historyIndex, tab)

        if (preview) {
          // 预览模式：替换现有预览 tab 或添加新预览 tab
          const existingPreview = tabs.find((t) => t.preview)
          const newTab = { ...tab, preview: true }

          if (existingTab) {
            // 目标 tab 已存在，激活它
            set({
              activeTabId: tab.id,
              ...historyUpdate
            })
          } else if (existingPreview) {
            // 替换现有预览 tab
            set({
              tabs: tabs.map((t) => (t.preview ? newTab : t)),
              activeTabId: tab.id,
              ...historyUpdate
            })
          } else {
            // 添加新预览 tab
            set({
              tabs: [...tabs, newTab],
              activeTabId: tab.id,
              ...historyUpdate
            })
          }
        } else {
          // 正式打开模式
          if (existingTab) {
            // 如果是预览 tab，转为正式
            const newTabs = existingTab.preview
              ? tabs.map((t) => (t.id === tab.id ? { ...t, preview: false } : t))
              : tabs
            set({
              tabs: newTabs,
              activeTabId: tab.id,
              ...historyUpdate
            })
          } else {
            // 添加新正式 tab
            set({
              tabs: [...tabs, { ...tab, preview: false }],
              activeTabId: tab.id,
              ...historyUpdate
            })
          }
        }
      },

      closeTab: (tabId) => {
        const { tabs, activeTabId } = get()
        const index = tabs.findIndex((t) => t.id === tabId)
        if (index === -1) return

        const newTabs = tabs.filter((t) => t.id !== tabId)
        // 保留历史记录，不删除（可通过后退重新打开）

        let newActiveTabId = activeTabId

        if (activeTabId === tabId) {
          // 关闭当前激活的标签页，切换到相邻标签
          if (newTabs.length > 0) {
            newActiveTabId = newTabs[Math.min(index, newTabs.length - 1)].id
          } else {
            newActiveTabId = null
          }
        }

        set({
          tabs: newTabs,
          activeTabId: newActiveTabId
        })
      },

      setActiveTab: (tabId) => {
        const { tabs, history, historyIndex } = get()
        const tab = tabs.find((t) => t.id === tabId)
        if (!tab) return
        const historyUpdate = computeNewHistory(history, historyIndex, tab)
        set({
          activeTabId: tabId,
          ...historyUpdate
        })
      },

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
          const tabs = state.tabs.map((t) => (t.id === tabId ? { ...t, pinned: !t.pinned } : t))
          // 重新排序：固定的标签在前
          const pinnedTabs = tabs.filter((t) => t.pinned)
          const unpinnedTabs = tabs.filter((t) => !t.pinned)
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

      cleanupInvalidTabs: () =>
        set((state) => {
          const newTabs = filterValidTabs(state.tabs)
          // 如果当前激活的 tab 被清理了，切换到第一个 tab
          const newActiveTabId = newTabs.some((t) => t.id === state.activeTabId)
            ? state.activeTabId
            : newTabs[0]?.id || null
          return { tabs: newTabs, activeTabId: newActiveTabId }
        }),

      goBack: () => {
        const { history, historyIndex, tabs, openTab } = get()
        if (historyIndex <= 0) return

        const result = tryNavigateToHistory(history, historyIndex - 1, -1, tabs, openTab)
        if (result) {
          isNavigating = true
          set({ activeTabId: result.targetTabId, historyIndex: result.targetIndex })
          isNavigating = false
        }
      },

      goForward: () => {
        const { history, historyIndex, tabs, openTab } = get()
        if (historyIndex >= history.length - 1) return

        const result = tryNavigateToHistory(history, historyIndex + 1, 1, tabs, openTab)
        if (result) {
          isNavigating = true
          set({ activeTabId: result.targetTabId, historyIndex: result.targetIndex })
          isNavigating = false
        }
      },

      canGoBack: () => {
        const { historyIndex } = get()
        return historyIndex > 0
      },

      canGoForward: () => {
        const { history, historyIndex } = get()
        return historyIndex < history.length - 1
      },

      clearHistory: () => {
        const { tabs, activeTabId } = get()
        const activeTab = tabs.find((t) => t.id === activeTabId)
        set({
          history: activeTab ? [toHistoryEntry(activeTab)] : [],
          historyIndex: 0
        })
      },

      navigateToHistoryIndex: (index) => {
        const { history, tabs, openTab } = get()
        if (index < 0 || index >= history.length) return

        const result = tryNavigateToHistory(history, index, 1, tabs, openTab)
        if (result) {
          isNavigating = true
          set({ activeTabId: result.targetTabId, historyIndex: result.targetIndex })
          isNavigating = false
        }
      },

      keepTab: (tabId) =>
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, preview: false } : t))
        })),

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
