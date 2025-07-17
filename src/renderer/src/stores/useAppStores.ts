import { usePagesStore } from './pagesStore'
import { useTabsStore } from './tabsStore'
import { useUIStore } from './uiStore'
import { useSearchStore } from './searchStore'
import { useSettingsStore } from './settingsStore'
import { useAITasksStore } from './aiTasksStore'
import { useMessagesStore } from './messagesStore'
import { useCrosstabStore } from './crosstabStore'
import { useObjectStore } from './objectStore'

// 组合所有stores的访问
export const useAppStores = () => {
  const pagesStore = usePagesStore()
  const tabsStore = useTabsStore()
  const uiStore = useUIStore()
  const searchStore = useSearchStore()
  const settingsStore = useSettingsStore()
  const aiTasksStore = useAITasksStore()
  const messagesStore = useMessagesStore()
  const crosstabStore = useCrosstabStore()
  const objectStore = useObjectStore()

  return {
    // 页面管理
    pages: pagesStore,

    // 标签页管理
    tabs: tabsStore,

    // UI状态管理
    ui: uiStore,

    // 搜索管理
    search: searchStore,

    // 设置管理
    settings: settingsStore,

    // AI任务管理
    aiTasks: aiTasksStore,

    // 消息管理
    messages: messagesStore,

    // 交叉表管理
    crosstab: crosstabStore,

    // 对象管理
    object: objectStore
  } as const
}

// 便捷的访问方法
export const usePages = () => usePagesStore()
export const useTabs = () => useTabsStore()
export const useUI = () => useUIStore()
export const useSearch = () => useSearchStore()
export const useSettings = () => useSettingsStore()
export const useAITasks = () => useAITasksStore()
export const useMessages = () => useMessagesStore()
export const useCrosstab = () => useCrosstabStore()
export const useObject = () => useObjectStore()

// 全局store状态清理
export const clearAllStores = () => {
  try {
    // 清理各个store的状态
    usePagesStore.getState().clearAllPages()
    useTabsStore.getState().clearAllTabs()
    useUIStore.getState().clearAllUIState()
    useSearchStore.getState().clearSearch()
    useSettingsStore.getState().resetSettings()
    useAITasksStore.getState().clearAllTasks()

    console.log('All stores cleared successfully')
  } catch (error) {
    console.error('Error clearing stores:', error)
  }
}

// 存储状态监听器
export const subscribeToStores = (callback: () => void) => {
  const unsubscribers = [
    usePagesStore.subscribe(callback),
    useTabsStore.subscribe(callback),
    useUIStore.subscribe(callback),
    useSearchStore.subscribe(callback),
    useSettingsStore.subscribe(callback),
    useAITasksStore.subscribe(callback),
    useMessagesStore.subscribe(callback),
    useCrosstabStore.subscribe(callback),
    useObjectStore.subscribe(callback)
  ]

  // 返回清理函数
  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe())
  }
}
