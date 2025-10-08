import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import windowStateKeeper from 'electron-window-state'
import icon from '../../resources/icon.png?asset'

export function createWindow(): void {
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
    // macOS 使用原生窗口控制按钮，其他平台使用自定义
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset', // macOS: 显示原生控制按钮
          trafficLightPosition: { x: 10, y: 10 } // 调整原生按钮位置
        }
      : {
          frame: false, // Windows/Linux: 完全自定义
          titleBarStyle: 'hidden'
        }),
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
