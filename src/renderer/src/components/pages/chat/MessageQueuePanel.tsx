import React, { useState, useCallback } from 'react'
import {
  Card,
  List,
  Button,
  Space,
  Tag,
  Tooltip,
  Popconfirm,
  Badge,
  Input,
  Modal,
  Typography,
  Empty,
  Switch,
  Dropdown
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  CloseCircleOutlined,
  ClearOutlined,
  MenuOutlined,
  SettingOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  MoreOutlined,
  PlusOutlined
} from '@ant-design/icons'
import { MessageQueueItem, MessageQueueConfig } from '../../../types/type'

const { TextArea } = Input
const { Text } = Typography

interface MessageQueuePanelProps {
  queue: MessageQueueItem[]
  config: MessageQueueConfig
  currentlyProcessing: string | null
  selectedModel?: string
  onAddToQueue: (content: string, modelId?: string, options?: { autoResume?: boolean }) => string
  onRemoveFromQueue: (itemId: string) => void
  onEditQueueItem: (itemId: string, newContent: string) => void
  onClearQueue: () => void
  onClearCompletedItems: () => void
  onRetryQueueItem: (itemId: string) => void
  onProcessNext: () => void
  onUpdateConfig: (config: Partial<MessageQueueConfig>) => void
  onReorderQueue: (fromIndex: number, toIndex: number) => void
}

