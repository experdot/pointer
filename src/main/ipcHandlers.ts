import { ipcMain, BrowserWindow, dialog, app } from 'electron'
import { writeFile, readFile } from 'fs/promises'
import { is } from '@electron-toolkit/utils'
import { autoUpdater } from './autoUpdater'

export function setupIpcHandlers(): void {
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

  ipcMain.handle('window-get-platform', () => {
    return process.platform
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

      // Handle both string and Uint8Array/Buffer content
      if (typeof content === 'string') {
        await writeFile(result.filePath!, content, 'utf8')
      } else {
        await writeFile(result.filePath!, Buffer.from(content))
      }
      return { success: true, filePath: result.filePath }
    } catch (error) {
      console.error('Save file error:', error)
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  // Handle read file
  ipcMain.handle('read-file', async (event, filePath: string) => {
    try {
      const buffer = await readFile(filePath)
      const base64 = buffer.toString('base64')
      return { success: true, content: base64 }
    } catch (error) {
      console.error('Read file error:', error)
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  // Handle select files (file picker dialog)
  ipcMain.handle(
    'select-files',
    async (
      event,
      options?: {
        multiple?: boolean
        filters?: Array<{ name: string; extensions: string[] }>
      }
    ) => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openFile', ...(options?.multiple ? ['multiSelections' as const] : [])],
          filters: options?.filters || [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
            { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        })

        if (result.canceled) {
          return { success: false, cancelled: true }
        }

        // Read all selected files and convert to base64
        const files = await Promise.all(
          result.filePaths.map(async (filePath) => {
            const buffer = await readFile(filePath)
            const base64 = buffer.toString('base64')
            const fileName = filePath.split(/[\\/]/).pop() || 'unknown'

            // Get file stats for size
            const stats = await import('fs/promises').then((fs) => fs.stat(filePath))

            return {
              name: fileName,
              path: filePath,
              content: base64,
              size: stats.size
            }
          })
        )

        return { success: true, files }
      } catch (error) {
        console.error('Select files error:', error)
        return { success: false, error: error instanceof Error ? error.message : '未知错误' }
      }
    }
  )
}
