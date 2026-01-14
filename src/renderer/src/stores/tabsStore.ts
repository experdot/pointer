import { create } from 'zustand'
import { persistence } from '../persistence/registry'
import { tryRestoreTab, filterValidTabs } from '../utils/tabRegistry'
import type { Tab, TabHistoryEntry } from '../types/type'
import type { ITabStore } from './interfaces/ui'

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
  history: TabHistoryEntry[]
  historyIndex: number
  initialized: boolean
}

interface TabsActions {
  init: () => Promise<void>
  openTab: (tab: Tab, preview?: boolean) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateTabTitle: (tabId: string, title: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  togglePinTab: (tabId: string) => void
  closeOtherTabs: (tabId: string) => void
  closeRightTabs: (tabId: string) => void
  closeAllTabs: () => void
  cleanupInvalidTabs: () => void
  goBack: () => void
  goForward: () => void
  canGoBack: () => boolean
  canGoForward: () => boolean
  clearHistory: () => void
  navigateToHistoryIndex: (index: number) => void
  keepTab: (tabId: string) => void
  reset: () => Promise<void>
}

type TabsStore = TabsState & TabsActions

const initialState: TabsState = {
  tabs: [WELCOME_TAB],
  activeTabId: WELCOME_TAB.id,
  history: [WELCOME_HISTORY_ENTRY],
  historyIndex: 0,
  initialized: false
}

let isNavigating = false

function toHistoryEntry(tab: Tab): TabHistoryEntry {
  return { tabId: tab.id, type: tab.type, dataId: tab.dataId }
}

function computeNewHistory(
  history: TabHistoryEntry[],
  historyIndex: number,
  tab: Tab
): { history: TabHistoryEntry[]; historyIndex: number } {
  if (isNavigating) {
    return { history, historyIndex }
  }
  if (history[historyIndex]?.tabId === tab.id) {
    return { history, historyIndex }
  }
  const newHistory = [...history.slice(0, historyIndex + 1), toHistoryEntry(tab)]
  return { history: newHistory, historyIndex: newHistory.length - 1 }
}

function tryNavigateToHistory(
  history: TabHistoryEntry[],
  startIndex: number,
  direction: 1 | -1,
  tabs: Tab[],
  openTab: (tab: Tab, preview?: boolean) => void
): { targetIndex: number; targetTabId: string } | null {
  for (let i = startIndex; direction === -1 ? i >= 0 : i < history.length; i += direction) {
    const entry = history[i]

    if (tabs.some((t) => t.id === entry.tabId)) {
      return { targetIndex: i, targetTabId: entry.tabId }
    }

    const restoredTab = tryRestoreTab(entry.type, entry.dataId)
    if (restoredTab) {
      isNavigating = true
      try {
        openTab({ ...restoredTab, preview: true }, true)
      } finally {
        isNavigating = false
      }
      return { targetIndex: i, targetTabId: restoredTab.id }
    }
  }

  return null
}

const persist = (state: TabsState): void => {
  persistence.tabs.put({
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    history: state.history,
    historyIndex: state.historyIndex
  })
}

export const useTabsStore = create<TabsStore>((set, get) => ({
  ...initialState,

  init: async () => {
    const data = await persistence.tabs.get()
    if (data) {
      set({ ...data, initialized: true })
    } else {
      set({ initialized: true })
    }
  },

  openTab: (tab, preview = false) => {
    const state = get()
    const { tabs, history, historyIndex } = state
    const existingTab = tabs.find((t) => t.id === tab.id)
    const historyUpdate = computeNewHistory(history, historyIndex, tab)

    let newState: Partial<TabsState>

    if (preview) {
      const existingPreview = tabs.find((t) => t.preview)
      const newTab = { ...tab, preview: true }

      if (existingTab) {
        newState = { activeTabId: tab.id, ...historyUpdate }
      } else if (existingPreview) {
        newState = {
          tabs: tabs.map((t) => (t.preview ? newTab : t)),
          activeTabId: tab.id,
          ...historyUpdate
        }
      } else {
        newState = {
          tabs: [...tabs, newTab],
          activeTabId: tab.id,
          ...historyUpdate
        }
      }
    } else {
      if (existingTab) {
        const newTabs = existingTab.preview
          ? tabs.map((t) => (t.id === tab.id ? { ...t, preview: false } : t))
          : tabs
        newState = { tabs: newTabs, activeTabId: tab.id, ...historyUpdate }
      } else {
        newState = {
          tabs: [...tabs, { ...tab, preview: false }],
          activeTabId: tab.id,
          ...historyUpdate
        }
      }
    }

    set(newState)
    persist({ ...state, ...newState })
  },

  closeTab: (tabId) => {
    const state = get()
    const { tabs, activeTabId } = state
    const index = tabs.findIndex((t) => t.id === tabId)
    if (index === -1) return

    const newTabs = tabs.filter((t) => t.id !== tabId)
    let newActiveTabId = activeTabId

    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        newActiveTabId = newTabs[Math.min(index, newTabs.length - 1)].id
      } else {
        newActiveTabId = null
      }
    }

    const newState = { tabs: newTabs, activeTabId: newActiveTabId }
    set(newState)
    persist({ ...state, ...newState })
  },

  setActiveTab: (tabId) => {
    const state = get()
    const { tabs, history, historyIndex } = state
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return
    const historyUpdate = computeNewHistory(history, historyIndex, tab)
    const newState = { activeTabId: tabId, ...historyUpdate }
    set(newState)
    persist({ ...state, ...newState })
  },

  updateTabTitle: (tabId, title) => {
    const state = get()
    const newTabs = state.tabs.map((t) => (t.id === tabId ? { ...t, title } : t))
    set({ tabs: newTabs })
    persist({ ...state, tabs: newTabs })
  },

  reorderTabs: (fromIndex, toIndex) => {
    const state = get()
    const { tabs } = state
    const removed = tabs[fromIndex]
    if (!removed) return

    const pinnedCount = tabs.filter((t) => t.pinned).length

    if (removed.pinned && toIndex >= pinnedCount) return
    if (!removed.pinned && toIndex < pinnedCount) return

    const newTabs = [...tabs]
    newTabs.splice(fromIndex, 1)
    newTabs.splice(toIndex, 0, removed)
    set({ tabs: newTabs })
    persist({ ...state, tabs: newTabs })
  },

  togglePinTab: (tabId) => {
    const state = get()
    const tabs = state.tabs.map((t) =>
      t.id === tabId ? { ...t, pinned: !t.pinned, preview: t.pinned ? t.preview : false } : t
    )
    const pinnedTabs = tabs.filter((t) => t.pinned)
    const unpinnedTabs = tabs.filter((t) => !t.pinned)
    const newTabs = [...pinnedTabs, ...unpinnedTabs]
    set({ tabs: newTabs })
    persist({ ...state, tabs: newTabs })
  },

  closeOtherTabs: (tabId) => {
    const state = get()
    const newTabs = state.tabs.filter((t) => t.id === tabId || t.pinned)
    const newState = { tabs: newTabs, activeTabId: tabId }
    set(newState)
    persist({ ...state, ...newState })
  },

  closeRightTabs: (tabId) => {
    const state = get()
    const index = state.tabs.findIndex((t) => t.id === tabId)
    if (index === -1) return
    const newTabs = state.tabs.filter((t, i) => i <= index || t.pinned)
    const newActiveTabId = newTabs.some((t) => t.id === state.activeTabId)
      ? state.activeTabId
      : tabId
    const newState = { tabs: newTabs, activeTabId: newActiveTabId }
    set(newState)
    persist({ ...state, ...newState })
  },

  closeAllTabs: () => {
    const state = get()
    const pinnedTabs = state.tabs.filter((t) => t.pinned)
    const newState = { tabs: pinnedTabs, activeTabId: pinnedTabs[0]?.id || null }
    set(newState)
    persist({ ...state, ...newState })
  },

  cleanupInvalidTabs: () => {
    const state = get()
    const newTabs = filterValidTabs(state.tabs)
    const newActiveTabId = newTabs.some((t) => t.id === state.activeTabId)
      ? state.activeTabId
      : newTabs[0]?.id || null
    const newState = { tabs: newTabs, activeTabId: newActiveTabId }
    set(newState)
    persist({ ...state, ...newState })
  },

  goBack: () => {
    const state = get()
    const { history, historyIndex, tabs, openTab } = state
    if (historyIndex <= 0) return

    const result = tryNavigateToHistory(history, historyIndex - 1, -1, tabs, openTab)
    if (result) {
      isNavigating = true
      try {
        const newState = { activeTabId: result.targetTabId, historyIndex: result.targetIndex }
        set(newState)
        persist({ ...get(), ...newState })
      } finally {
        isNavigating = false
      }
    }
  },

  goForward: () => {
    const state = get()
    const { history, historyIndex, tabs, openTab } = state
    if (historyIndex >= history.length - 1) return

    const result = tryNavigateToHistory(history, historyIndex + 1, 1, tabs, openTab)
    if (result) {
      isNavigating = true
      try {
        const newState = { activeTabId: result.targetTabId, historyIndex: result.targetIndex }
        set(newState)
        persist({ ...get(), ...newState })
      } finally {
        isNavigating = false
      }
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
    const state = get()
    const { tabs, activeTabId } = state
    const activeTab = tabs.find((t) => t.id === activeTabId)
    const newState = {
      history: activeTab ? [toHistoryEntry(activeTab)] : [],
      historyIndex: 0
    }
    set(newState)
    persist({ ...state, ...newState })
  },

  navigateToHistoryIndex: (index) => {
    const state = get()
    const { history, tabs, openTab } = state
    if (index < 0 || index >= history.length) return

    const result = tryNavigateToHistory(history, index, 1, tabs, openTab)
    if (result) {
      isNavigating = true
      try {
        const newState = { activeTabId: result.targetTabId, historyIndex: result.targetIndex }
        set(newState)
        persist({ ...get(), ...newState })
      } finally {
        isNavigating = false
      }
    }
  },

  keepTab: (tabId) => {
    const state = get()
    const newTabs = state.tabs.map((t) => (t.id === tabId ? { ...t, preview: false } : t))
    set({ tabs: newTabs })
    persist({ ...state, tabs: newTabs })
  },

  reset: async () => {
    await persistence.tabs.clear()
    set(initialState)
  }
}))

