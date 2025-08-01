import React, { useEffect, useRef } from 'react'
import { Button, Space, App, Progress } from 'antd'
import {
  CloudDownloadOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
  CloseOutlined
} from '@ant-design/icons'
import { useUpdateStore, UpdateInfo } from '../../stores/updateStore'

export default function UpdateNotification() {
  const hasCheckedOnStartup = useRef(false)
  const startupTimerRef = useRef<NodeJS.Timeout | null>(null)
  const { notification } = App.useApp()

  const updateStore = useUpdateStore()

  // 应用启动时自动检查更新（仅执行一次）
  useEffect(() => {
    console.log('UpdateNotification useEffect - 初始化')

    if (!hasCheckedOnStartup.current) {
      console.log('设置启动检查定时器...')

      startupTimerRef.current = setTimeout(() => {
        console.log('启动检查定时器触发')
        if (!hasCheckedOnStartup.current) {
          hasCheckedOnStartup.current = true
          checkForUpdatesOnStartup()
        }
        startupTimerRef.current = null
      }, 3000) // 延迟3秒检查，避免影响应用启动速度
    }

    return () => {
      console.log('清理启动检查定时器')
      if (startupTimerRef.current) {
        clearTimeout(startupTimerRef.current)
        startupTimerRef.current = null
      }
    }
  }, [])

  // 设置更新事件监听器（仅执行一次）
  useEffect(() => {
    console.log('UpdateNotification useEffect - 设置监听器')

    // 设置更新事件监听器
    const handleUpdateAvailable = (info: UpdateInfo) => {
      console.log('收到更新可用事件:', info)
      updateStore.handleUpdateAvailable(info)
      // 重置启动检查标识（有更新可用时需要显示通知）
      updateStore.setIsStartupCheck(false)
      showUpdateAvailableNotification(info)
    }

    const handleUpdateDownloaded = (info: UpdateInfo) => {
      console.log('收到更新下载完成事件:', info)
      updateStore.handleUpdateDownloaded(info)
      showUpdateReadyNotification(info)
    }

    const handleUpdateError = (error: string) => {
      console.error('收到更新错误事件:', error)
      updateStore.handleUpdateError(error)
      // 重置启动检查标识
      updateStore.setIsStartupCheck(false)
      // 静默处理错误，避免过多通知打扰用户
      console.warn('Update check failed:', error)
    }

    const handleUpdateNotAvailable = (info: any) => {
      console.log('收到无更新事件:', info)
      updateStore.handleUpdateNotAvailable(info)

      // 如果是启动检查且已是最新版本，不显示通知
      if (updateStore.isStartupCheck) {
        console.log('启动检查：已是最新版本，不显示通知')
        updateStore.setIsStartupCheck(false) // 重置标识
        return
      }

      // 手动检查时显示通知
      notification.info({
        message: '当前已是最新版本',
        description: `当前版本: ${info.version || '未知'}`,
        placement: 'topRight',
        duration: 3
      })
    }

    const handleDownloadProgress = (progress: any) => {
      console.log('收到下载进度事件:', progress)
      updateStore.handleDownloadProgress(progress)
      updateDownloadProgressNotification(progress)
    }

    // 检查window.api是否存在
    if (!window.api || !window.api.updater) {
      console.error('window.api.updater 不存在！')
      return
    }

    console.log('注册更新事件监听器...')

    // 注册监听器
    window.api.updater.onUpdateAvailable(handleUpdateAvailable)
    window.api.updater.onUpdateDownloaded(handleUpdateDownloaded)
    window.api.updater.onUpdateError(handleUpdateError)
    window.api.updater.onUpdateNotAvailable(handleUpdateNotAvailable)
    window.api.updater.onDownloadProgress(handleDownloadProgress)

    // 清理监听器
    return () => {
      console.log('清理更新事件监听器')
      window.api.updater.removeAllUpdateListeners()
    }
  }, [notification, updateStore])

  // 启动时检查更新
  const checkForUpdatesOnStartup = async () => {
    try {
      console.log('启动时检查更新...')

      if (!window.api || !window.api.updater) {
        console.error('window.api.updater 不存在，无法检查更新')
        return
      }

      // 标记为启动检查
      updateStore.setIsStartupCheck(true)

      const result = await window.api.updater.checkForUpdates()
      console.log('启动检查更新结果:', result)
    } catch (error) {
      console.error('启动检查更新失败:', error)
      // 静默失败，不打扰用户
      console.warn('Startup update check failed:', error)
      // 重置启动检查标识
      updateStore.setIsStartupCheck(false)
    }
  }

  // 显示更新可用通知
  const showUpdateAvailableNotification = (info: UpdateInfo) => {
    const key = `update-available-${Date.now()}`

    console.log('显示更新可用通知:', info)

    notification.info({
      key,
      message: '发现新版本',
      description: (
        <div>
          <p>新版本 {info.version} 已发布</p>
          {info.releaseName && (
            <p style={{ fontSize: '12px', color: '#666' }}>{info.releaseName}</p>
          )}
        </div>
      ),
      icon: <InfoCircleOutlined style={{ color: '#1890ff' }} />,
      duration: 8,
      placement: 'topRight',
      btn: (
        <Space>
          <Button
            size="small"
            onClick={() => {
              notification.destroy(key)
              downloadUpdate()
            }}
          >
            立即下载
          </Button>
          <Button size="small" onClick={() => notification.destroy(key)}>
            稍后提醒
          </Button>
        </Space>
      )
    })
  }

  // 显示更新准备就绪通知
  const showUpdateReadyNotification = (info: UpdateInfo) => {
    const key = `update-ready-${Date.now()}`

    console.log('显示更新准备就绪通知:', info)

    // 清理下载进度通知
    if (updateStore.downloadNotificationKey) {
      notification.destroy(updateStore.downloadNotificationKey)
      updateStore.setDownloadNotificationKey(null)
    }

    // 重置隐藏状态，下次下载时可以再次显示进度
    updateStore.setDownloadNotificationHidden(false)

    notification.success({
      key,
      message: '更新已下载',
      description: (
        <div>
          <p>新版本 {info.version} 已下载完成</p>
          <p style={{ fontSize: '12px', color: '#666' }}>点击"立即安装"重启应用完成更新</p>
        </div>
      ),
      icon: <DownloadOutlined style={{ color: '#52c41a' }} />,
      duration: 0, // 不自动关闭
      placement: 'topRight',
      btn: (
        <Space>
          <Button
            type="primary"
            size="small"
            danger
            onClick={() => {
              notification.destroy(key)
              installUpdate()
            }}
          >
            立即安装
          </Button>
          <Button size="small" onClick={() => notification.destroy(key)}>
            稍后安装
          </Button>
        </Space>
      )
    })
  }

  // 更新下载进度通知
  const updateDownloadProgressNotification = (progress: any) => {
    // 如果用户选择隐藏下载进度通知，就不显示
    if (updateStore.downloadNotificationHidden) {
      return
    }

    const key = updateStore.downloadNotificationKey || `downloading-${Date.now()}`

    if (!updateStore.downloadNotificationKey) {
      updateStore.setDownloadNotificationKey(key)
    }

    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const formatSpeed = (bytesPerSecond: number) => {
      return formatBytes(bytesPerSecond) + '/s'
    }

    notification.info({
      key,
      message: '正在下载更新',
      description: (
        <div>
          <Progress
            percent={Math.round(progress.percent)}
            size="small"
            status="active"
            format={() => `${Math.round(progress.percent)}%`}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#666',
              marginTop: '8px'
            }}
          >
            <span>
              {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
            </span>
            <span>{formatSpeed(progress.bytesPerSecond)}</span>
          </div>
        </div>
      ),
      icon: <CloudDownloadOutlined style={{ color: '#1890ff' }} />,
      duration: 0,
      btn: (
        <Button
          size="small"
          onClick={() => {
            notification.destroy(key)
            updateStore.setDownloadNotificationKey(null)
            updateStore.setDownloadNotificationHidden(true)
          }}
        >
          隐藏
        </Button>
      )
    })
  }

  // 下载更新
  const downloadUpdate = async () => {
    try {
      console.log('开始下载更新...')
      updateStore.setDownloading(true)

      // 重置隐藏状态，显示新的下载进度
      updateStore.setDownloadNotificationHidden(false)

      // 显示初始下载通知
      const downloadKey = `downloading-${Date.now()}`
      updateStore.setDownloadNotificationKey(downloadKey)

      notification.info({
        key: downloadKey,
        message: '准备下载更新',
        description: '正在启动下载...',
        icon: <CloudDownloadOutlined style={{ color: '#1890ff' }} />,
        duration: 2
      })

      await window.api.updater.downloadUpdate()
    } catch (error) {
      console.error('下载更新失败:', error)
      updateStore.setDownloading(false)
      updateStore.setDownloadNotificationKey(null)
      updateStore.setDownloadNotificationHidden(false)

      notification.error({
        message: '下载失败',
        description: '更新下载失败，请稍后重试或手动检查更新',
        duration: 5
      })
    }
  }

  // 安装更新
  const installUpdate = async () => {
    try {
      console.log('开始安装更新...')
      await window.api.updater.quitAndInstall()
    } catch (error) {
      console.error('安装更新失败:', error)
      notification.error({
        message: '安装失败',
        description: '更新安装失败，请稍后重试',
        duration: 5
      })
    }
  }

  // 这个组件不渲染任何可见内容，只处理通知逻辑
  return null
}
