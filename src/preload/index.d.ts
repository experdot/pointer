import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ai: {
        sendMessageStreaming: (request: any) => Promise<any>
        sendMessage: (request: any) => Promise<any>
        testConnection: (config: any) => Promise<any>
        stopStreaming: (requestId: string) => Promise<void>
        onStreamData: (requestId: string, callback: (data: any) => void) => void
        removeStreamListener: (requestId: string) => void
      }
      saveFile: (options: {
        content: string | Uint8Array
        defaultPath: string
        filters?: Array<{ name: string; extensions: string[] }>
      }) => Promise<{ success: boolean; cancelled?: boolean; filePath?: string; error?: string }>
      updater: {
        checkForUpdates: () => Promise<any>
        downloadUpdate: () => Promise<any>
        quitAndInstall: () => Promise<void>
        getAppVersion: () => Promise<string>
        onUpdateAvailable: (callback: (info: any) => void) => void
        onUpdateNotAvailable: (callback: (info: any) => void) => void
        onDownloadProgress: (callback: (progress: any) => void) => void
        onUpdateDownloaded: (callback: (info: any) => void) => void
        onUpdateError: (callback: (error: string) => void) => void
        removeAllUpdateListeners: () => void
      }
    }
    electronWindow: {
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      close: () => Promise<void>
      isMaximized: () => Promise<boolean>
    }
  }
}
