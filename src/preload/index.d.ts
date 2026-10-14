import type { ElectronAPI } from '@electron-toolkit/preload'
import type { RuntimePort } from '../shared/contracts'
import type { ForwardedShortcutAction } from '../shared/shortcuts'

declare global {
  interface Window {
    electron: ElectronAPI
    /** 内核端口：查询、命令与事件订阅 */
    runtime: RuntimePort
    /** 窗口控制 */
    electronWindow: {
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      close: () => Promise<void>
      isMaximized: () => Promise<boolean>
      getPlatform: () => Promise<string>
    }
    /** 主进程转发的全局快捷键动作 */
    shortcuts: {
      onAction: (callback: (action: ForwardedShortcutAction) => void) => () => void
    }
  }
}

export {}
