import { AppState, Settings } from '../types'

const STORAGE_KEYS = {
  APP_STATE: 'ai-chat-app-state',
  SETTINGS: 'ai-chat-app-settings',
  CHATS: 'ai-chat-app-chats',
  FOLDERS: 'ai-chat-app-folders'
}

export class StorageService {
  // 保存完整应用状态
  static saveAppState(state: AppState): void {
    try {
      // 分离状态保存，提高性能和可靠性
      this.saveSettings(state.settings)
      this.saveChats(state.chats)
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
      const chats = this.loadChats()
      const folders = this.loadFolders()
      const uiStateStr = localStorage.getItem(STORAGE_KEYS.APP_STATE)

      let uiState = {}
      if (uiStateStr) {
        uiState = JSON.parse(uiStateStr)
      }

      const result: Partial<AppState> = {
        chats: chats || [],
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

  // 保存聊天记录
  static saveChats(chats: any[]): void {
    try {
      // 清理流式消息状态，避免保存临时状态
      const cleanChats = chats.map((chat) => ({
        ...chat,
        streamingMessage: undefined
      }))
      localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(cleanChats))
    } catch (error) {
      console.error('Failed to save chats:', error)
    }
  }

  // 加载聊天记录
  static loadChats(): any[] | null {
    try {
      const chatsStr = localStorage.getItem(STORAGE_KEYS.CHATS)
      if (chatsStr) {
        return JSON.parse(chatsStr)
      }
      return null
    } catch (error) {
      console.error('Failed to load chats:', error)
      return null
    }
  }

  // 保存文件夹
  static saveFolders(folders: any[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders))
    } catch (error) {
      console.error('Failed to save folders:', error)
    }
  }

  // 加载文件夹
  static loadFolders(): any[] | null {
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
        chats: this.loadChats(),
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
      if (data.chats) {
        this.saveChats(data.chats)
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
