import { t, useI18n } from '@renderer/i18n'
import React, { useEffect } from 'react'
import {
  Typography,
  Flex,
  Card,
  Button,
  Space,
  Progress,
  Alert,
  Switch,
  Badge,
  App,
  Divider
} from 'antd'
import {
  CloudDownloadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import { Markdown } from '../../common/markdown/Markdown'
import { DateTimeText } from '../../common/DateTimeText'
import { useUpdateStore } from '../../../stores/updateStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { command, query } from '../../../runtime/client'
import { useSavedAction } from '../../../hooks/useSavedAction'

const { Text, Link } = Typography

export function AboutPanel(): React.JSX.Element {
  useI18n()

  const updateStore = useUpdateStore()
  const setCurrentVersion = useUpdateStore((state) => state.setCurrentVersion)
  const { settings, setAutoCheckUpdate } = useSettingsStore()
  const { message, modal } = App.useApp()
  const runSaved = useSavedAction()

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
    let active = true
    const getCurrentVersion = async (): Promise<void> => {
      try {
        const version = await query('app.version', undefined)
        if (active) setCurrentVersion(version)
      } catch (err) {
        console.error('Failed to get app version:', err)
      }
    }
    getCurrentVersion()
    return () => {
      active = false
    }
  }, [setCurrentVersion])

  const handleCheckForUpdates = async (): Promise<void> => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      updateStore.setCheckingForUpdates(true)
      updateStore.setError(null)
      updateStore.setIsStartupCheck(false)

      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(t('update.timeout'))), 30000)
      })

      const updatePromise = command('app.checkUpdate', undefined)
      const result = (await Promise.race([updatePromise, timeoutPromise])) as {
        available: boolean
        version?: string
      }

      updateStore.setCheckingForUpdates(false)
      if (!result.available) {
        message.info(t('update.upToDate'))
      } else {
        message.success(t('update.foundVersion', { v0: String(result.version ?? '') }))
      }
    } catch (err) {
      console.error('Check for updates failed:', err)
      const errorMessage = err instanceof Error ? err.message : t('update.checkFailed')
      updateStore.setError(errorMessage)
      updateStore.setCheckingForUpdates(false)
      message.error(t('update.checkError', { v0: String(errorMessage) }))
    } finally {
      clearTimeout(timer)
    }
  }

  const handleDownloadUpdate = async (): Promise<void> => {
    try {
      updateStore.setDownloading(true)
      updateStore.setError(null)
      await command('app.downloadUpdate', undefined)
    } catch (err) {
      console.error('Download update failed:', err)
      updateStore.setError(err instanceof Error ? err.message : t('update.downloadError'))
      updateStore.setDownloading(false)
      message.error(t('update.downloadError'))
    }
  }

  const handleInstallUpdate = (): void => {
    modal.confirm({
      title: t('update.install'),
      content: t('update.installConfirm'),
      icon: <ExclamationCircleOutlined />,
      okText: t('common.install'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await runSaved(() => command('app.quitAndInstall', undefined))
        } catch (err) {
          console.error('Install update failed:', err)
          message.error(err instanceof Error ? err.message : t('update.installError'))
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

  return (
    <Flex vertical gap={16} style={{ maxWidth: 640 }}>
      {/* 应用更新标题 */}
      <Text strong style={{ fontSize: 16 }}>
        {t('update.title')}
      </Text>

      {/* 版本和更新设置 */}
      <Card size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Flex justify="space-between" align="center">
            <Text strong>{t('update.currentVersion')}</Text>
            <Badge count={currentVersion || t('common.loading')} color="blue" />
          </Flex>

          <Flex justify="space-between" align="center">
            <Text>{t('update.autoCheck')}</Text>
            <Switch checked={autoCheckUpdate} onChange={setAutoCheckUpdate} size="small" />
          </Flex>
        </Space>
      </Card>

      {/* 更新错误 */}
      {error && (
        <Alert
          message={t('update.error')}
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
              <Text strong>
                {t('update.available')}
                {updateInfo.version}
              </Text>
            </Flex>

            {updateInfo.releaseName && (
              <Text type="secondary">
                {t('update.releaseName')}
                {updateInfo.releaseName}
              </Text>
            )}

            {updateInfo.releaseDate && (
              <Text type="secondary">
                {t('update.releaseDate')}
                <DateTimeText value={updateInfo.releaseDate} />
              </Text>
            )}

            {updateInfo.releaseNotes && (
              <div>
                <Text strong>{t('update.releaseNotes')}</Text>
                <div style={{ marginTop: 8 }}>
                  <Markdown content={updateInfo.releaseNotes} />
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
            <Text strong>{t('update.downloading')}</Text>
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
          message={t('update.downloaded')}
          description={t('update.downloadComplete')}
          type="success"
          icon={<CheckCircleOutlined />}
        />
      )}

      {/* 操作按钮 */}
      <Space>
        <Button
          aria-label={t('update.check')}
          icon={<ReloadOutlined />}
          loading={checkingForUpdates}
          onClick={handleCheckForUpdates}
          disabled={downloading}
        >
          {t('update.check')}
        </Button>

        {updateAvailable && !updateDownloaded && (
          <Button
            aria-label={t('update.download')}
            type="primary"
            icon={<CloudDownloadOutlined />}
            loading={downloading}
            onClick={handleDownloadUpdate}
            disabled={checkingForUpdates}
          >
            {t('update.download')}
          </Button>
        )}

        {updateDownloaded && (
          <Button
            aria-label={t('update.installRestart')}
            type="primary"
            danger
            icon={<DownloadOutlined />}
            onClick={handleInstallUpdate}
          >
            {t('update.installRestart')}
          </Button>
        )}
      </Space>

      <Divider style={{ margin: '8px 0' }} />

      {/* 关于应用标题 */}
      <Text strong style={{ fontSize: 16 }}>
        {t('about.title')}
      </Text>

      {/* 应用信息 */}
      <Flex vertical gap={8}>
        <Flex justify="space-between">
          <Text type="secondary">{t('about.nameLabel')}</Text>
          <Text>{t('about.name')}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text type="secondary">{t('update.currentVersion')}</Text>
          <Text>{currentVersion || t('common.loading')}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text type="secondary">{t('about.licenseLabel')}</Text>
          <Text>{t('about.license')}</Text>
        </Flex>
        <Flex justify="space-between">
          <Text type="secondary">{t('about.project')}</Text>
          <Link href="https://github.com/experdot/pointer" target="_blank">
            GitHub
          </Link>
        </Flex>
      </Flex>
    </Flex>
  )
}
