import React, { useEffect } from 'react'
import { Typography, Flex, Card, Button, Space, Progress, Alert, Switch, Badge, App } from 'antd'
import {
  CloudDownloadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import { Streamdown } from 'streamdown'
import { useUpdateStore } from '../../../stores/updateStore'
import { useSettingsStore } from '../../../stores/settingsStore'

const { Text, Paragraph, Link } = Typography

export function AboutPanel(): React.JSX.Element {
  const updateStore = useUpdateStore()
  const { settings, setAutoCheckUpdate } = useSettingsStore()
  const { message, modal } = App.useApp()

  const autoCheckUpdate = settings.autoCheckUpdate ?? true

  const {
    currentVersion,
    checkingForUpdates,
    downloading,
    updateAvailable,
    updateInfo,
    downloadProgress,
    updateDownloaded,
    error
  } = updateStore

  // 初始化时获取当前版本
  useEffect(() => {
    const getCurrentVersion = async (): Promise<void> => {
      try {
        const version = await window.api.updater.getAppVersion()
        updateStore.setCurrentVersion(version)
      } catch (err) {
        console.error('Failed to get app version:', err)
      }
    }
    getCurrentVersion()
  }, [updateStore])

  // 设置更新事件监听器
  useEffect(() => {
    window.api.updater.onUpdateAvailable((info) => {
      console.log('Update available:', info)
      updateStore.handleUpdateAvailable(info)
      message.success('发现新版本！')
    })

    window.api.updater.onUpdateNotAvailable((info) => {
      console.log('Update not available:', info)
      updateStore.handleUpdateNotAvailable(info)
      message.info('当前已是最新版本')
    })

    window.api.updater.onDownloadProgress((progress) => {
      console.log('Download progress:', progress)
      updateStore.handleDownloadProgress(progress)
    })

    window.api.updater.onUpdateDownloaded((info) => {
      console.log('Update downloaded:', info)
      updateStore.handleUpdateDownloaded(info)
      message.success('更新下载完成！')
    })

    window.api.updater.onUpdateError((errorMessage) => {
      console.error('Update error:', errorMessage)
      updateStore.handleUpdateError(errorMessage)
      message.error(`更新失败: ${errorMessage}`)
    })

    return () => {
      window.api.updater.removeAllUpdateListeners()
    }
  }, [message, updateStore])

  const handleCheckForUpdates = async (): Promise<void> => {
    try {
      updateStore.setCheckingForUpdates(true)
      updateStore.setError(null)
      updateStore.setIsStartupCheck(false)

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('检查更新超时')), 30000)
      })

      const updatePromise = window.api.updater.checkForUpdates()
      await Promise.race([updatePromise, timeoutPromise])
    } catch (err) {
      console.error('Check for updates failed:', err)
      const errorMessage = err instanceof Error ? err.message : '检查更新失败'
      updateStore.setError(errorMessage)
      updateStore.setCheckingForUpdates(false)
      message.error(`检查更新失败: ${errorMessage}`)
    }
  }

  const handleDownloadUpdate = async (): Promise<void> => {
    try {
      updateStore.setDownloading(true)
      updateStore.setError(null)
      await window.api.updater.downloadUpdate()
    } catch (err) {
      console.error('Download update failed:', err)
      updateStore.setError(err instanceof Error ? err.message : '下载更新失败')
      updateStore.setDownloading(false)
      message.error('下载更新失败')
    }
  }

  const handleInstallUpdate = (): void => {
    modal.confirm({
      title: '安装更新',
      content: '应用将会关闭并安装更新，然后自动重启。是否继续？',
      icon: <ExclamationCircleOutlined />,
      okText: '安装',
      cancelText: '取消',
      onOk: async () => {
        try {
          await window.api.updater.quitAndInstall()
        } catch (err) {
          console.error('Install update failed:', err)
          message.error('安装更新失败')
        }
      }
    })
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatSpeed = (bytesPerSecond: number): string => {
    return formatBytes(bytesPerSecond) + '/s'
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <Flex vertical gap={16} style={{ maxWidth: 640 }}>
      {/* 应用更新标题 */}
      <Text strong style={{ fontSize: 16 }}>
        应用更新
      </Text>

      {/* 版本和更新设置 */}
      <Card size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Flex justify="space-between" align="center">
            <Text strong>当前版本</Text>
            <Badge count={currentVersion || '获取中...'} color="blue" />
          </Flex>

          <Flex justify="space-between" align="center">
            <Text>自动检查更新</Text>
            <Switch checked={autoCheckUpdate} onChange={setAutoCheckUpdate} size="small" />
          </Flex>
        </Space>
      </Card>

      {/* 更新错误 */}
      {error && (
        <Alert
          message="更新错误"
          description={error}
          type="error"
          closable
          onClose={() => updateStore.setError(null)}
        />
      )}

      {/* 发现新版本 */}
      {updateAvailable && updateInfo && (
        <Card size="small">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Flex align="center" gap={8}>
              <InfoCircleOutlined style={{ color: '#1890ff' }} />
              <Text strong>发现新版本 {updateInfo.version}</Text>
            </Flex>

            {updateInfo.releaseName && (
              <Text type="secondary">发布名称: {updateInfo.releaseName}</Text>
            )}

            {updateInfo.releaseDate && (
              <Text type="secondary">发布日期: {formatDate(updateInfo.releaseDate)}</Text>
            )}

            {updateInfo.releaseNotes && (
              <div>
                <Text strong>更新说明:</Text>
                <div style={{ marginTop: 8 }}>
                  <Streamdown mode="static">{updateInfo.releaseNotes}</Streamdown>
                </div>
              </div>
            )}
          </Space>
        </Card>
      )}

      {/* 下载进度 */}
      {downloading && downloadProgress && (
        <Card size="small">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>下载更新中...</Text>
            <Progress
              percent={Math.round(downloadProgress.percent)}
              status="active"
              format={(percent) => `${percent}%`}
            />
            <Flex justify="space-between">
              <Text type="secondary">
                {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
              </Text>
              <Text type="secondary">{formatSpeed(downloadProgress.bytesPerSecond)}</Text>
            </Flex>
          </Space>
        </Card>
      )}

      {/* 更新下载完成 */}
      {updateDownloaded && (
        <Alert
          message="更新已下载"
          description="更新已下载完成，点击下方按钮重启应用以完成安装。"
          type="success"
          icon={<CheckCircleOutlined />}
        />
      )}

      {/* 操作按钮 */}
      <Space>
        <Button
          icon={<ReloadOutlined />}
          loading={checkingForUpdates}
          onClick={handleCheckForUpdates}
          disabled={downloading}
        >
          检查更新
        </Button>

        {updateAvailable && !updateDownloaded && (
          <Button
            type="primary"
            icon={<CloudDownloadOutlined />}
            loading={downloading}
            onClick={handleDownloadUpdate}
            disabled={checkingForUpdates}
          >
            下载更新
          </Button>
        )}

        {updateDownloaded && (
          <Button type="primary" danger icon={<DownloadOutlined />} onClick={handleInstallUpdate}>
            安装并重启
          </Button>
        )}
      </Space>

      {/* 更新说明 */}
      <Card size="small" style={{ backgroundColor: '#f9f9f9' }}>
        <Space direction="vertical" size="small">
          <Text strong style={{ fontSize: 12 }}>
            更新说明:
          </Text>
          <Text style={{ fontSize: 12 }} type="secondary">
            • 应用会自动检查GitHub上的最新版本
          </Text>
          <Text style={{ fontSize: 12 }} type="secondary">
            • 下载的更新包会在后台验证完整性
          </Text>
          <Text style={{ fontSize: 12 }} type="secondary">
            • 安装更新需要重启应用，请保存好当前工作
          </Text>
        </Space>
      </Card>

      {/* 关于应用标题 */}
      <Text strong style={{ fontSize: 16 }}>
        关于应用
      </Text>

      {/* 应用信息 */}
      <Flex vertical gap={8}>
        <Flex justify="space-between">
          <Text type="secondary">应用名称</Text>
          <Text>Pointer - AI聊天助手</Text>
        </Flex>
        <Flex justify="space-between">
          <Text type="secondary">当前版本</Text>
          <Text>{currentVersion || '获取中...'}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text type="secondary">构建框架</Text>
          <Text>Electron + React + TypeScript</Text>
        </Flex>
        <Flex justify="space-between">
          <Text type="secondary">许可证</Text>
          <Text>MIT 开源许可证</Text>
        </Flex>
        <Flex justify="space-between">
          <Text type="secondary">项目地址</Text>
          <Link href="https://github.com/experdot/pointer" target="_blank">
            GitHub
          </Link>
        </Flex>
      </Flex>

      <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
        一个探索性的 AI 聊天应用，致力于提供更好的 AI 交互体验。
      </Paragraph>
    </Flex>
  )
}
