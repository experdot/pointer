import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import windowStateKeeper from 'electron-window-state'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'
import { aiHandler } from './aiHandler'

// 配置自动更新
function setupAutoUpdater(): void {
  // 设置自动下载为false，我们想手动控制下载过程
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // 在开发环境中启用自动更新，使用开发配置
  if (is.dev) {
    autoUpdater.updateConfigPath = join(__dirname, '../../dev-app-update.yml')
    // 强制启用开发环境的更新检查
    autoUpdater.forceDevUpdateConfig = true
  }

  // 更新可用时的处理
  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info)
    // 通知渲染进程有更新可用
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('update-available', info)
    })
  })

  // 没有更新时的处理
  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available:', info)
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('update-not-available', info)
    })
  })

  // 更新下载进度
  autoUpdater.on('download-progress', (progressObj) => {
    console.log('Download progress:', progressObj)
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('download-progress', progressObj)
    })
  })

  // 更新下载完成
  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info)
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('update-downloaded', info)
    })
  })

  // 更新错误处理
  autoUpdater.on('error', (error) => {
    console.error('Update error:', error)
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('update-error', error.message)
    })
  })
}

function createWindow(): void {
  const mainWindowState = windowStateKeeper({
    defaultWidth: 960,
    defaultHeight: 640,
    fullScreen: false,
    maximize: false
  })
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 480,
    minHeight: 320,
    show: false,
    autoHideMenuBar: true,
    frame: false, // 禁用默认边框，启用自定义标题栏
    titleBarStyle: 'hidden', // 隐藏标题栏
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindowState.manage(mainWindow)
  if (mainWindowState.isMaximized) {
    mainWindow.maximize()
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize AI handler
  aiHandler

  // Setup auto updater
  setupAutoUpdater()

  // 更新相关的IPC处理程序
  ipcMain.handle('check-for-updates', async () => {
    try {
      console.log('IPC: 开始检查更新')

      // 在开发环境中，如果没有强制配置，给出明确的提示
      if (is.dev && !autoUpdater.forceDevUpdateConfig) {
        console.log('开发环境中跳过更新检查，需要设置 forceDevUpdateConfig')
        throw new Error('开发环境中的更新检查已被跳过')
      }

      const result = await autoUpdater.checkForUpdates()
      console.log('IPC: 更新检查完成', result)
      return result
    } catch (error) {
      console.error('IPC: Check for updates error:', error)
      // 确保错误被正确传递到渲染进程
      throw error
    }
  })

  ipcMain.handle('download-update', async () => {
    try {
      console.log('IPC: 开始下载更新')
      const result = await autoUpdater.downloadUpdate()
      console.log('IPC: 更新下载开始', result)
      return result
    } catch (error) {
      console.error('IPC: Download update error:', error)
      throw error
    }
  })

  ipcMain.handle('quit-and-install', () => {
    console.log('IPC: 退出并安装更新')
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('get-app-version', () => {
    const version = app.getVersion()
    console.log('IPC: 获取应用版本', version)
    return version
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // 窗口控制IPC处理程序
  ipcMain.handle('window-minimize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) window.minimize()
  })

  ipcMain.handle('window-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize()
      } else {
        window.maximize()
      }
    }
  })

  ipcMain.handle('window-close', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) window.close()
  })

  ipcMain.handle('window-is-maximized', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    return window ? window.isMaximized() : false
  })

  // Handle save file
  ipcMain.handle('save-file', async (event, { content, defaultPath, filters }) => {
    try {
      const result = await dialog.showSaveDialog({
        title: '保存文件',
        defaultPath: defaultPath,
        filters: filters || [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (result.canceled) {
        return { success: false, cancelled: true }
      }

      await writeFile(result.filePath!, content, 'utf8')
      return { success: true, filePath: result.filePath }
    } catch (error) {
      console.error('Save file error:', error)
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
