/**
 * 预加载脚本
 *
 * 只暴露三类能力：内核端口、窗口控制、全局快捷键转发。
 * 渲染进程无法直接访问文件系统或网络。
 */

import { contextBridge, ipcRenderer } from 'electron'
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
} from '@shared/contracts'
import type { ForwardedShortcutAction } from '@shared/shortcuts'

function unwrap<T>(response: RuntimeResponse<T>, expectedScope?: string | null): T {
  if (response.ok) {
    if (expectedScope !== undefined && response.scopeId !== expectedScope) {
      throw { name: 'RuntimeError', code: 'runtime.stale-response', message: '已忽略过期响应' }
    }
    return response.value
  }

  // contextBridge 会丢弃 Error 的自定义属性，使用普通数据跨桥后在客户端重建 Error。
  throw {
    name: 'RuntimeError',
    code: response.code,
    message: response.message,
    details: response.details
  }
}

const runtime: RuntimePort = {
  query: async <K extends RuntimeQueryName>(
    name: K,
    payload: RuntimeQueryPayload<K>,
    scopeId?: string | null
  ): Promise<RuntimeQueryResult<K>> => {
    const response = (await ipcRenderer.invoke(RUNTIME_CHANNELS.query, {
      name,
      scopeId,
      payload
    })) as RuntimeResponse<RuntimeQueryResult<K>>
    return unwrap(response, name === 'session.get' ? undefined : scopeId)
  },
  command: async <K extends RuntimeCommandName>(
    name: K,
    payload: RuntimeCommandPayload<K>,
    scopeId?: string | null
  ): Promise<RuntimeCommandResult<K>> => {
    const response = (await ipcRenderer.invoke(RUNTIME_CHANNELS.command, {
      name,
      scopeId,
      payload
    })) as RuntimeResponse<RuntimeCommandResult<K>>
    return unwrap(response, /^(session\.|account\.|workspace\.)/.test(name) ? undefined : scopeId)
  },
  onFlush: (handler): (() => void) => {
    const listener = async (_event: Electron.IpcRendererEvent, id: string): Promise<void> => {
      try {
        await handler()
        ipcRenderer.send(RUNTIME_CHANNELS.flushed, { id, ok: true })
      } catch (error) {
        ipcRenderer.send(RUNTIME_CHANNELS.flushed, {
          id,
          ok: false,
          message: error instanceof Error ? error.message : String(error)
        })
      }
    }
    ipcRenderer.on(RUNTIME_CHANNELS.flush, listener)
    return () => ipcRenderer.removeListener(RUNTIME_CHANNELS.flush, listener)
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
    contextBridge.exposeInMainWorld('runtime', runtime)
    contextBridge.exposeInMainWorld('electronWindow', electronWindow)
    contextBridge.exposeInMainWorld('shortcuts', shortcuts)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.runtime = runtime
  // @ts-ignore (define in dts)
  window.electronWindow = electronWindow
  // @ts-ignore (define in dts)
  window.shortcuts = shortcuts
}
