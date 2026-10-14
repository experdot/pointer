/**
 * 主进程入口
 *
 * 只做四件事：创建窗口、装配内核、接线 IPC、退出时释放内核。
 * 业务逻辑全部位于 src/main/runtime。
 */

import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { setupAutoUpdater } from './autoUpdater'
import { setupWindowIpc } from './ipc/windowIpc'
import { setupRuntimeIpc } from './ipc/runtimeIpc'
import { RuntimeCore } from './runtime'
import { createRuntimeHost } from './runtimeHost'
import { createWindow } from './window'

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.experdot.pointer')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupWindowIpc()

  const runtime = new RuntimeCore({
    appDataPath: app.getPath('userData'),
    host: createRuntimeHost()
  })

  const updater = setupAutoUpdater((status) => runtime.setUpdateStatus(status))
  runtime.setUpdater(updater)

  setupRuntimeIpc(runtime)
  await runtime.init()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  app.on('before-quit', () => {
    runtime.dispose()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
