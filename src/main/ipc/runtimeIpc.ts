/**
 * 内核 IPC 桥
 *
 * 只做三件事：把通道映射到内核调用、把异常转换为可序列化失败、把事件广播给所有窗口。
 */

import { BrowserWindow, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import type { RuntimeCommandRequest, RuntimeQueryRequest } from '@shared/contracts'
import { RUNTIME_CHANNELS, toFailure } from '@shared/contracts'
import type { RuntimeCore } from '../runtime'

export function setupRuntimeIpc(runtime: RuntimeCore): void {
  runtime.setFlushHandler(async () => {
    await Promise.all(
      BrowserWindow.getAllWindows()
        .filter((window) => !window.isDestroyed())
        .map(
          (window) =>
            new Promise<void>((resolve, reject) => {
              const id = randomUUID()
              const cleanup = (): void => {
                clearTimeout(timer)
                ipcMain.removeListener(RUNTIME_CHANNELS.flushed, listener)
              }
              const listener = (
                event: Electron.IpcMainEvent,
                reply: { id: string; ok: boolean; message?: string }
              ): void => {
                if (event.sender !== window.webContents || reply.id !== id) return
                cleanup()
                if (reply.ok) resolve()
                else reject(new Error(reply.message ?? '界面状态保存失败'))
              }
              const timer = setTimeout(() => {
                cleanup()
                reject(new Error('等待界面保存超时'))
              }, 15000)
              ipcMain.on(RUNTIME_CHANNELS.flushed, listener)
              window.webContents.send(RUNTIME_CHANNELS.flush, id)
            })
        )
    )
  })
  ipcMain.handle(RUNTIME_CHANNELS.query, async (_event, request: RuntimeQueryRequest) => {
    try {
      const value = await runtime.query(request.name, request.payload, request.scopeId ?? null)
      return { ok: true, scopeId: runtime.getScopeId(), value }
    } catch (error) {
      return toFailure(error)
    }
  })

  ipcMain.handle(RUNTIME_CHANNELS.command, async (_event, request: RuntimeCommandRequest) => {
    try {
      const value = await runtime.command(request.name, request.payload, request.scopeId ?? null)
      return { ok: true, scopeId: runtime.getScopeId(), value }
    } catch (error) {
      return toFailure(error)
    }
  })

  runtime.subscribe((event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed()) continue
      window.webContents.send(RUNTIME_CHANNELS.event, event)
    }
  })
}
