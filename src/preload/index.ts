/**
 * 预加载脚本
 *
 * 只暴露三类能力：内核端口、窗口控制、全局快捷键转发。
 * 渲染进程无法直接访问文件系统或网络。
 */

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  RUNTIME_CHANNELS,
  type RuntimeCommandName,
  type RuntimeCommandPayload,
  type RuntimeCommandResult,
  type RuntimeEvent,
  type RuntimePort,
  type RuntimeQueryName,
  type RuntimeQueryPayload,
  type RuntimeQueryResult,
  type RuntimeResponse
} from '../shared/contracts'
import type { ForwardedShortcutAction } from '../shared/shortcuts'

function unwrap<T>(response: RuntimeResponse<T>): T {
  if (response.ok) return response.value

  const error = new Error(response.message) as Error & { code: string; details?: unknown }
  error.name = 'RuntimeError'
  error.code = response.code
  error.details = response.details
  throw error
}

const runtime: RuntimePort = {
  query: async <K extends RuntimeQueryName>(
    name: K,
    payload: RuntimeQueryPayload<K>
  ): Promise<RuntimeQueryResult<K>> => {
    const response = (await ipcRenderer.invoke(RUNTIME_CHANNELS.query, {
      name,
      payload
    })) as RuntimeResponse<RuntimeQueryResult<K>>
    return unwrap(response)
  },
  command: async <K extends RuntimeCommandName>(
    name: K,
    payload: RuntimeCommandPayload<K>
  ): Promise<RuntimeCommandResult<K>> => {
    const response = (await ipcRenderer.invoke(RUNTIME_CHANNELS.command, {
      name,
      payload
    })) as RuntimeResponse<RuntimeCommandResult<K>>
    return unwrap(response)
  },
  subscribe: (listener: (event: RuntimeEvent) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: RuntimeEvent): void =>
      listener(payload)
    ipcRenderer.on(RUNTIME_CHANNELS.event, handler)
    return () => ipcRenderer.removeListener(RUNTIME_CHANNELS.event, handler)
  }
}

const electronWindow = {
  minimize: (): Promise<void> => ipcRenderer.invoke('window-minimize'),
  maximize: (): Promise<void> => ipcRenderer.invoke('window-maximize'),
  close: (): Promise<void> => ipcRenderer.invoke('window-close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window-is-maximized'),
  getPlatform: (): Promise<string> => ipcRenderer.invoke('window-get-platform')
}

const shortcuts = {
  onAction: (callback: (action: ForwardedShortcutAction) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: ForwardedShortcutAction): void =>
      callback(action)
    ipcRenderer.on('shortcut:action', listener)
    return () => ipcRenderer.removeListener('shortcut:action', listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('runtime', runtime)
    contextBridge.exposeInMainWorld('electronWindow', electronWindow)
    contextBridge.exposeInMainWorld('shortcuts', shortcuts)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.runtime = runtime
  // @ts-ignore (define in dts)
  window.electronWindow = electronWindow
  // @ts-ignore (define in dts)
  window.shortcuts = shortcuts
}
