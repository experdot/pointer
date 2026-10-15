/**
 * 内核 IPC 桥
 *
 * 只做三件事：把通道映射到内核调用、把异常转换为可序列化失败、把事件广播给所有窗口。
 */

import { BrowserWindow, ipcMain } from 'electron'
import type { RuntimeCommandRequest, RuntimeQueryRequest } from '@shared/contracts'
import { RUNTIME_CHANNELS, toFailure } from '@shared/contracts'
import type { RuntimeCore } from '../runtime'

export function setupRuntimeIpc(runtime: RuntimeCore): void {
  ipcMain.handle(RUNTIME_CHANNELS.query, async (_event, request: RuntimeQueryRequest) => {
    try {
      return { ok: true, value: await runtime.query(request.name, request.payload) }
    } catch (error) {
      return toFailure(error)
    }
  })

  ipcMain.handle(RUNTIME_CHANNELS.command, async (_event, request: RuntimeCommandRequest) => {
    try {
      return { ok: true, value: await runtime.command(request.name, request.payload) }
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
