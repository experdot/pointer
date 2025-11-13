import React, { useMemo, useState } from 'react'
import {
  List,
  Card,
  Progress,
  Typography,
  Tag,
  Space,
  Button,
  Empty,
  Tooltip,
  Pagination,
  Descriptions,
  Modal,
  App
} from 'antd'
import {
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
  DeleteOutlined,
  MessageOutlined,
  TableOutlined,
  NodeIndexOutlined,
  RedoOutlined,
  EditOutlined,
  SwapOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'
import { useAITasksStore } from '../../../../stores/aiTasksStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { AITask, AITaskStatus, AITaskType } from '../../../../types/type'
import RelativeTime from '../../../common/RelativeTime'

const { Text, Title } = Typography

// 每页显示的任务数量
const PAGE_SIZE = 5

// 获取任务类型图标
const getTaskIcon = (type: AITaskType) => {
  switch (type) {
    case 'chat':
      return <MessageOutlined />
    case 'crosstab_cell':
      return <TableOutlined />
    case 'object_generation':
      return <NodeIndexOutlined />
    case 'retry':
      return <RedoOutlined />
    case 'edit_resend':
      return <EditOutlined />
    case 'model_change':
      return <SwapOutlined />
    default:
      return <MessageOutlined />
  }
}

// 获取任务状态图标和颜色
const getTaskStatusDisplay = (status: AITaskStatus) => {
  switch (status) {
    case 'pending':
      return { icon: <LoadingOutlined />, color: '#1890ff', text: '等待中' }
    case 'running':
      return { icon: <LoadingOutlined spin />, color: '#1890ff', text: '运行中' }
    case 'completed':
      return { icon: <CheckCircleOutlined />, color: '#52c41a', text: '已完成' }
    case 'failed':
      return { icon: <CloseCircleOutlined />, color: '#ff4d4f', text: '失败' }
    case 'cancelled':
      return { icon: <StopOutlined />, color: '#d9d9d9', text: '已取消' }
    default:
      return { icon: <LoadingOutlined />, color: '#1890ff', text: '未知' }
  }
}

// 获取任务类型显示名称
const getTaskTypeName = (type: AITaskType) => {
  switch (type) {
    case 'chat':
      return '聊天对话'
    case 'crosstab_cell':
      return '交叉分析单元格'
    case 'object_generation':
      return '对象生成'
    case 'retry':
      return '重试消息'
    case 'edit_resend':
      return '编辑重发'
    case 'model_change':
      return '模型切换'
    default:
      return '未知任务'
  }
}

// 格式化持续时间
const formatDuration = (startTime: number, endTime?: number) => {
  const duration = (endTime || Date.now()) - startTime
  const seconds = Math.floor(duration / 1000)
  const minutes = Math.floor(seconds / 60)

  if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`
  }
  return `${seconds}秒`
}

export default function TaskMonitor() {
  const { aiTasks, cancelTask, removeTask, clearCompletedTasks, clearAllTasks } = useAITasksStore()
  const { settings } = useSettingsStore()
  const { modal, message } = App.useApp()

  // 分页状态
  const [runningPage, setRunningPage] = useState(1)
  const [completedPage, setCompletedPage] = useState(1)
  const [failedPage, setFailedPage] = useState(1)

  // 详情弹框状态
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedTask, setSelectedTask] = useState<AITask | null>(null)

  // 获取模型名称的辅助函数
  const getModelName = (modelId?: string) => {
    if (!modelId) return null
    const modelConfig = settings.llmConfigs.find((config) => config.id === modelId)
    return modelConfig?.name || modelId
  }

  // 按状态分组任务
  const groupedTasks = useMemo(() => {
    const running = aiTasks.filter((task) => task.status === 'running' || task.status === 'pending')
    const completed = aiTasks
      .filter((task) => task.status === 'completed')
      .sort((a, b) => b.startTime - a.startTime) // 按创建时间降序排序，最新的在前面
    const failed = aiTasks
      .filter((task) => task.status === 'failed' || task.status === 'cancelled')
      .sort((a, b) => b.startTime - a.startTime) // 失败的任务也按创建时间降序排序

    return { running, completed, failed }
  }, [aiTasks])

  // 计算分页后的任务数据
  const paginatedTasks = useMemo(() => {
    const runningStart = (runningPage - 1) * PAGE_SIZE
    const runningEnd = runningStart + PAGE_SIZE
    const paginatedRunning = groupedTasks.running.slice(runningStart, runningEnd)

    const completedStart = (completedPage - 1) * PAGE_SIZE
    const completedEnd = completedStart + PAGE_SIZE
    const paginatedCompleted = groupedTasks.completed.slice(completedStart, completedEnd)

    const failedStart = (failedPage - 1) * PAGE_SIZE
    const failedEnd = failedStart + PAGE_SIZE
    const paginatedFailed = groupedTasks.failed.slice(failedStart, failedEnd)

    return {
      running: paginatedRunning,
      completed: paginatedCompleted,
      failed: paginatedFailed
    }
  }, [groupedTasks, runningPage, completedPage, failedPage])

  // 自动重置分页逻辑
  React.useEffect(() => {
    // 如果当前页面没有运行中任务，且不是第一页，则跳转到第一页
    if (groupedTasks.running.length > 0 && paginatedTasks.running.length === 0 && runningPage > 1) {
      setRunningPage(1)
    }
    // 如果当前页面没有已完成任务，且不是第一页，则跳转到第一页
    if (
      groupedTasks.completed.length > 0 &&
      paginatedTasks.completed.length === 0 &&
      completedPage > 1
    ) {
      setCompletedPage(1)
    }
    // 如果当前页面没有失败任务，且不是第一页，则跳转到第一页
    if (groupedTasks.failed.length > 0 && paginatedTasks.failed.length === 0 && failedPage > 1) {
      setFailedPage(1)
    }
  }, [
    groupedTasks.running.length,
    groupedTasks.completed.length,
    groupedTasks.failed.length,
    paginatedTasks.running.length,
    paginatedTasks.completed.length,
    paginatedTasks.failed.length,
    runningPage,
    completedPage,
    failedPage
  ])

  // 清除已完成的任务
  const handleClearCompleted = () => {
    clearCompletedTasks()
    setCompletedPage(1) // 重置分页
  }

  // 清除所有任务
  const handleClearAll = () => {
    clearAllTasks()
    setRunningPage(1) // 重置分页
    setCompletedPage(1) // 重置分页
    setFailedPage(1) // 重置分页
  }

  // 取消任务
  const handleCancelTask = async (taskId: string) => {
    // 找到对应的任务
    const task = aiTasks.find((t) => t.id === taskId)
    if (!task) {
      message.error('任务不存在')
      return
    }

    try {
      const hide = message.loading('正在取消任务...', 0)

      // 使用任务的requestId来停止AI服务
      await window.api.ai.stopStreaming(task.requestId)

      // 更新任务状态为已取消
      cancelTask(taskId)

      hide()
      message.success('任务已取消')
    } catch (error) {
      console.error('Failed to cancel AI task:', error)
      // 即使停止失败，也要更新任务状态
      cancelTask(taskId)

      message.warning('任务取消可能未完全成功')
    }
  }

  // 移除单个任务
  const handleRemoveTask = (taskId: string) => {
    removeTask(taskId)
  }

  // 查看任务详情
  const handleViewDetails = (task: AITask) => {
    setSelectedTask(task)
    setDetailModalVisible(true)
  }

  // 关闭详情弹框
  const handleCloseDetails = () => {
    setDetailModalVisible(false)
    setSelectedTask(null)
  }

  // 渲染任务上下文详情
  const renderTaskContext = (task: AITask) => {
    if (!task.context) {
      return <Text type="secondary">暂无上下文信息</Text>
    }

    const context = task.context
    const items = []

    if (context.chat) {
      items.push(
        <Descriptions.Item key="chat-content" label="消息内容">
          <Text copyable={{ text: context.chat.messageContent || '' }}>
            {context.chat.messageContent || '无'}
          </Text>
        </Descriptions.Item>
      )
      if (context.chat.parentMessageId) {
        items.push(
          <Descriptions.Item key="parent-id" label="父消息ID">
            <Text copyable={{ text: context.chat.parentMessageId }}>
              {context.chat.parentMessageId}
            </Text>
          </Descriptions.Item>
        )
      }
    }

    if (context.crosstab) {
      items.push(
        <Descriptions.Item key="horizontal" label="横轴项">
          <Text copyable={{ text: context.crosstab.horizontalItem }}>
            {context.crosstab.horizontalItem}
          </Text>
        </Descriptions.Item>,
        <Descriptions.Item key="vertical" label="纵轴项">
          <Text copyable={{ text: context.crosstab.verticalItem }}>
            {context.crosstab.verticalItem}
          </Text>
        </Descriptions.Item>,
        <Descriptions.Item key="metadata" label="元数据">
          <Text copyable={{ text: JSON.stringify(context.crosstab.metadata, null, 2) }}>
            {JSON.stringify(context.crosstab.metadata, null, 2)}
          </Text>
        </Descriptions.Item>
      )
    }

    if (context.object) {
      items.push(
        <Descriptions.Item key="node-id" label="节点ID">
          <Text copyable={{ text: context.object.nodeId }}>{context.object.nodeId}</Text>
        </Descriptions.Item>,
        <Descriptions.Item key="prompt" label="生成提示">
          <Text copyable={{ text: context.object.prompt }}>{context.object.prompt}</Text>
        </Descriptions.Item>
      )
    }

    if (context.retry) {
      items.push(
        <Descriptions.Item key="original-id" label="原始消息ID">
          <Text copyable={{ text: context.retry.originalMessageId }}>
            {context.retry.originalMessageId}
          </Text>
        </Descriptions.Item>
      )
    }

    if (context.editResend) {
      items.push(
        <Descriptions.Item key="edit-original-id" label="原始消息ID">
          <Text copyable={{ text: context.editResend.originalMessageId }}>
            {context.editResend.originalMessageId}
          </Text>
        </Descriptions.Item>,
        <Descriptions.Item key="new-content" label="新内容">
          <Text copyable={{ text: context.editResend.newContent }}>
            {context.editResend.newContent}
          </Text>
        </Descriptions.Item>
      )
    }

    if (context.modelChange) {
      items.push(
        <Descriptions.Item key="model-original-id" label="原始消息ID">
          <Text copyable={{ text: context.modelChange.originalMessageId }}>
            {context.modelChange.originalMessageId}
          </Text>
        </Descriptions.Item>,
        <Descriptions.Item key="new-model" label="新模型">
          <Text copyable={{ text: context.modelChange.newModelId }}>
            {getModelName(context.modelChange.newModelId) || context.modelChange.newModelId}
          </Text>
        </Descriptions.Item>
      )
    }

    if (items.length === 0) {
      return <Text type="secondary">暂无上下文信息</Text>
    }

    return (
      <Descriptions column={1} size="small" bordered>
        {items}
      </Descriptions>
    )
  }

  // 渲染任务项
  const renderTaskItem = (task: AITask) => {
    const statusDisplay = getTaskStatusDisplay(task.status)
    const isActive = task.status === 'running' || task.status === 'pending'

    return (
      <List.Item
        key={task.id}
        actions={[
          <Tooltip title="查看详情">
            <Button
              type="text"
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={() => handleViewDetails(task)}
            />
          </Tooltip>,
          isActive ? (
            <Tooltip title="取消任务">
              <Button
                type="text"
                size="small"
                icon={<StopOutlined />}
                onClick={() => handleCancelTask(task.id)}
              />
            </Tooltip>
          ) : (
            <Tooltip title="移除任务">
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => handleRemoveTask(task.id)}
              />
            </Tooltip>
          )
        ]}
      >
        <List.Item.Meta
          avatar={
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {getTaskIcon(task.type)}
              <span style={{ color: statusDisplay.color }}>{statusDisplay.icon}</span>
            </div>
          }
          title={
            <div>
              {/* 标题单独一行，超出显示省略号 */}
              <div
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: 4
                }}
              >
                <Text strong>{task.title}</Text>
              </div>
              {/* 标签行 */}
              <div>
                <Tag color={statusDisplay.color}>{getTaskTypeName(task.type)}</Tag>
                <Tag color={statusDisplay.color}>{statusDisplay.text}</Tag>
              </div>
            </div>
          }
          description={
            <div>
              {/* 描述单独一行，超出显示省略号 */}
              {task.description && (
                <div
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: 4
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {task.description}
                  </Text>
                </div>
              )}
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  持续时间: {formatDuration(task.startTime, task.endTime)}
                </Text>
                {task.modelId && (
                  <Text type="secondary" style={{ fontSize: 11, marginLeft: 12 }}>
                    模型: {getModelName(task.modelId)}
                  </Text>
                )}
              </div>
              <div style={{ marginTop: 2 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  创建时间: <RelativeTime timestamp={task.startTime} />
                </Text>
              </div>
              {task.progress && (
                <div style={{ marginTop: 4 }}>
                  <Progress
                    percent={Math.round((task.progress.current / task.progress.total) * 100)}
                    size="small"
                    status={task.status === 'failed' ? 'exception' : undefined}
                  />
                  {task.progress.message && (
                    <div
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginTop: 2
                      }}
                    >
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {task.progress.message}
                      </Text>
                    </div>
                  )}
                </div>
              )}
              {task.error && (
                <div
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: 4
                  }}
                >
                  <Text type="danger" style={{ fontSize: 11 }}>
                    错误: {task.error}
                  </Text>
                </div>
              )}
            </div>
          }
        />
      </List.Item>
    )
  }

  if (aiTasks.length === 0) {
    return (
      <div
        style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无AI任务" />
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          flexShrink: 0
        }}
      >
        <Title level={5} style={{ margin: 0 }}>
          任务列表 ({aiTasks.length})
        </Title>
        <Space>
          {groupedTasks.completed.length > 0 && (
            <Button type="text" size="small" onClick={handleClearCompleted}>
              清除已完成
            </Button>
          )}
          {aiTasks.length > 0 && (
            <Button type="text" size="small" onClick={handleClearAll}>
              清除全部
            </Button>
          )}
        </Space>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* 正在运行的任务 */}
        {groupedTasks.running.length > 0 && (
          <Card size="small" style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#1890ff' }}>
              正在运行 ({groupedTasks.running.length})
            </div>
            <List
              size="small"
              dataSource={paginatedTasks.running}
              renderItem={renderTaskItem}
              split={false}
            />
            {groupedTasks.running.length > PAGE_SIZE && (
              <div style={{ marginTop: 8, textAlign: 'right' }}>
                <Pagination
                  total={groupedTasks.running.length}
                  pageSize={PAGE_SIZE}
                  current={runningPage}
                  onChange={(page) => setRunningPage(page)}
                  size="small"
                  showSizeChanger={false}
                  showQuickJumper={false}
                  showTotal={(total, range) => `${range[0]}-${range[1]} / ${total}`}
                />
              </div>
            )}
          </Card>
        )}

        {/* 已完成的任务 */}
        {groupedTasks.completed.length > 0 && (
          <Card size="small" style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#52c41a' }}>
              已完成 ({groupedTasks.completed.length})
            </div>
            <List
              size="small"
              dataSource={paginatedTasks.completed}
              renderItem={renderTaskItem}
              split={false}
            />
            {groupedTasks.completed.length > PAGE_SIZE && (
              <div style={{ marginTop: 8, textAlign: 'right' }}>
                <Pagination
                  total={groupedTasks.completed.length}
                  pageSize={PAGE_SIZE}
                  current={completedPage}
                  onChange={(page) => setCompletedPage(page)}
                  size="small"
                  showSizeChanger={false}
                  showQuickJumper={false}
                  showTotal={(total, range) => `${range[0]}-${range[1]} / ${total}`}
                />
              </div>
            )}
          </Card>
        )}

        {/* 失败的任务 */}
        {groupedTasks.failed.length > 0 && (
          <Card size="small">
            <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#ff4d4f' }}>
              失败/取消 ({groupedTasks.failed.length})
            </div>
            <List
              size="small"
              dataSource={paginatedTasks.failed}
              renderItem={renderTaskItem}
              split={false}
            />
            {groupedTasks.failed.length > PAGE_SIZE && (
              <div style={{ marginTop: 8, textAlign: 'right' }}>
                <Pagination
                  total={groupedTasks.failed.length}
                  pageSize={PAGE_SIZE}
                  current={failedPage}
                  onChange={(page) => setFailedPage(page)}
                  size="small"
                  showSizeChanger={false}
                  showQuickJumper={false}
                  showTotal={(total, range) => `${range[0]}-${range[1]} / ${total}`}
                />
              </div>
            )}
          </Card>
        )}
      </div>

      {/* 任务详情弹框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {selectedTask && getTaskIcon(selectedTask.type)}
            <span>任务详情</span>
            {selectedTask && (
              <Tag color={getTaskStatusDisplay(selectedTask.status).color}>
                {getTaskStatusDisplay(selectedTask.status).text}
              </Tag>
            )}
          </div>
        }
        open={detailModalVisible}
        onCancel={handleCloseDetails}
        footer={[
          <Button key="close" onClick={handleCloseDetails}>
            关闭
          </Button>
        ]}
        width={800}
        style={{ maxWidth: '90vw' }}
      >
        {selectedTask && (
          <div>
            {/* 基本信息 */}
            <Descriptions
              title="基本信息"
              column={1}
              size="small"
              bordered
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label="任务ID">
                <Text copyable={{ text: selectedTask.id }}>{selectedTask.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="任务标题">
                <Text copyable={{ text: selectedTask.title }}>{selectedTask.title}</Text>
              </Descriptions.Item>
              {selectedTask.description && (
                <Descriptions.Item label="任务描述">
                  <Text copyable={{ text: selectedTask.description }}>
                    {selectedTask.description}
                  </Text>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="任务类型">
                {getTaskTypeName(selectedTask.type)}
              </Descriptions.Item>
              <Descriptions.Item label="任务状态">
                <Space>
                  {getTaskStatusDisplay(selectedTask.status).icon}
                  {getTaskStatusDisplay(selectedTask.status).text}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="请求ID">
                <Text copyable={{ text: selectedTask.requestId }}>{selectedTask.requestId}</Text>
              </Descriptions.Item>
              {selectedTask.modelId && (
                <Descriptions.Item label="使用模型">
                  <Text copyable={{ text: selectedTask.modelId }}>
                    {getModelName(selectedTask.modelId)}
                  </Text>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="创建时间">
                <RelativeTime timestamp={selectedTask.startTime} />
              </Descriptions.Item>
              <Descriptions.Item label="持续时间">
                {formatDuration(selectedTask.startTime, selectedTask.endTime)}
              </Descriptions.Item>
              {selectedTask.endTime && (
                <Descriptions.Item label="结束时间">
                  <RelativeTime timestamp={selectedTask.endTime} />
                </Descriptions.Item>
              )}
              {selectedTask.chatId && (
                <Descriptions.Item label="关联聊天ID">
                  <Text copyable={{ text: selectedTask.chatId }}>{selectedTask.chatId}</Text>
                </Descriptions.Item>
              )}
              {selectedTask.messageId && (
                <Descriptions.Item label="关联消息ID">
                  <Text copyable={{ text: selectedTask.messageId }}>{selectedTask.messageId}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* 进度信息 */}
            {selectedTask.progress && (
              <div style={{ marginBottom: 16 }}>
                <Title level={5}>进度信息</Title>
                <Progress
                  percent={Math.round(
                    (selectedTask.progress.current / selectedTask.progress.total) * 100
                  )}
                  status={selectedTask.status === 'failed' ? 'exception' : undefined}
                  format={(percent) =>
                    `${selectedTask.progress?.current}/${selectedTask.progress?.total} (${percent}%)`
                  }
                />
                {selectedTask.progress.message && (
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">{selectedTask.progress.message}</Text>
                  </div>
                )}
              </div>
            )}

            {/* 错误信息 */}
            {selectedTask.error && (
              <div style={{ marginBottom: 16 }}>
                <Title level={5}>错误信息</Title>
                <Card
                  size="small"
                  style={{ backgroundColor: '#fff2f0', border: '1px solid #ffccc7' }}
                >
                  <Text type="danger" copyable={{ text: selectedTask.error }}>
                    {selectedTask.error}
                  </Text>
                </Card>
              </div>
            )}

            {/* 任务上下文 */}
            <div>
              <Title level={5}>任务上下文</Title>
              {renderTaskContext(selectedTask)}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
