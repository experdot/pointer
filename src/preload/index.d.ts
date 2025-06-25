import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ai: {
        sendMessageStreaming: (request: any) => Promise<void>
        sendMessage: (request: any) => Promise<{ success: boolean; content?: string; reasoning_content?: string; error?: string }>
        testConnection: (config: any) => Promise<{ success: boolean; error?: string }>
        stopStreaming: () => Promise<void>
        onStreamData: (callback: (data: any) => void) => void
        removeStreamListener: () => void
      }
      saveFile: (options: { 
        content: string; 
        defaultPath: string; 
        filters?: Array<{ name: string; extensions: string[] }> 
      }) => Promise<{ success: boolean; filePath?: string; cancelled?: boolean; error?: string }>
    }
  }
}
