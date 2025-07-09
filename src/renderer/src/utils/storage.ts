import { AppState, Settings, Page, PageFolder } from '../types'

const STORAGE_KEYS = {
  APP_STATE: 'ai-chat-app-state',
  SETTINGS: 'ai-chat-app-settings',
  PAGES: 'ai-chat-app-pages',
  FOLDERS: 'ai-chat-app-folders'
} as const

export class StorageService {
  // 保存完整应用状态
  static saveAppState(state: AppState): void {
    try {
      // 分离状态保存，提高性能和可靠性
      this.saveSettings(state.settings)
      this.savePages(state.pages)
      this.saveFolders(state.folders)

      // 保存其他UI状态
      const uiState = {
        openTabs: state.openTabs,
        activeTabId: state.activeTabId,
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarWidth: state.sidebarWidth,
        collapsedMessages: state.collapsedMessages,
        allMessagesCollapsed: state.allMessagesCollapsed
      }

      localStorage.setItem(STORAGE_KEYS.APP_STATE, JSON.stringify(uiState))
    } catch (error) {
      console.error('Failed to save app state:', error)
    }
  }

  // 加载完整应用状态
  static loadAppState(): Partial<AppState> | null {
    try {
      const settings = this.loadSettings()
      const pages = this.loadPages()
      const folders = this.loadFolders()
      const uiStateStr = localStorage.getItem(STORAGE_KEYS.APP_STATE)

      let uiState = {}
      if (uiStateStr) {
        uiState = JSON.parse(uiStateStr)
      }

      const result: Partial<AppState> = {
        pages: pages || [],
        folders: folders || [],
        ...uiState
      }

      // 只有当 settings 存在时才添加到结果中
      if (settings) {
        result.settings = settings
      }

      return result
    } catch (error) {
      console.error('Failed to load app state:', error)
      return null
    }
  }

  // 专门保存设置
  static saveSettings(settings: Settings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  // 专门加载设置
  static loadSettings(): Settings | null {
    try {
      const settingsStr = localStorage.getItem(STORAGE_KEYS.SETTINGS)
      if (settingsStr) {
        return JSON.parse(settingsStr)
      }
      return null
    } catch (error) {
      console.error('Failed to load settings:', error)
      return null
    }
  }

  // 保存页面记录
  static savePages(pages: Page[]): void {
    try {
      // 清理流式消息状态，避免保存临时状态
      const cleanPages = pages.map((page) => ({
        ...page,
        streamingMessage: undefined
      }))
      localStorage.setItem(STORAGE_KEYS.PAGES, JSON.stringify(cleanPages))
    } catch (error) {
      console.error('Failed to save pages:', error)
    }
  }

  // 加载页面记录
  static loadPages(): Page[] | null {
    try {
      const pagesStr = localStorage.getItem(STORAGE_KEYS.PAGES)
      if (pagesStr) {
        return JSON.parse(pagesStr)
      }
      return null
    } catch (error) {
      console.error('Failed to load pages:', error)
      return null
    }
  }

  // 保存文件夹
  static saveFolders(folders: PageFolder[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders))
    } catch (error) {
      console.error('Failed to save folders:', error)
    }
  }

  // 加载文件夹
  static loadFolders(): PageFolder[] | null {
    try {
      const foldersStr = localStorage.getItem(STORAGE_KEYS.FOLDERS)
      if (foldersStr) {
        return JSON.parse(foldersStr)
      }
      return null
    } catch (error) {
      console.error('Failed to load folders:', error)
      return null
    }
  }

  // 清除所有数据
  static clearAllData(): void {
    try {
      Object.values(STORAGE_KEYS).forEach((key) => {
        localStorage.removeItem(key)
      })
    } catch (error) {
      console.error('Failed to clear data:', error)
    }
  }

  // 导出数据
  static exportData(): string {
    try {
      const data = {
        settings: this.loadSettings(),
        pages: this.loadPages(),
        folders: this.loadFolders(),
        exportTime: new Date().toISOString()
      }
      return JSON.stringify(data, null, 2)
    } catch (error) {
      console.error('Failed to export data:', error)
      return ''
    }
  }

  // 导入数据
  static importData(dataString: string): boolean {
    try {
      const data = JSON.parse(dataString)

      if (data.settings) {
        this.saveSettings(data.settings)
      }
      if (data.pages) {
        this.savePages(data.pages)
      }
      if (data.folders) {
        this.saveFolders(data.folders)
      }

      return true
    } catch (error) {
      console.error('Failed to import data:', error)
      return false
    }
  }
}
