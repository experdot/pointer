/**
 * 更新通知
 *
 * 状态来自内核事件（app.updateStatus），操作通过内核命令发起。
 */

import React, { useEffect, useState } from 'react'
import { App, Button, Progress } from 'antd'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUpdateStore } from '../../stores/updateStore'
import { command } from '../../runtime/client'

export function UpdateNotification(): React.JSX.Element | null {
  const { notification } = App.useApp()
  const autoCheckUpdate = useSettingsStore((state) => state.settings.autoCheckUpdate ?? true)
  const updateAvailable = useUpdateStore((state) => state.updateAvailable)
  const updateVersion = useUpdateStore((state) => state.updateInfo?.version)
  const updateDownloaded = useUpdateStore((state) => state.updateDownloaded)
  const updateError = useUpdateStore((state) => state.error)
  const downloading = useUpdateStore((state) => state.downloading)
  const percent = useUpdateStore((state) => state.downloadProgress?.percent ?? 0)
  const [startupChecked, setStartupChecked] = useState(false)

  // 启动后延迟检查一次
  useEffect(() => {
    if (startupChecked || !autoCheckUpdate) return
    const timer = setTimeout(() => {
      setStartupChecked(true)
      void command('app.checkUpdate', undefined).catch((error) => {
        console.error('自动检查更新失败：', error)
      })
    }, 3000)
    return () => clearTimeout(timer)
  }, [autoCheckUpdate, startupChecked])

  useEffect(() => {
    if (!updateAvailable) return
    notification.info({
      message: '发现新版本',
      description: `版本 ${updateVersion ?? '未知'} 可用`,
      btn: (
        <Button
          type="primary"
          size="small"
          onClick={() => {
            void command('app.downloadUpdate', undefined)
          }}
        >
          下载更新
        </Button>
      ),
      duration: 0
    })
  }, [notification, updateAvailable, updateVersion])

  useEffect(() => {
    if (!updateDownloaded) return
    notification.success({
      message: '更新已下载',
      description: '重启应用以完成更新',
      btn: (
        <Button
          type="primary"
          size="small"
          onClick={() => {
            void command('app.quitAndInstall', undefined)
          }}
        >
          立即重启
        </Button>
      ),
      duration: 0
    })
  }, [notification, updateDownloaded])

  useEffect(() => {
    if (!updateError) return
    notification.error({ message: '更新失败', description: updateError })
  }, [notification, updateError])

  if (downloading) {
    return (
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
        <Progress type="circle" percent={Math.round(percent)} size={60} />
      </div>
    )
  }

  return null
}
