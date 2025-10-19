import { ElectronAPI } from '@electron-toolkit/preload'

export interface LLMConfig {
  apiHost: string
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
  modelConfig: ModelConfig
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
      readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
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
    }
    electronWindow: {
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      close: () => Promise<void>
      isMaximized: () => Promise<boolean>
    }
  }
}
