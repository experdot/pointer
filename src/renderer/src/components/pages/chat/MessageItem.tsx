import React, { useState, useEffect, useRef } from 'react'
import { Avatar, Card, Typography, Button, Space, Input, Tooltip, Select, Collapse } from 'antd'
import {
  UserOutlined,
  RobotOutlined,
  RedoOutlined,
  EditOutlined,
  CopyOutlined,
  CheckOutlined,
  CloseOutlined,
  StarOutlined,
  StarFilled,
  SendOutlined,
  BulbOutlined,
  PictureOutlined,
  DownOutlined,
  UpOutlined
} from '@ant-design/icons'
import { ChatMessage, LLMConfig } from '../../../types/type'
import BranchNavigator from './BranchNavigator'
import { Markdown } from '../../common/markdown/Markdown'
import { captureDivToClipboard } from '@renderer/utils/exporter'

const { Text } = Typography
const { TextArea } = Input
const { Option } = Select

interface MessageItemProps {
  message: ChatMessage
  isLoading?: boolean
  isLastMessage?: boolean
  llmConfigs?: LLMConfig[]
  // 分支导航相关（所有消息都使用兄弟分支导航）
  hasChildBranches?: boolean
  branchIndex?: number
  branchCount?: number
  onBranchPrevious?: (messageId: string) => void
  onBranchNext?: (messageId: string) => void
  // 原有的回调
  onRetry?: (messageId: string) => void
  onEdit?: (messageId: string, newContent: string) => void
  onEditAndResend?: (messageId: string, newContent: string) => void
  onToggleFavorite?: (messageId: string) => void
  onModelChange?: (messageId: string, newModelId: string) => void
  // 折叠相关
  isCollapsed?: boolean
  onToggleCollapse?: (messageId: string) => void
}

