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
import { installApplicationMenu } from './applicationMenu'
import { createI18n, type Translate } from '@shared/i18n'
import { resolveLanguage } from '@shared/domain/locale'
import { formatError } from '@shared/i18n/message'

let startupRuntime: RuntimeCore | undefined
const startupTranslations = createI18n('en-US')
const t: Translate = (key, values) =>
  (startupRuntime?.locale?.translations ?? startupTranslations).t(key, values)

async function startApplication(): Promise<void> {
  await app.whenReady()
  await startupTranslations.instance.changeLanguage(
    resolveLanguage('system', app.getPreferredSystemLanguages())
  )
  electronApp.setAppUserModelId('com.experdot.pointer')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupWindowIpc()

  const runtime = new RuntimeCore({
    appDataPath: app.getPath('userData'),
    host: createRuntimeHost(t)
  })
  startupRuntime = runtime

  const updater = setupAutoUpdater((status) => runtime.setUpdateStatus(status))
  runtime.setUpdater(updater)

  setupRuntimeIpc(runtime)
  await runtime.init()
  installApplicationMenu(t)
  runtime.subscribe((event) => {
    if (event.type === 'app.locale.changed') installApplicationMenu(t)
  })

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
            title: t('native.unsaved'),
            message: formatError(error, t),
            buttons: [t('common.retrySave'), t('common.cancel')],
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

  const message = formatError(error, t)
  const unsupportedData =
    error instanceof RuntimeError &&
    ['settings.invalid-order-key', 'tree.invalid-order-key', 'page.parse-failed'].includes(
      error.code
    )
  try {
    dialog.showErrorBox(
      t('native.startupFailed'),
      t('native.startupDetails', {
        v0: message,
        v1: app.getPath('userData'),
        v2: '\n\n' + t(unsupportedData ? 'native.unsupportedData' : 'native.checkData')
      })
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