export default function MessageQueuePanel({
  queue,
  config,
  currentlyProcessing,
  selectedModel,
  onAddToQueue,
  onRemoveFromQueue,
  onEditQueueItem,
  onClearQueue,
  onClearCompletedItems,
  onRetryQueueItem,
  onProcessNext,
  onUpdateConfig,
  onReorderQueue
}: MessageQueuePanelProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [configModalVisible, setConfigModalVisible] = useState(false)

  const handleStartEdit = useCallback((item: MessageQueueItem) => {
    setEditingItemId(item.id)
    setEditContent(item.content)
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (editingItemId && editContent.trim()) {
      onEditQueueItem(editingItemId, editContent.trim())
      setEditingItemId(null)
      setEditContent('')
    }
  }, [editingItemId, editContent, onEditQueueItem])

  const handleCancelEdit = useCallback((itemId: string, isNewItem: boolean) => {
    // 如果是新添加的空项且用户取消了，则删除它
    if (isNewItem && !editContent.trim()) {
      onRemoveFromQueue(itemId)
    }
    setEditingItemId(null)
    setEditContent('')
  }, [editContent, onRemoveFromQueue])

  const handleAddMessage = useCallback(() => {
    // 直接添加一个空的待编辑项
    const newItemId = onAddToQueue('', selectedModel)
    // 立即进入编辑状态
    setEditingItemId(newItemId)
    setEditContent('')
  }, [onAddToQueue, selectedModel])

  const getStatusIcon = (status: MessageQueueItem['status']) => {
    switch (status) {
      case 'pending':
        return <ClockCircleOutlined style={{ color: '#faad14' }} />
      case 'processing':
        return <PlayCircleOutlined style={{ color: '#1890ff' }} spin />
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'failed':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return null
    }
  }

  const getStatusTag = (status: MessageQueueItem['status']) => {
    const statusConfig = {
      pending: { color: 'warning', text: '等待中' },
      processing: { color: 'processing', text: '处理中' },
      completed: { color: 'success', text: '已完成' },
      failed: { color: 'error', text: '失败' }
    }
    const config = statusConfig[status]
    return <Tag color={config.color}>{config.text}</Tag>
  }

  const stats = {
    total: queue.length,
    pending: queue.filter((item) => item.status === 'pending').length,
    processing: queue.filter((item) => item.status === 'processing').length,
    completed: queue.filter((item) => item.status === 'completed').length,
    failed: queue.filter((item) => item.status === 'failed').length
  }

  const sortedQueue = [...queue].sort((a, b) => a.order - b.order)

  return (
    <div className="message-queue-panel">
      <Card
        title={
          <Space>
            <span>消息队列</span>
            <Badge count={stats.pending} style={{ backgroundColor: '#faad14' }} />
          </Space>
        }
        size="small"
        extra={
          <Space>
            <Tooltip title="添加消息">
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleAddMessage}
              />
            </Tooltip>
            <Tooltip title="队列设置">
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                onClick={() => setConfigModalVisible(true)}
              />
            </Tooltip>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'clearCompleted',
                    label: '清除已完成',
                    icon: <ClearOutlined />,
                    onClick: onClearCompletedItems,
                    disabled: stats.completed === 0 && stats.failed === 0
                  },
                  {
                    key: 'clearAll',
                    label: '清空队列',
                    icon: <DeleteOutlined />,
                    danger: true,
                    onClick: () => {
                      Modal.confirm({
                        title: '确认清空队列？',
                        content: '这将删除所有待处理的消息，正在处理的消息不会被删除。',
                        onOk: onClearQueue
                      })
                    },
                    disabled: queue.length === 0
                  }
                ]
              }}
            >
              <Button type="text" size="small" icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        }
        className="queue-card"
      >
        {/* 统计信息 */}
        <div style={{ marginBottom: 12 }}>
          <Space size="small" wrap>
            <Text type="secondary" style={{ fontSize: 12 }}>
              总计: {stats.total}
            </Text>
            {stats.pending > 0 && (
              <Text style={{ fontSize: 12, color: '#faad14' }}>等待: {stats.pending}</Text>
            )}
            {stats.processing > 0 && (
              <Text style={{ fontSize: 12, color: '#1890ff' }}>处理中: {stats.processing}</Text>
            )}
            {stats.completed > 0 && (
              <Text style={{ fontSize: 12, color: '#52c41a' }}>完成: {stats.completed}</Text>
            )}
            {stats.failed > 0 && (
              <Text style={{ fontSize: 12, color: '#ff4d4f' }}>失败: {stats.failed}</Text>
            )}
          </Space>
        </div>

        {/* 队列列表 */}
        {sortedQueue.length === 0 ? (
          <Empty
            description="队列为空"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '20px 0' }}
          />
        ) : (
          <List
            size="small"
            dataSource={sortedQueue}
            renderItem={(item, index) => (
              <List.Item
                key={item.id}
                className={`queue-item queue-item-${item.status}`}
                style={{
                  backgroundColor:
                    item.status === 'processing' ? '#e6f7ff' : item.status === 'failed' ? '#fff1f0' : undefined,
                  padding: '8px 12px',
                  marginBottom: 8,
                  borderRadius: 4,
                  border: '1px solid #f0f0f0'
                }}
              >
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ marginRight: 8, paddingTop: 2 }}>{getStatusIcon(item.status)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editingItemId === item.id ? (
                        <div>
                          <TextArea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            autoSize={{ minRows: 2, maxRows: 6 }}
                            style={{ marginBottom: 8 }}
                            autoFocus
                            placeholder="输入消息内容..."
                          />
                          <Space size="small">
                            <Button type="primary" size="small" onClick={handleSaveEdit}>
                              保存
                            </Button>
                            <Button size="small" onClick={() => handleCancelEdit(item.id, item.content === '')}>
                              取消
                            </Button>
                          </Space>
                        </div>
                      ) : (
                        <>
                          <div
                            style={{
                              fontSize: 13,
                              marginBottom: 4,
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap',
                              color: item.content ? undefined : '#bfbfbf',
                              fontStyle: item.content ? undefined : 'italic'
                            }}
                          >
                            {item.content ? (
                              item.content.length > 100
                                ? item.content.substring(0, 100) + '...'
                                : item.content
                            ) : (
                              '(空消息 - 点击编辑按钮添加内容)'
                            )}
                          </div>
                          <Space size="small" wrap>
                            {getStatusTag(item.status)}
                            {item.error && (
                              <Tooltip title={item.error}>
                                <Tag color="error" style={{ fontSize: 11 }}>
                                  错误
                                </Tag>
                              </Tooltip>
                            )}
                          </Space>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  {editingItemId !== item.id && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                      {(item.status === 'pending' || !item.content) && (
                        <Tooltip title="编辑">
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleStartEdit(item)}
                          />
                        </Tooltip>
                      )}
                      {item.status === 'failed' && (
                        <Tooltip title="重试">
                          <Button
                            type="text"
                            size="small"
                            icon={<ReloadOutlined />}
                            onClick={() => onRetryQueueItem(item.id)}
                          />
                        </Tooltip>
                      )}
                      {item.status !== 'processing' && (
                        <Popconfirm
                          title="确认删除此消息？"
                          onConfirm={() => onRemoveFromQueue(item.id)}
                          okText="删除"
                          cancelText="取消"
                        >
                          <Tooltip title="删除">
                            <Button
                              type="text"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                            />
                          </Tooltip>
                        </Popconfirm>
                      )}
                    </div>
                  )}
                </div>
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 配置弹窗 */}
      <Modal
        title="队列设置"
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setConfigModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text>启用队列模式</Text>
            <Switch
              checked={config.enabled}
              onChange={(checked) => onUpdateConfig({ enabled: checked })}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text>自动处理队列</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                当前消息完成后自动处理下一条
              </Text>
            </div>
            <Switch
              checked={config.autoProcess}
              onChange={(checked) => onUpdateConfig({ autoProcess: checked })}
            />
          </div>
        </Space>
      </Modal>
    </div>
  )
}
