import React, { useEffect, useState, useRef } from 'react'
import { App, Button, Progress } from 'antd'
import { useSettingsStore } from '../../stores/settingsStore'

interface UpdateInfo {
  version?: string
}

interface DownloadProgress {
  percent: number
}

export default function UpdateNotification(): React.JSX.Element | null {
  const { notification } = App.useApp()
  const { settings } = useSettingsStore()
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [, setUpdateReady] = useState(false)
  const hasCheckedRef = useRef(false)

  const autoCheckUpdate = settings.autoCheckUpdate ?? true

  // 启动时自动检查更新（延迟3秒，只执行一次）
  useEffect(() => {
    const api = window.api
    if (!api?.updater || hasCheckedRef.current || !autoCheckUpdate) return

    const timer = setTimeout(() => {
      if (!hasCheckedRef.current && autoCheckUpdate) {
        hasCheckedRef.current = true
        console.log('启动时自动检查更新...')
        api.updater.checkForUpdates().catch((err) => {
          console.error('Auto check for updates failed:', err)
        })
      }
    }, 3000)

    return () => clearTimeout(timer)
  }, [autoCheckUpdate])

  useEffect(() => {
    const api = window.api
    if (!api?.updater) return

    api.updater.onUpdateAvailable((info: UpdateInfo) => {
      notification.info({
        message: '发现新版本',
        description: `版本 ${info.version || '未知'} 可用`,
        btn: (
          <Button
            type="primary"
            size="small"
            onClick={() => {
              setDownloading(true)
              api.updater.downloadUpdate()
            }}
          >
            下载更新
          </Button>
        ),
        duration: 0
      })
    })

    api.updater.onDownloadProgress((p: DownloadProgress) => {
      setProgress(Math.round(p.percent))
    })

    api.updater.onUpdateDownloaded(() => {
      setDownloading(false)
      setUpdateReady(true)
      notification.success({
        message: '更新已下载',
        description: '重启应用以完成更新',
        btn: (
          <Button type="primary" size="small" onClick={() => api.updater.quitAndInstall()}>
            立即重启
          </Button>
        ),
        duration: 0
      })
    })

    api.updater.onUpdateError((error: string) => {
      setDownloading(false)
      notification.error({
        message: '更新失败',
        description: error
      })
    })

    return () => api.updater.removeAllUpdateListeners()
  }, [notification])

  if (downloading) {
    return (
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
        <Progress type="circle" percent={progress} size={60} />
      </div>
    )
  }

  return null
}
