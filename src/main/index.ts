/**
 * 主进程入口
 *
 * 只做四件事：创建窗口、装配内核、接线 IPC、退出时释放内核。
 * 业务逻辑全部位于 src/main/runtime。
 */

import { app, BrowserWindow, dialog } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { RuntimeError } from '@shared/contracts'
import { setupAutoUpdater } from './autoUpdater'
import { setupWindowIpc } from './ipc/windowIpc'
import { setupRuntimeIpc } from './ipc/runtimeIpc'
import { RuntimeCore } from './runtime'
import { createRuntimeHost } from './runtimeHost'
import { createWindow } from './window'

let startupRuntime: RuntimeCore | undefined

async function startApplication(): Promise<void> {
  await app.whenReady()
  electronApp.setAppUserModelId('com.experdot.pointer')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupWindowIpc()

  const runtime = new RuntimeCore({
    appDataPath: app.getPath('userData'),
    host: createRuntimeHost()
  })
  startupRuntime = runtime

  const updater = setupAutoUpdater((status) => runtime.setUpdateStatus(status))
  runtime.setUpdater(updater)

  setupRuntimeIpc(runtime)
  await runtime.init()

  let quitting = false
  let closing: Promise<boolean> | null = null
  const prepare = (): Promise<boolean> => {
    if (closing) return closing
    closing = (async () => {
      for (;;) {
        try {
          await runtime.prepareClose()
          return true
        } catch (error) {
          const result = await dialog.showMessageBox({
            type: 'error',
            title: '尚未完成保存',
            message: error instanceof Error ? error.message : String(error),
            buttons: ['重试保存', '取消'],
            defaultId: 0,
            cancelId: 1
          })
          if (result.response !== 0) return false
          try {
            await runtime.retrySaves()
          } catch {
            /* 下次保存检查继续显示失败原因。 */
          }
        }
      }
    })().finally(() => {
      closing = null
    })
    return closing
  }
  app.on('browser-window-created', (_event, window) => {
    let allowed = false
    window.on('close', (event) => {
      if (quitting || allowed) return
      event.preventDefault()
      void prepare().then((ok) => {
        if (ok && !window.isDestroyed()) {
          allowed = true
          window.close()
        }
      })
    })
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      runtime.resume()
      createWindow()
    }
  })

  app.on('before-quit', (event) => {
    if (quitting) return
    event.preventDefault()
    void prepare()
      .then(async (ok) => {
        if (!ok) return
        await runtime.dispose()
        quitting = true
        app.quit()
      })
      .catch((error) => {
        runtime.resume()
        console.error('[runtime] 关闭失败：', error)
      })
  })
}

void startApplication().catch(async (error: unknown) => {
  console.error('[runtime] 启动失败：', error)
  try {
    await startupRuntime?.dispose()
  } catch (disposeError) {
    console.error('[runtime] 启动失败后释放资源失败：', disposeError)
  }

  const message = error instanceof Error ? error.message : String(error)
  const unsupportedData =
    error instanceof RuntimeError &&
    ['settings.invalid-order-key', 'tree.invalid-order-key', 'page.parse-failed'].includes(
      error.code
    )
  try {
    dialog.showErrorBox(
      'Pointer 启动失败',
      `${message}\n\n数据目录：${app.getPath('userData')}${
        unsupportedData
          ? '\n\n当前版本要求字符串排序键和 v3 页面格式，不支持旧版数字排序数据。请使用当前格式的数据重新启动。'
          : '\n\n请检查数据目录和访问权限后重新启动。'
      }`
    )
  } catch (dialogError) {
    console.error('[runtime] 显示启动错误失败：', dialogError)
  } finally {
    // 初始化未完成时没有可用窗口；释放资源后退出，避免留下无界面的后台进程。
    app.exit(1)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