/**
 * 获取标签页 Store 的接口实现
 */
export function getTabStoreInterface(): ITabStore {
  const store = useTabsStore
  return {
    get initialized() {
      return store.getState().initialized
    },
    get tabs() {
      return store.getState().tabs
    },
    get activeTabId() {
      return store.getState().activeTabId
    },
    get history() {
      return store.getState().history
    },
    get historyIndex() {
      return store.getState().historyIndex
    },
    init: () => store.getState().init(),
    reset: () => store.getState().reset(),
    openTab: (tab, preview) => store.getState().openTab(tab, preview),
    closeTab: (tabId) => store.getState().closeTab(tabId),
    setActiveTab: (tabId) => store.getState().setActiveTab(tabId),
    updateTabTitle: (tabId, title) => store.getState().updateTabTitle(tabId, title),
    reorderTabs: (fromIndex, toIndex) => store.getState().reorderTabs(fromIndex, toIndex),
    togglePinTab: (tabId) => store.getState().togglePinTab(tabId),
    closeOtherTabs: (tabId) => store.getState().closeOtherTabs(tabId),
    closeRightTabs: (tabId) => store.getState().closeRightTabs(tabId),
    closeAllTabs: () => store.getState().closeAllTabs(),
    cleanupInvalidTabs: () => store.getState().cleanupInvalidTabs(),
    goBack: () => store.getState().goBack(),
    goForward: () => store.getState().goForward(),
    canGoBack: () => store.getState().canGoBack(),
    canGoForward: () => store.getState().canGoForward(),
    clearHistory: () => store.getState().clearHistory(),
    navigateToHistoryIndex: (index) => store.getState().navigateToHistoryIndex(index),
    keepTab: (tabId) => store.getState().keepTab(tabId)
  }
}
