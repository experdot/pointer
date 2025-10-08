import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  AIRequest,
  AIStreamChunk,
  LLMConfig,
  TestConnectionResult,
  GetModelsResult
} from './index.d'

// 管理多个流式监听器
const streamListeners = new Map<string, (data: AIStreamChunk) => void>()

// Custom APIs for renderer
const api = {
  ai: {
    sendMessageStreaming: (request: AIRequest): Promise<void> =>
      ipcRenderer.invoke('ai:send-message-streaming', request),
    testConnection: (config: LLMConfig): Promise<TestConnectionResult> =>
      ipcRenderer.invoke('ai:test-connection', config),
    getModels: (config: LLMConfig): Promise<GetModelsResult> =>
      ipcRenderer.invoke('ai:get-models', config),
    stopStreaming: (requestId: string): Promise<void> =>
      ipcRenderer.invoke('ai:stop-streaming', requestId),
    onStreamData: (requestId: string, callback: (data: AIStreamChunk) => void): void => {
      // 为每个请求ID创建独立的监听器
      streamListeners.set(requestId, callback)

      // 如果是第一个监听器，则设置全局监听器
      if (streamListeners.size === 1) {
        ipcRenderer.on('ai-stream-data', (_, data) => {
          const listener = streamListeners.get(data.requestId)
          if (listener) {
            listener(data)
          }
        })
      }
    },
    removeStreamListener: (requestId: string): void => {
      streamListeners.delete(requestId)

      // 如果没有监听器了，移除全局监听器
      if (streamListeners.size === 0) {
        ipcRenderer.removeAllListeners('ai-stream-data')
      }
    }
  },
  // 文件操作API
  saveFile: (options: {
    content: string | Uint8Array
    defaultPath: string
    filters?: Array<{ name: string; extensions: string[] }>
  }) => ipcRenderer.invoke('save-file', options),

  // 自动更新API
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    onUpdateAvailable: (callback: (info: any) => void) => {
      ipcRenderer.on('update-available', (_, info) => callback(info))
    },
    onUpdateNotAvailable: (callback: (info: any) => void) => {
      ipcRenderer.on('update-not-available', (_, info) => callback(info))
    },
    onDownloadProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('download-progress', (_, progress) => callback(progress))
    },
    onUpdateDownloaded: (callback: (info: any) => void) => {
      ipcRenderer.on('update-downloaded', (_, info) => callback(info))
    },
    onUpdateError: (callback: (error: string) => void) => {
      ipcRenderer.on('update-error', (_, error) => callback(error))
    },
    removeAllUpdateListeners: () => {
      ipcRenderer.removeAllListeners('update-available')
      ipcRenderer.removeAllListeners('update-not-available')
      ipcRenderer.removeAllListeners('download-progress')
      ipcRenderer.removeAllListeners('update-downloaded')
      ipcRenderer.removeAllListeners('update-error')
    }
  }
}

// 窗口控制方法
const windowAPI = {
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  getPlatform: () => ipcRenderer.invoke('window-get-platform')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('electronWindow', windowAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.electronWindow = windowAPI
}
