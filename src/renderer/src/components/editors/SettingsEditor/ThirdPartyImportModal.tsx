import { t, useI18n } from '@renderer/i18n'
import React, { useState, useMemo, useCallback } from 'react'
import {
  Modal,
  Upload,
  Table,
  Input,
  Select,
  Checkbox,
  Button,
  Space,
  Typography,
  App,
  Flex,
  Progress,
  Result,
  Tag,
  Alert
} from 'antd'
import {
  InboxOutlined,
  SearchOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import type { UploadFile, TableColumnsType } from 'antd'
import { DateTimeText } from '../../common/DateTimeText'
import {
  importConversations,
  getPlatformName,
  getSupportedPlatforms
} from '../../../services/thirdPartyImportService'
import type { ImportedConversation, ImportFormat } from '@renderer/types/shared'
import { detectFormat, parseImport } from '@renderer/types/shared'

type ImportResult = Awaited<ReturnType<typeof importConversations>>

const { Text, Title } = Typography
const { Dragger } = Upload

interface ThirdPartyImportModalProps {
  open: boolean
  onClose: () => void
}

type Step = 'upload' | 'select' | 'importing' | 'done'

// 时间范围预设
const TIME_PRESETS = [
  {
    get label(): string {
      return t('time.all')
    },
    value: 'all'
  },
  {
    get label(): string {
      return t('time.last7Days')
    },
    value: '7d'
  },
  {
    get label(): string {
      return t('time.last30Days')
    },
    value: '30d'
  },
  {
    get label(): string {
      return t('time.lastYear')
    },
    value: '1y'
  }
]

function getTimeRange(preset: string): [number, number] | null {
  const now = Date.now()
  switch (preset) {
    case '7d':
      return [now - 7 * 24 * 60 * 60 * 1000, now]
    case '30d':
      return [now - 30 * 24 * 60 * 60 * 1000, now]
    case '1y':
      return [now - 365 * 24 * 60 * 60 * 1000, now]
    default:
      return null
  }
}

export function ThirdPartyImportModal({
  open,
  onClose
}: ThirdPartyImportModalProps): React.JSX.Element {
  useI18n()

  const { message } = App.useApp()

  // 状态
  const [step, setStep] = useState<Step>('upload')
  const [importer, setImporter] = useState<ImportFormat | null>(null)
  const [conversations, setConversations] = useState<ImportedConversation[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [timePreset, setTimePreset] = useState('all')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [result, setResult] = useState<ImportResult | null>(null)
  const [pendingPayload, setPendingPayload] = useState<{
    text: string
    format: ImportFormat
  } | null>(null)

  // 过滤后的对话列表
  const filteredConversations = useMemo(() => {
    const timeRange = getTimeRange(timePreset)

    return conversations.filter((conv) => {
      // 标题搜索
      if (searchQuery && !conv.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      // 时间范围筛选
      if (timeRange) {
        const [start, end] = timeRange
        if (conv.createdAt < start || conv.createdAt > end) {
          return false
        }
      }
      return true
    })
  }, [conversations, searchQuery, timePreset])

  // 处理文件上传
  const handleFileUpload = async (file: UploadFile): Promise<boolean> => {
    try {
      const text = await (file as unknown as File).text()
      const data = JSON.parse(text)

      const format = detectFormat(data)
      if (!format) {
        message.error(t('import.unrecognized'))
        return false
      }

      const parsed = parseImport(data, format, Date.now(), t)
      if (parsed.conversations.length === 0) {
        message.error(t('import.emptyFile'))
        return false
      }

      setImporter(format)
      setConversations(parsed.conversations)
      // 默认全选
      setSelectedIds(new Set(parsed.conversations.map((c) => c.id)))
      setPendingPayload({ text, format })
      setStep('select')

      return false
    } catch {
      message.error(t('import.invalidJson'))
      return false
    }
  }

  // 全选/取消全选
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(filteredConversations.map((c) => c.id)))
      } else {
        setSelectedIds(new Set())
      }
    },
    [filteredConversations]
  )

  // 单项选择
  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  // 开始导入
  const handleImport = async (): Promise<void> => {
    if (selectedIds.size === 0) {
      message.warning(t('import.selectConversation'))
      return
    }

    setStep('importing')
    setProgress({ current: 0, total: selectedIds.size })

    try {
      if (!pendingPayload) {
        message.error(t('import.uploadFirst'))
        return
      }

      setProgress({ current: 1, total: 1 })
      const result = await importConversations(
        [{ name: 'import.json', content: pendingPayload.text }],
        { platform: pendingPayload.format, ids: [...selectedIds] }
      )

      setResult(result)
      setStep('done')
    } catch (err) {
      message.error(
        t('import.errorColon') + (err instanceof Error ? err.message : t('common.unknownError'))
      )
      setStep('select')
    }
  }

  // 重置并关闭
  const handleClose = (): void => {
    setStep('upload')
    setImporter(null)
    setConversations([])
    setSelectedIds(new Set())
    setSearchQuery('')
    setTimePreset('all')
    setProgress({ current: 0, total: 0 })
    setResult(null)
    onClose()
  }

  // 表格列定义
  const columns: TableColumnsType<ImportedConversation> = [
    {
      title: (
        <Checkbox
          checked={
            filteredConversations.length > 0 &&
            filteredConversations.every((c) => selectedIds.has(c.id))
          }
          indeterminate={
            filteredConversations.some((c) => selectedIds.has(c.id)) &&
            !filteredConversations.every((c) => selectedIds.has(c.id))
          }
          onChange={(e) => handleSelectAll(e.target.checked)}
        />
      ),
      dataIndex: 'select',
      width: 50,
      render: (_, record) => (
        <Checkbox
          checked={selectedIds.has(record.id)}
          onChange={(e) => handleSelectOne(record.id, e.target.checked)}
        />
      )
    },
    {
      title: t('common.title'),
      dataIndex: 'title',
      ellipsis: true,
      render: (title) => title || t('chat.untitled')
    },
    {
      title: t('common.time'),
      dataIndex: 'createdAt',
      width: 120,
      render: (time) => <DateTimeText value={time} style={{ whiteSpace: 'nowrap' }} />
    },
    {
      title: t('import.messageCount'),
      dataIndex: 'messages',
      width: 80,
      render: (messages) => messages?.length || 0
    }
  ]

  // 渲染上传界面
  const renderUpload = (): React.ReactNode => (
    <Flex vertical gap={16}>
      <Dragger accept=".json" showUploadList={false} beforeUpload={handleFileUpload}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text" style={{ fontSize: 14 }}>
          {t('import.dropFile')}
        </p>
        <p className="ant-upload-hint">{t('import.exportFormat')}</p>
      </Dragger>

      <Flex align="center" gap={8}>
        <Text type="secondary">{t('import.platforms')}</Text>
        {getSupportedPlatforms().map((p) => (
          <Tag key={p.platform} color="blue">
            {p.name}
          </Tag>
        ))}
      </Flex>
    </Flex>
  )

  // 渲染选择界面
  const renderSelect = (): React.ReactNode => (
    <Flex vertical gap={12}>
      <Alert
        type="success"
        showIcon
        message={
          <Space>
            <Text>{t('import.detectedPlatform')}</Text>
            <Tag color="blue">{importer ? getPlatformName(importer) : ''}</Tag>
            <Text type="secondary">
              {t('import.conversationTotal', { count: conversations.length })}
            </Text>
          </Space>
        }
      />

      <Flex gap={12}>
        <Input
          placeholder={t('import.searchTitles')}
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1 }}
          allowClear
        />
        <Select
          value={timePreset}
          onChange={setTimePreset}
          options={TIME_PRESETS.map((option) => ({ ...option }))}
          style={{ width: 140 }}
          suffixIcon={<CalendarOutlined />}
        />
      </Flex>

      <Table
        dataSource={filteredConversations}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 10, showSizeChanger: false }}
        scroll={{ y: 300 }}
      />

      <Flex justify="space-between" align="center">
        <Text type="secondary">
          {t('import.selectionCount', {
            selected: filteredConversations.filter((c) => selectedIds.has(c.id)).length,
            total: filteredConversations.length
          })}
          {selectedIds.size > 0 &&
            selectedIds.size !==
              filteredConversations.filter((c) => selectedIds.has(c.id)).length && (
              <span>{t('import.totalSelected', { count: selectedIds.size })}</span>
            )}
        </Text>
      </Flex>
    </Flex>
  )

  // 渲染导入进度
  const renderImporting = (): React.ReactNode => (
    <Flex vertical gap={16} align="center" style={{ padding: 12 }}>
      <Title level={4}>{t('import.importing')}</Title>
      <Progress
        type="circle"
        percent={Math.round((progress.current / progress.total) * 100)}
        format={() => `${progress.current}/${progress.total}`}
      />
      <Text type="secondary">{t('import.keepOpen')}</Text>
    </Flex>
  )

  // 渲染完成界面
  const renderDone = (): React.ReactNode => {
    if (!result) return null

    const hasErrors = result.failed > 0

    return (
      <Result
        status={hasErrors ? 'warning' : 'success'}
        title={t('import.complete')}
        subTitle={
          <Flex vertical gap={8}>
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text>{t('import.successful', { count: result.success })}</Text>
            </Space>
            {result.skipped > 0 && (
              <Space>
                <Text type="secondary">{t('import.skipped', { count: result.skipped })}</Text>
              </Space>
            )}
            {result.failed > 0 && (
              <Space>
                <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                <Text type="danger">{t('import.failed', { count: result.failed })}</Text>
              </Space>
            )}
          </Flex>
        }
        extra={
          <Button type="primary" onClick={handleClose}>
            {t('common.done')}
          </Button>
        }
      >
        {result.errors.length > 0 && (
          <Alert
            type="error"
            message={t('common.errorDetails')}
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {result.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {result.errors.length > 5 && (
                  <li>{t('import.moreErrors', { count: result.errors.length - 5 })}</li>
                )}
              </ul>
            }
          />
        )}
      </Result>
    )
  }

  // 根据步骤渲染内容
  const renderContent = (): React.ReactNode => {
    switch (step) {
      case 'upload':
        return renderUpload()
      case 'select':
        return renderSelect()
      case 'importing':
        return renderImporting()
      case 'done':
        return renderDone()
    }
  }

  // 根据步骤渲染底部按钮
  const renderFooter = (): React.ReactNode => {
    switch (step) {
      case 'upload':
        return <Button onClick={handleClose}>{t('common.cancel')}</Button>
      case 'select':
        return (
          <Space>
            <Button onClick={() => setStep('upload')}>{t('common.back')}</Button>
            <Button type="primary" onClick={handleImport} disabled={selectedIds.size === 0}>
              {t('import.conversations', { count: selectedIds.size })}
            </Button>
          </Space>
        )
      case 'importing':
        return null
      case 'done':
        return null
    }
  }

  return (
    <Modal
      title={t('import.titleSuffix', {
        v0: String(importer ? ` - ${getPlatformName(importer)}` : '')
      })}
      open={open}
      onCancel={step === 'importing' ? undefined : handleClose}
      closable={step !== 'importing'}
      maskClosable={step !== 'importing'}
      footer={renderFooter()}
      width={700}
      destroyOnHidden
    >
      {renderContent()}
    </Modal>
  )
}
