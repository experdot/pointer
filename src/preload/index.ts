import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  AIRequest,
  AIStreamChunk,
  AIStreamCallbacks,
  LLMConfig,
  TestConnectionResult,
  GetModelsResult,
  UpdateInfo,
  DownloadProgress
} from './index.d'

// Custom APIs for renderer
const api = {
  ai: {
    sendMessageStreaming: (request: AIRequest, callbacks: AIStreamCallbacks): Promise<string> => {
      return new Promise((resolve, reject) => {
        let fullResponse = ''
        let fullReasoning = ''

        // 创建一个唯一的事件通道
        const eventChannel = `ai-stream-${request.requestId}`

        // 监听流数据
        const handleStreamData = (_: Electron.IpcRendererEvent, data: AIStreamChunk): void => {
          switch (data.type) {
            case 'chunk':
              if (data.content) {
                fullResponse += data.content
                callbacks.onChunk(data.content)
              }
              break
            case 'reasoning_content':
              if (data.reasoning_content) {
                fullReasoning += data.reasoning_content
                callbacks.onReasoning?.(data.reasoning_content)
              }
              break
            case 'complete': {
              ipcRenderer.removeListener(eventChannel, handleStreamData)
              const finalReasoning = data.reasoning_content || fullReasoning || undefined
              callbacks.onComplete?.(fullResponse || data.content || '', finalReasoning)
              resolve(request.requestId)
              break
            }
            case 'error':
              ipcRenderer.removeListener(eventChannel, handleStreamData)
              callbacks.onError?.(data.error || 'Unknown error')
              reject(new Error(data.error || 'Unknown error'))
              break
          }
        }

        ipcRenderer.on(eventChannel, handleStreamData)

        // 发送请求，传递事件通道名称
        ipcRenderer.invoke('ai:send-message-streaming', request, eventChannel).catch((error) => {
          ipcRenderer.removeListener(eventChannel, handleStreamData)
          callbacks.onError?.(error.message)
          reject(error)
        })
      })
    },
    testConnection: (config: LLMConfig): Promise<TestConnectionResult> =>
      ipcRenderer.invoke('ai:test-connection', config),
    getModels: (config: LLMConfig): Promise<GetModelsResult> =>
      ipcRenderer.invoke('ai:get-models', config),
    stopStreaming: (requestId: string): Promise<void> =>
      ipcRenderer.invoke('ai:stop-streaming', requestId)
  },
  // 文件操作API
  saveFile: (options: {
    content: string | Uint8Array
    defaultPath: string
    filters?: Array<{ name: string; extensions: string[] }>
  }) => ipcRenderer.invoke('save-file', options),

  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),

  selectFiles: (options?: {
    multiple?: boolean
    filters?: Array<{ name: string; extensions: string[] }>
  }) => ipcRenderer.invoke('select-files', options),

  // 自动更新API
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    onUpdateAvailable: (callback: (info: UpdateInfo) => void) => {
      ipcRenderer.on('update-available', (_, info) => callback(info))
    },
    onUpdateNotAvailable: (callback: (info: UpdateInfo) => void) => {
      ipcRenderer.on('update-not-available', (_, info) => callback(info))
    },
    onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
      ipcRenderer.on('download-progress', (_, progress) => callback(progress))
    },
    onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => {
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
  },

  // 附件管理API
  attachment: {
    save: (options: {
      fileId: string
      fileName: string
      base64Content: string
      pageId?: string
      messageId?: string
    }) => ipcRenderer.invoke('attachment:save', options),

    read: (localPath: string) => ipcRenderer.invoke('attachment:read', localPath),

    delete: (localPath: string) => ipcRenderer.invoke('attachment:delete', localPath),

    move: (options: {
      fileId: string
      fileName: string
      fromPath: string
      pageId: string
      messageId: string
    }) => ipcRenderer.invoke('attachment:move', options),

    cleanupMessage: (pageId: string, messageId: string) =>
      ipcRenderer.invoke('attachment:cleanup-message', { pageId, messageId }),

    cleanupPage: (pageId: string) => ipcRenderer.invoke('attachment:cleanup-page', pageId),

    cleanupTemp: () => ipcRenderer.invoke('attachment:cleanup-temp')
  },

  // 文件系统 API
  fs: {
    getAppDataPath: (): Promise<string> => ipcRenderer.invoke('fs:get-app-data-path'),

    selectDirectory: (options?: { title?: string; defaultPath?: string }) =>
      ipcRenderer.invoke('fs:select-directory', options),

    readJson: <T = unknown>(
      filePath: string,
      options?: { allowCustomPath?: boolean }
    ): Promise<{ success: boolean; data?: T; error?: string }> =>
      ipcRenderer.invoke('fs:read-json', filePath, options),

    writeJson: (
      filePath: string,
      data: unknown,
      options?: { allowCustomPath?: boolean }
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('fs:write-json', filePath, data, options),

    delete: (
      targetPath: string,
      options?: { allowCustomPath?: boolean; recursive?: boolean }
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('fs:delete', targetPath, options),

    ensureDir: (
      dirPath: string,
      options?: { allowCustomPath?: boolean }
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('fs:ensure-dir', dirPath, options),

    exists: (
      targetPath: string,
      options?: { allowCustomPath?: boolean }
    ): Promise<{ success: boolean; exists?: boolean; isDirectory?: boolean; error?: string }> =>
      ipcRenderer.invoke('fs:exists', targetPath, options),

    listDir: (
      dirPath: string,
      options?: { allowCustomPath?: boolean }
    ): Promise<{
      success: boolean
      entries?: Array<{ name: string; isDirectory: boolean }>
      error?: string
    }> => ipcRenderer.invoke('fs:list-dir', dirPath, options),

    copyFile: (
      sourcePath: string,
      destPath: string,
      options?: { allowCustomPath?: boolean }
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('fs:copy-file', sourcePath, destPath, options),

    readBinary: (
      filePath: string,
      options?: { allowCustomPath?: boolean }
    ): Promise<{ success: boolean; content?: string; error?: string }> =>
      ipcRenderer.invoke('fs:read-binary', filePath, options),

    writeBinary: (
      filePath: string,
      base64Content: string,
      options?: { allowCustomPath?: boolean }
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('fs:write-binary', filePath, base64Content, options)
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
