import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import type { UpdateCheckResult, UpdateStatus } from '@shared/contracts'
import { isNewerVersion } from '@shared/domain'

interface UpdaterBridge {
  check: () => Promise<UpdateCheckResult>
  download: () => Promise<void>
  quitAndInstall: () => void
}

export function setupAutoUpdater(report?: (status: UpdateStatus) => void): UpdaterBridge {
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
    // dev 下 allowDowngrade 会让低版本也触发该事件，这里按语义版本过滤
    if (isNewerVersion(info.version, app.getVersion())) {
      report?.({ state: 'available', version: info.version })
    } else {
      console.log('Remote version is not newer, ignored:', info.version, '<=', app.getVersion())
      report?.({ state: 'idle' })
    }
  })

  // 没有更新时的处理
  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available:', info)
    report?.({ state: 'idle' })
  })

  // 更新下载进度
  autoUpdater.on('download-progress', (progressObj) => {
    report?.({ state: 'downloading', percent: progressObj.percent })
  })

  // 更新下载完成
  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info)
    report?.({ state: 'downloaded', version: info.version })
  })

  // 更新错误处理
  autoUpdater.on('error', (error) => {
    console.error('Update error:', error)
    report?.({ state: 'error', message: error.message })
  })

  return {
    check: async () => {
      report?.({ state: 'checking' })
      try {
        const result = await autoUpdater.checkForUpdates()
        const version = result?.updateInfo?.version
        const available = Boolean(version && isNewerVersion(version, app.getVersion()))

        report?.(available ? { state: 'available', version } : { state: 'idle' })
        return { available, version }
      } catch (error) {
        report?.({
          state: 'error',
          message: error instanceof Error ? error.message : String(error)
        })
        return { available: false }
      }
    },
    download: async () => {
      await autoUpdater.downloadUpdate()
    },
    quitAndInstall: () => autoUpdater.quitAndInstall()
  }
}

export { autoUpdater }