export default function MessageItem({
  message,
  isLoading = false,
  isLastMessage = false,
  llmConfigs = [],
  hasChildBranches = false,
  branchIndex = 0,
  branchCount = 1,
  onBranchPrevious,
  onBranchNext,
  onRetry,
  onEdit,
  onEditAndResend,
  onToggleFavorite,
  onModelChange,
  isCollapsed = false,
  onToggleCollapse
}: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [reasoningExpanded, setReasoningExpanded] = useState<string[]>([])
  const messageRef = useRef<HTMLDivElement>(null)

  // 根据消息流状态控制思考过程的展开/折叠
  useEffect(() => {
    if (message.reasoning_content) {
      if (message.isStreaming && !message.content) {
        // 思考过程输出时自动展开（还没有最终回答内容）
        setReasoningExpanded(['reasoning_content'])
      } else {
        // 思考过程结束时自动折叠（开始输出最终回答或流结束）
        setReasoningExpanded([])
      }
    }
  }, [message.isStreaming, message.reasoning_content, message.content])

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
  }

  const handleCopyAsImage = async () => {
    if (!messageRef.current) return
    captureDivToClipboard(messageRef.current, 10, 10)
  }

  const handleRetry = () => {
    onRetry?.(message.id)
  }

  const handleEdit = () => {
    setIsEditing(true)
    setEditContent(message.content)
  }

  const handleSaveEdit = () => {
    if (editContent.trim() !== message.content) {
      onEdit?.(message.id, editContent.trim())
    }
    setIsEditing(false)
  }

  const handleSaveAndResend = () => {
    onEditAndResend?.(message.id, editContent.trim())
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditContent(message.content)
  }

  const handleToggleFavorite = () => {
    onToggleFavorite?.(message.id)
  }

  const handleModelChange = (newModelId: string) => {
    onModelChange?.(message.id, newModelId)
  }

  const handleBranchPrevious = () => {
    onBranchPrevious?.(message.id)
  }

  const handleBranchNext = () => {
    onBranchNext?.(message.id)
  }

  const getCurrentModel = () => {
    return llmConfigs.find((config) => config.id === message.modelId)
  }

  const handleToggleCollapse = () => {
    onToggleCollapse?.(message.id)
  }

  // 生成折叠状态下的预览文本
  const getPreviewText = (content: string, maxLength: number = 80) => {
    if (!content) return '消息已折叠，点击展开按钮查看内容'

    // 移除markdown语法和多余的空白字符
    const cleanContent = content
      .replace(/[#*_`~\[\]]/g, '') // 移除常见的markdown符号
      .replace(/\n+/g, ' ') // 将换行符替换为空格
      .replace(/\s+/g, ' ') // 合并多个空格为一个
      .trim()

    if (cleanContent.length <= maxLength) {
      return cleanContent
    }

    // 在单词边界处截断，避免截断单词
    const truncated = cleanContent.slice(0, maxLength)
    const lastSpaceIndex = truncated.lastIndexOf(' ')

    if (lastSpaceIndex > maxLength * 0.8) {
      return truncated.slice(0, lastSpaceIndex) + '...'
    }

    return truncated + '...'
  }

  return (
    <div
      ref={messageRef}
      data-message-id={message.id}
      className={`message-item ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
    >
      <div className="message-avatar">
        <Avatar
          icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
          style={{
            backgroundColor: message.role === 'user' ? '#87d068' : '#1890ff'
          }}
        />
      </div>
      <div className="message-content">
        <div className="message-header">
          <div className="message-title">
            <Text strong>{message.role === 'user' ? '您' : 'AI助手'}</Text>
            {message.role === 'assistant' && message.modelId && llmConfigs.length > 0 && (
              <Select
                value={message.modelId}
                onChange={handleModelChange}
                size="small"
                className="message-model-selector"
                disabled={isLoading}
                bordered={false}
                dropdownMatchSelectWidth={false}
              >
                {llmConfigs.map((config) => (
                  <Option key={config.id} value={config.id}>
                    {config.name}
                  </Option>
                ))}
              </Select>
            )}
            {hasChildBranches && (
              <BranchNavigator
                currentIndex={branchIndex}
                totalBranches={branchCount}
                onPrevious={handleBranchPrevious}
                onNext={handleBranchNext}
                className="message-branch-nav"
              />
            )}
            {/* 单个消息折叠按钮 */}
            <Button
              type="text"
              size="small"
              icon={isCollapsed ? <DownOutlined /> : <UpOutlined />}
              onClick={handleToggleCollapse}
              title={isCollapsed ? '展开消息' : '折叠消息'}
              className="message-collapse-btn"
            />
          </div>
          <div className="message-time">
            <Text type="secondary">{formatTimestamp(message.timestamp)}</Text>
          </div>
        </div>

        {/* 消息内容区域 - 可折叠 */}
        {!isCollapsed && (
          <>
            {/* 推理模型思考过程展示 */}
            {message.reasoning_content && (
              <Card size="small" className="message-reasoning-card" style={{ marginBottom: 8 }}>
                <Collapse
                  size="small"
                  ghost
                  activeKey={reasoningExpanded}
                  onChange={(keys) =>
                    setReasoningExpanded(Array.isArray(keys) ? keys : [keys].filter(Boolean))
                  }
                  items={[
                    {
                      key: 'reasoning_content',
                      label: (
                        <Text type="secondary">
                          <BulbOutlined style={{ marginRight: 4 }} />
                          思考过程
                        </Text>
                      ),
                      children: (
                        <div
                          style={{
                            marginBottom: 0,
                            color: '#666',
                            backgroundColor: '#fafafa',
                            padding: '8px 12px',
                            borderRadius: '4px',
                            border: '1px solid #f0f0f0',
                            userSelect: 'text',
                            cursor: 'text'
                          }}
                        >
                          <Markdown content={message.reasoning_content ?? ''} />
                        </div>
                      )
                    }
                  ]}
                />
              </Card>
            )}

            <Card size="small" className="message-card">
              {isEditing ? (
                <div className="message-edit-container">
                  <TextArea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    autoSize={{ minRows: 2, maxRows: 16 }}
                    placeholder="编辑消息内容..."
                  />
                  <div className="message-edit-actions">
                    <Space>
                      <Button
                        type="primary"
                        size="small"
                        icon={<CheckOutlined />}
                        onClick={handleSaveEdit}
                        disabled={!editContent.trim()}
                      >
                        保存
                      </Button>
                      {message.role === 'user' && (
                        <Button
                          type="primary"
                          size="small"
                          icon={<SendOutlined />}
                          onClick={handleSaveAndResend}
                          disabled={!editContent.trim() || isLoading}
                          ghost
                        >
                          保存并重发
                        </Button>
                      )}
                      <Button size="small" icon={<CloseOutlined />} onClick={handleCancelEdit}>
                        取消
                      </Button>
                    </Space>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    marginBottom: 0,
                    userSelect: 'text',
                    cursor: 'text'
                  }}
                >
                  <Markdown content={message.content ?? ''} />
                </div>
              )}
            </Card>
          </>
        )}

        {/* 折叠状态显示 */}
        {isCollapsed && (
          <Card size="small" className="message-card message-collapsed">
            <div className="message-preview">
              <Text type="secondary" className="message-preview-text">
                {getPreviewText(message.content)}
              </Text>
              {message.reasoning_content && (
                <Text type="secondary" className="message-preview-reasoning">
                  <BulbOutlined style={{ marginRight: 4 }} />
                  含思考过程
                </Text>
              )}
            </div>
          </Card>
        )}

        <div className={`message-actions ${isLastMessage ? 'visible' : ''}`}>
          <div className="message-action-buttons">
            <Tooltip title="复制">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={handleCopy}
                disabled={message.isStreaming}
              />
            </Tooltip>
            <Tooltip title="复制为图片">
              <Button
                type="text"
                size="small"
                icon={<PictureOutlined />}
                onClick={handleCopyAsImage}
                disabled={message.isStreaming}
              />
            </Tooltip>
            <Tooltip title="收藏">
              <Button
                type="text"
                size="small"
                icon={message.isFavorited ? <StarFilled /> : <StarOutlined />}
                onClick={handleToggleFavorite}
                className={message.isFavorited ? 'favorited' : ''}
                disabled={message.isStreaming}
              />
            </Tooltip>
            {onEdit && (
              <Tooltip title="编辑">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={handleEdit}
                  disabled={message.isStreaming}
                />
              </Tooltip>
            )}
            {message.role === 'assistant' && onRetry && (
              <Tooltip title="重试">
                <Button
                  type="text"
                  size="small"
                  icon={<RedoOutlined />}
                  onClick={handleRetry}
                  disabled={isLoading || message.isStreaming}
                />
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
