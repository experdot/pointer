import { BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'

export function setupAutoUpdater(): void {
  // 设置自动下载为false，手动控制下载过程
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  // 在开发环境中启用自动更新，使用开发配置
  if (is.dev) {
    autoUpdater.updateConfigPath = join(__dirname, '../../dev-app-update.yml')
    // 强制启用开发环境的更新检查
    autoUpdater.forceDevUpdateConfig = true
    // 开发环境下跳过签名验证
    autoUpdater.allowDowngrade = true
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

export { autoUpdater }
