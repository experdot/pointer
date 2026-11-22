/**
 * 内核 IPC 桥
 *
 * 只做三件事：把通道映射到内核调用、把异常转换为可序列化失败、把事件广播给所有窗口。
 */

import { msg, LocalizedError } from '@shared/i18n/message'

import { BrowserWindow, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import type {
  RuntimeCommandRequest,
  RuntimeQueryRequest,
  RuntimeQueryPayload,
  RuntimeCommandPayload
} from '@shared/contracts'
import { RUNTIME_CHANNELS, toFailure } from '@shared/contracts'
import type { RuntimeCore } from '../runtime'

export function setupRuntimeIpc(runtime: RuntimeCore): void {
  runtime.setFlushHandler(async () => {
    const pending = new AbortController()
    try {
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
                  window.webContents.removeListener('destroyed', destroyed)
                  pending.signal.removeEventListener('abort', canceled)
                }
                const fail = (error: unknown): void => {
                  cleanup()
                  reject(error)
                }
                const destroyed = (): void =>
                  fail(new LocalizedError(msg('errors.flush.windowClosed')))
                const canceled = (): void =>
                  fail(new LocalizedError(msg('errors.flush.otherWindow')))
                const listener = (
                  event: Electron.IpcMainEvent,
                  reply: { id: string; ok: boolean; message?: string }
                ): void => {
                  if (event.sender !== window.webContents || reply.id !== id) return
                  cleanup()
                  if (reply.ok) resolve()
                  else reject(new LocalizedError(reply.message ?? msg('errors.flush.failed')))
                }
                const timer = setTimeout(() => {
                  cleanup()
                  reject(new LocalizedError(msg('errors.flush.timeout')))
                }, 15000)
                ipcMain.on(RUNTIME_CHANNELS.flushed, listener)
                window.webContents.once('destroyed', destroyed)
                pending.signal.addEventListener('abort', canceled, { once: true })
                try {
                  window.webContents.send(RUNTIME_CHANNELS.flush, id)
                } catch (error) {
                  fail(error)
                }
              })
          )
      )
    } finally {
      pending.abort()
    }
  })
  ipcMain.handle(RUNTIME_CHANNELS.query, async (_event, request: RuntimeQueryRequest) => {
    try {
      const value = await runtime.query(
        request.name,
        request.payload as RuntimeQueryPayload<typeof request.name>,
        request.scopeId ?? null
      )
      return { ok: true, scopeId: runtime.getScopeId(), value }
    } catch (error) {
      return toFailure(error)
    }
  })

  ipcMain.handle(RUNTIME_CHANNELS.command, async (_event, request: RuntimeCommandRequest) => {
    try {
      const value = await runtime.command(
        request.name,
        request.payload as RuntimeCommandPayload<typeof request.name>,
        request.scopeId ?? null
      )
      return { ok: true, scopeId: runtime.getScopeId(), value }
    } catch (error) {
      return toFailure(error)
    }
  })

  ipcMain.handle(
    RUNTIME_CHANNELS.prepareDeepSeekIndex,
    async (_event, indexPath: string, scopeId?: string | null) => {
      try {
        const value = await runtime.prepareDeepSeekIndex(indexPath, scopeId ?? null)
        return { ok: true, scopeId: runtime.getScopeId(), value }
      } catch (error) {
        return toFailure(error)
      }
    }
  )

  runtime.subscribe((event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed()) continue
      window.webContents.send(RUNTIME_CHANNELS.event, event)
    }
  })
}
