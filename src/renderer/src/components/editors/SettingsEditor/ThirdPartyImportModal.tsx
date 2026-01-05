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
import { parseImportFile, getSupportedPlatforms } from '../../../services/importers'
import { importConversations, getPlatformName } from '../../../services/thirdPartyImportService'
import type {
  ParsedConversation,
  ConversationImporter,
  ImportResult
} from '../../../services/importers/types'

const { Text, Title } = Typography
const { Dragger } = Upload

interface ThirdPartyImportModalProps {
  open: boolean
  onClose: () => void
}

type Step = 'upload' | 'select' | 'importing' | 'done'

// 时间范围预设
const TIME_PRESETS = [
  { label: '全部时间', value: 'all' },
  { label: '最近 7 天', value: '7d' },
  { label: '最近 30 天', value: '30d' },
  { label: '最近 1 年', value: '1y' }
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
  const { message } = App.useApp()

  // 状态
  const [step, setStep] = useState<Step>('upload')
  const [importer, setImporter] = useState<ConversationImporter | null>(null)
  const [conversations, setConversations] = useState<ParsedConversation[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [timePreset, setTimePreset] = useState('all')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [result, setResult] = useState<ImportResult | null>(null)

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

      const result = parseImportFile(data)
      if (!result) {
        message.error('无法识别文件格式，请确保上传正确的导出文件')
        return false
      }

      setImporter(result.importer)
      setConversations(result.conversations)
      // 默认全选
      setSelectedIds(new Set(result.conversations.map((c) => c.id)))
      setStep('select')

      return false
    } catch {
      message.error('文件解析失败，请确保是有效的 JSON 文件')
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
      message.warning('请至少选择一个对话')
      return
    }

    setStep('importing')
    setProgress({ current: 0, total: selectedIds.size })

    try {
      const result = await importConversations(
        conversations,
        {
          conflictStrategy: 'generate-new',
          selectedIds
        },
        (current, total) => {
          setProgress({ current, total })
        }
      )

      setResult(result)
      setStep('done')
    } catch (err) {
      message.error('导入失败: ' + (err instanceof Error ? err.message : '未知错误'))
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
  const columns: TableColumnsType<ParsedConversation> = [
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
      title: '标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (title) => title || '未命名对话'
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 120,
      render: (time) => new Date(time).toLocaleDateString()
    },
    {
      title: '消息数',
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
        <p className="ant-upload-text">点击或拖拽文件到此处</p>
        <p className="ant-upload-hint">支持 .json 格式的导出文件</p>
      </Dragger>

      <Flex align="center" gap={8}>
        <Text type="secondary">支持的平台：</Text>
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
            <Text>检测到平台:</Text>
            <Tag color="blue">{importer?.name}</Tag>
            <Text type="secondary">共 {conversations.length} 个对话</Text>
          </Space>
        }
      />

      <Flex gap={12}>
        <Input
          placeholder="搜索标题..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1 }}
          allowClear
        />
        <Select
          value={timePreset}
          onChange={setTimePreset}
          options={TIME_PRESETS}
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
          已选择 {filteredConversations.filter((c) => selectedIds.has(c.id)).length} /{' '}
          {filteredConversations.length} 个对话
          {selectedIds.size > 0 &&
            selectedIds.size !==
              filteredConversations.filter((c) => selectedIds.has(c.id)).length && (
              <span>（总共选择 {selectedIds.size} 个）</span>
            )}
        </Text>
      </Flex>
    </Flex>
  )

  // 渲染导入进度
  const renderImporting = (): React.ReactNode => (
    <Flex vertical gap={16} align="center" style={{ padding: 12 }}>
      <Title level={4}>正在导入...</Title>
      <Progress
        type="circle"
        percent={Math.round((progress.current / progress.total) * 100)}
        format={() => `${progress.current}/${progress.total}`}
      />
      <Text type="secondary">请勿关闭窗口</Text>
    </Flex>
  )

  // 渲染完成界面
  const renderDone = (): React.ReactNode => {
    if (!result) return null

    const hasErrors = result.failed > 0

    return (
      <Result
        status={hasErrors ? 'warning' : 'success'}
        title="导入完成"
        subTitle={
          <Flex vertical gap={8}>
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text>成功: {result.success} 个</Text>
            </Space>
            {result.skipped > 0 && (
              <Space>
                <Text type="secondary">跳过: {result.skipped} 个</Text>
              </Space>
            )}
            {result.failed > 0 && (
              <Space>
                <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                <Text type="danger">失败: {result.failed} 个</Text>
              </Space>
            )}
          </Flex>
        }
        extra={
          <Button type="primary" onClick={handleClose}>
            完成
          </Button>
        }
      >
        {result.errors.length > 0 && (
          <Alert
            type="error"
            message="错误详情"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {result.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {result.errors.length > 5 && <li>... 还有 {result.errors.length - 5} 个错误</li>}
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
        return (
          <Button onClick={handleClose}>取消</Button>
        )
      case 'select':
        return (
          <Space>
            <Button onClick={() => setStep('upload')}>返回</Button>
            <Button type="primary" onClick={handleImport} disabled={selectedIds.size === 0}>
              导入 {selectedIds.size} 个对话
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
      title={`导入第三方数据${importer ? ` - ${getPlatformName(importer.platform)}` : ''}`}
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
