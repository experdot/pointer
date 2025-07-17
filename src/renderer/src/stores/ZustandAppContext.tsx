import React, { createContext, useContext, ReactNode, useEffect } from 'react'
import { useAppStores } from './useAppStores'

// 创建一个轻量级的Context用于数据初始化
interface ZustandAppContextValue {
  isLoaded: boolean
}

const ZustandAppContext = createContext<ZustandAppContextValue | undefined>(undefined)

// Provider组件
export function ZustandAppProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = React.useState(false)
  const stores = useAppStores()

  // 初始化数据加载
  useEffect(() => {
    const initializeStores = async () => {
      try {
        // 这里可以添加任何需要的初始化逻辑
        // 例如：从旧的storageService迁移数据
        console.log('Zustand stores initialized')
        setIsLoaded(true)
      } catch (error) {
        console.error('Error initializing Zustand stores:', error)
        setIsLoaded(true) // 即使出错也要设置为已加载
      }
    }

    initializeStores()
  }, [])

  return <ZustandAppContext.Provider value={{ isLoaded }}>{children}</ZustandAppContext.Provider>
}

// Hook用于获取Context值
export function useZustandAppContext() {
  const context = useContext(ZustandAppContext)
  if (context === undefined) {
    throw new Error('useZustandAppContext must be used within a ZustandAppProvider')
  }
  return context
}

// 迁移辅助函数
export const migrateFromOldContext = (oldState: any) => {
  const stores = useAppStores()

  try {
    // 迁移页面数据
    if (oldState.pages) {
      stores.pages.importPages(oldState.pages)
    }

    // 迁移文件夹数据
    if (oldState.folders) {
      oldState.folders.forEach((folder: any) => {
        stores.pages.createFolder(folder.name, folder.parentId)
      })
    }

    // 迁移标签页数据
    if (oldState.openTabs) {
      oldState.openTabs.forEach((tabId: string) => {
        stores.tabs.openTab(tabId)
      })
    }

    // 迁移活动标签页
    if (oldState.activeTabId) {
      stores.tabs.setActiveTab(oldState.activeTabId)
    }

    // 迁移UI状态
    if (oldState.selectedNodeId) {
      stores.ui.setSelectedNode(oldState.selectedNodeId, oldState.selectedNodeType)
    }

    if (oldState.sidebarCollapsed !== undefined) {
      if (oldState.sidebarCollapsed) {
        stores.ui.collapseSidebar()
      }
    }

    if (oldState.sidebarWidth) {
      stores.ui.setSidebarWidth(oldState.sidebarWidth)
    }

    // 迁移设置
    if (oldState.settings) {
      stores.settings.updateSettings(oldState.settings)
    }

    // 迁移搜索状态
    if (oldState.searchQuery) {
      stores.search.setSearchQuery(oldState.searchQuery)
    }

    console.log('Migration from old context completed')
  } catch (error) {
    console.error('Error migrating from old context:', error)
  }
}

// 使用示例的Hook
export const useZustandStores = () => {
  return useAppStores()
}
