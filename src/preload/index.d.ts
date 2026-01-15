import { ElectronAPI } from '@electron-toolkit/preload'

export interface LLMConfig {
  baseUrl: string
  apiKey: string
  modelName: string
}

export interface ModelConfig {
  systemPrompt: string
  topP: number
  temperature: number
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIRequest {
  requestId: string
  llmConfig: LLMConfig
  modelConfig?: ModelConfig
  messages: ChatMessage[]
}

export interface AIStreamChunk {
  requestId: string
  type: 'chunk' | 'complete' | 'error' | 'reasoning_content'
  content?: string
  reasoning_content?: string
  error?: string
}

export interface AIStreamCallbacks {
  onChunk: (chunk: string) => void
  onReasoning?: (reasoning: string) => void
  onComplete?: (fullResponse: string, reasoning?: string) => void
  onError?: (error: string) => void
}

export interface TestConnectionResult {
  success: boolean
  error?: string
}

export interface GetModelsResult {
  success: boolean
  models?: string[]
  error?: string
}

export interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseName?: string
  releaseNotes?: string
}

export interface UpdateCheckResult {
  updateInfo: UpdateInfo
  cancellationToken?: unknown
}

export interface DownloadProgress {
  total: number
  delta: number
  transferred: number
  percent: number
  bytesPerSecond: number
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ai: {
        sendMessageStreaming: (request: AIRequest, callbacks: AIStreamCallbacks) => Promise<string>
        stopStreaming: (requestId: string) => Promise<void>
        testConnection: (config: LLMConfig) => Promise<TestConnectionResult>
        getModels: (config: LLMConfig) => Promise<GetModelsResult>
      }
      saveFile: (options: {
        content: string | Uint8Array
        defaultPath: string
        filters?: Array<{ name: string; extensions: string[] }>
      }) => Promise<{ success: boolean; cancelled?: boolean; filePath?: string; error?: string }>
      readFile: (
        filePath: string
      ) => Promise<{ success: boolean; content?: string; error?: string }>
      selectFiles: (options?: {
        multiple?: boolean
        filters?: Array<{ name: string; extensions: string[] }>
      }) => Promise<{
        success: boolean
        cancelled?: boolean
        files?: Array<{
          name: string
          path: string
          size: number
          content: string
        }>
        error?: string
      }>
      updater: {
        checkForUpdates: () => Promise<UpdateCheckResult | null>
        downloadUpdate: () => Promise<string[]>
        quitAndInstall: () => Promise<void>
        getAppVersion: () => Promise<string>
        onUpdateAvailable: (callback: (info: UpdateInfo) => void) => void
        onUpdateNotAvailable: (callback: (info: UpdateInfo) => void) => void
        onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void
        onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => void
        onUpdateError: (callback: (error: string) => void) => void
        removeAllUpdateListeners: () => void
      }
      attachment: {
        save: (options: {
          fileId: string
          fileName: string
          base64Content: string
          pageId?: string
          messageId?: string
        }) => Promise<{ success: boolean; localPath?: string; error?: string }>
        read: (localPath: string) => Promise<{ success: boolean; content?: string; error?: string }>
        delete: (localPath: string) => Promise<{ success: boolean; error?: string }>
        move: (options: {
          fileId: string
          fileName: string
          fromPath: string
          pageId: string
          messageId: string
        }) => Promise<{ success: boolean; localPath?: string; error?: string }>
        cleanupMessage: (
          pageId: string,
          messageId: string
        ) => Promise<{ success: boolean; error?: string }>
        cleanupPage: (pageId: string) => Promise<{ success: boolean; error?: string }>
        cleanupTemp: () => Promise<{ success: boolean; error?: string }>
      }
      fs: {
        getAppDataPath: () => Promise<string>
        selectDirectory: (options?: {
          title?: string
          defaultPath?: string
        }) => Promise<{
          success: boolean
          cancelled?: boolean
          path?: string
          error?: string
        }>
        readText: (
          filePath: string,
          options?: { allowCustomPath?: boolean }
        ) => Promise<{ success: boolean; content?: string; error?: string }>
        writeText: (
          filePath: string,
          content: string,
          options?: { allowCustomPath?: boolean }
        ) => Promise<{ success: boolean; error?: string }>
        readJson: <T = unknown>(
          filePath: string,
          options?: { allowCustomPath?: boolean }
        ) => Promise<{ success: boolean; data?: T; error?: string }>
        writeJson: (
          filePath: string,
          data: unknown,
          options?: { allowCustomPath?: boolean }
        ) => Promise<{ success: boolean; error?: string }>
        delete: (
          targetPath: string,
          options?: { allowCustomPath?: boolean; recursive?: boolean }
        ) => Promise<{ success: boolean; error?: string }>
        ensureDir: (
          dirPath: string,
          options?: { allowCustomPath?: boolean }
        ) => Promise<{ success: boolean; error?: string }>
        exists: (
          targetPath: string,
          options?: { allowCustomPath?: boolean }
        ) => Promise<{
          success: boolean
          exists?: boolean
          isDirectory?: boolean
          error?: string
        }>
        listDir: (
          dirPath: string,
          options?: { allowCustomPath?: boolean }
        ) => Promise<{
          success: boolean
          entries?: Array<{ name: string; isDirectory: boolean }>
          error?: string
        }>
        copyFile: (
          sourcePath: string,
          destPath: string,
          options?: { allowCustomPath?: boolean }
        ) => Promise<{ success: boolean; error?: string }>
        readBinary: (
          filePath: string,
          options?: { allowCustomPath?: boolean }
        ) => Promise<{ success: boolean; content?: string; error?: string }>
        writeBinary: (
          filePath: string,
          base64Content: string,
          options?: { allowCustomPath?: boolean }
        ) => Promise<{ success: boolean; error?: string }>
      }
    }
    electronWindow: {
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      close: () => Promise<void>
      isMaximized: () => Promise<boolean>
      getPlatform: () => Promise<string>
    }
  }
}
