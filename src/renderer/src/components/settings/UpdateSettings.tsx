import React, { useState, useEffect } from 'react'
import { Card, Button, Space, Progress, Alert, Typography, Divider, App, Switch, Badge } from 'antd'
import {
  CloudDownloadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import { useUpdateStore, UpdateInfo, DownloadProgress } from '../../stores/updateStore'

const { Title, Text, Paragraph } = Typography

export default function UpdateSettings() {
  const updateStore = useUpdateStore()
  const { message, modal } = App.useApp()

  // 解构store状态
  const {
    currentVersion,
    checkingForUpdates,
    downloading,
    updateAvailable,
    updateInfo,
    downloadProgress,
    updateDownloaded,
    error,
    autoCheckEnabled
  } = updateStore

  // 初始化时获取当前版本
  useEffect(() => {
    const getCurrentVersion = async () => {
      try {
        const version = await window.api.updater.getAppVersion()
        updateStore.setCurrentVersion(version)
      } catch (error) {
        console.error('Failed to get app version:', error)
      }
    }
    getCurrentVersion()
  }, [updateStore])

  // 设置更新事件监听器
  useEffect(() => {
    // 更新可用
    window.api.updater.onUpdateAvailable((info) => {
      console.log('Update available:', info)
      updateStore.handleUpdateAvailable(info)
      message.success('发现新版本！')
    })

    // 没有更新
    window.api.updater.onUpdateNotAvailable((info) => {
      console.log('Update not available:', info)
      updateStore.handleUpdateNotAvailable(info)
      message.info('当前已是最新版本')
    })

    // 下载进度
    window.api.updater.onDownloadProgress((progress) => {
      console.log('Download progress:', progress)
      updateStore.handleDownloadProgress(progress)
    })

    // 更新下载完成
    window.api.updater.onUpdateDownloaded((info) => {
      console.log('Update downloaded:', info)
      updateStore.handleUpdateDownloaded(info)
      message.success('更新下载完成！')
    })

    // 更新错误
    window.api.updater.onUpdateError((errorMessage) => {
      console.error('Update error:', errorMessage)
      updateStore.handleUpdateError(errorMessage)
      message.error(`更新失败: ${errorMessage}`)
    })

    // 清理监听器
    return () => {
      window.api.updater.removeAllUpdateListeners()
    }
  }, [message, updateStore])

  // 检查更新
  const handleCheckForUpdates = async () => {
    try {
      updateStore.setCheckingForUpdates(true)
      updateStore.setError(null)

      console.log('开始检查更新...')

      // 设置超时处理
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('检查更新超时')), 30000) // 30秒超时
      })

      // 同时运行更新检查和超时检查
      const updatePromise = window.api.updater.checkForUpdates()

      await Promise.race([updatePromise, timeoutPromise])

      console.log('更新检查请求已发送')

      // 等待2秒后如果还没有收到响应，给用户反馈
      setTimeout(() => {
        if (updateStore.checkingForUpdates) {
          console.log('等待更新服务器响应...')
        }
      }, 2000)
    } catch (error) {
      console.error('Check for updates failed:', error)
      const errorMessage = error instanceof Error ? error.message : '检查更新失败'
      updateStore.setError(errorMessage)
      updateStore.setCheckingForUpdates(false)
      message.error(`检查更新失败: ${errorMessage}`)
    }
  }

  // 下载更新
  const handleDownloadUpdate = async () => {
    try {
      updateStore.setDownloading(true)
      updateStore.setError(null)
      await window.api.updater.downloadUpdate()
    } catch (error) {
      console.error('Download update failed:', error)
      updateStore.setError(error instanceof Error ? error.message : '下载更新失败')
      updateStore.setDownloading(false)
      message.error('下载更新失败')
    }
  }

  // 安装更新
  const handleInstallUpdate = () => {
    modal.confirm({
      title: '安装更新',
      content: '应用将会关闭并安装更新，然后自动重启。是否继续？',
      icon: <ExclamationCircleOutlined />,
      okText: '安装',
      cancelText: '取消',
      onOk: async () => {
        try {
          await window.api.updater.quitAndInstall()
        } catch (error) {
          console.error('Install update failed:', error)
          message.error('安装更新失败')
        }
      }
    })
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

  return (
    <div style={{ padding: '16px 0' }}>
      <Title level={4}>应用更新</Title>

      {/* 当前版本信息 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>当前版本</Text>
            <Badge count={currentVersion} color="blue" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text>自动检查更新</Text>
            <Switch
              checked={autoCheckEnabled}
              onChange={updateStore.setAutoCheckEnabled}
              size="small"
            />
          </div>
        </Space>
      </Card>

      {/* 更新状态 */}
      {error && (
        <Alert
          message="更新错误"
          description={error}
          type="error"
          closable
          onClose={() => updateStore.setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {updateAvailable && updateInfo && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <InfoCircleOutlined style={{ color: '#1890ff' }} />
              <Text strong>发现新版本 {updateInfo.version}</Text>
            </div>

            {updateInfo.releaseName && (
              <Text type="secondary">发布名称: {updateInfo.releaseName}</Text>
            )}

            {updateInfo.releaseDate && (
              <Text type="secondary">
                发布日期: {new Date(updateInfo.releaseDate).toLocaleDateString()}
              </Text>
            )}

            {updateInfo.releaseNotes && (
              <div>
                <Text strong>更新说明:</Text>
                <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                  {updateInfo.releaseNotes}
                </Paragraph>
              </div>
            )}
          </Space>
        </Card>
      )}

      {/* 下载进度 */}
      {downloading && downloadProgress && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>下载更新中...</Text>
            <Progress
              percent={Math.round(downloadProgress.percent)}
              status="active"
              format={(percent) => `${percent}%`}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">
                {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
              </Text>
              <Text type="secondary">{formatSpeed(downloadProgress.bytesPerSecond)}</Text>
            </div>
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
          style={{ marginBottom: 16 }}
        />
      )}

      <Divider />

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

      {/* 帮助信息 */}
      <Card size="small" style={{ marginTop: 16, backgroundColor: '#f9f9f9' }}>
        <Space direction="vertical" size="small">
          <Text strong style={{ fontSize: '12px' }}>
            更新说明:
          </Text>
          <Text style={{ fontSize: '12px' }} type="secondary">
            • 应用会自动检查GitHub上的最新版本
          </Text>
          <Text style={{ fontSize: '12px' }} type="secondary">
            • 下载的更新包会在后台验证完整性
          </Text>
          <Text style={{ fontSize: '12px' }} type="secondary">
            • 安装更新需要重启应用，请保存好当前工作
          </Text>
        </Space>
      </Card>

      {/* 关于信息 */}
      <Card size="small" style={{ marginTop: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong>关于应用</Text>
          <Divider style={{ margin: '8px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">应用名称</Text>
            <Text>Pointer - AI聊天助手</Text>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">当前版本</Text>
            <Text>{currentVersion || '获取中...'}</Text>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">构建框架</Text>
            <Text>Electron + React + TypeScript</Text>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">许可证</Text>
            <Text>MIT 开源许可证</Text>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">项目地址</Text>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, height: 'auto' }}
              onClick={() => window.open('https://github.com/experdot/pointer', '_blank')}
            >
              GitHub
            </Button>
          </div>

          <Paragraph style={{ margin: '8px 0 0 0', fontSize: '12px' }} type="secondary">
            一个探索性的AI聊天应用，提供智能对话、交叉表分析、对象管理等功能，
            致力于提供更好的AI交互体验。
          </Paragraph>
        </Space>
      </Card>
    </div>
  )
}
