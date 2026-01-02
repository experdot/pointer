import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Avatar, Button, Tooltip, Input, Popconfirm, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import {
  UserOutlined,
  RobotOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  SendOutlined,
  CopyOutlined,
  ArrowDownOutlined,
  RightOutlined,
  DownOutlined,
  UpOutlined
} from '@ant-design/icons'
import { BranchNavigator } from './BranchNavigator'
import { ModelSelector } from './ModelSelector'
import type { ChatMessage } from '../../../types/type'

const { TextArea } = Input

interface MessageItemProps {
  message: ChatMessage
  isLast?: boolean
  isLeaf?: boolean
  isStreaming?: boolean
  streamingContent?: string
  streamingReasoning?: string
  branchIndex: number
  branchCount: number
  siblings: ChatMessage[]
  onRetry: (messageId: string, llmId?: string) => void
  onContinue: (messageId: string) => void
  onDelete: (messageId: string) => void
  onEdit: (messageId: string, content: string) => void
  onEditAndResend: (messageId: string, content: string) => void
  onSwitchBranch: (messageId: string) => void
  onQuote?: (text: string) => void
  onToggleCollapse?: (messageId: string) => void
}

export function MessageItem({
  message,
  isLast,
  isLeaf,
  isStreaming,
  streamingContent,
  streamingReasoning,
  branchIndex,
  branchCount,
  siblings,
  onRetry,
  onContinue,
  onDelete,
  onEdit,
  onEditAndResend,
  onSwitchBranch,
  onQuote,
  onToggleCollapse
}: MessageItemProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [copied, setCopied] = useState(false)
  const [reasoningExpanded, setReasoningExpanded] = useState(true)
  const wasStreaming = useRef(false)
  const itemRef = useRef<HTMLDivElement>(null)

  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  // 显示内容：streaming 时用缓冲内容，否则用消息内容
  const displayContent = isStreaming ? (streamingContent ?? '') : message.content
  const displayReasoning = isStreaming ? streamingReasoning : message.reasoning_content

  // 折叠预览文本
  const collapsedPreview = useMemo(() => {
    if (!message.collapsed) return ''
    if (isStreaming) return '流式输出中...'
    const text = displayContent.replace(/\s+/g, ' ').trim()
    return text.length > 80 ? text.slice(0, 80) + '...' : text
  }, [message.collapsed, displayContent, isStreaming])

  // streaming 结束后自动折叠
  useEffect(() => {
    if (wasStreaming.current && !isStreaming && displayReasoning) {
      setReasoningExpanded(false)
    }
    wasStreaming.current = !!isStreaming
  }, [isStreaming, displayReasoning])

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleStartEdit = useCallback((): void => {
    setEditContent(message.content)
    setIsEditing(true)
    // 延迟滚动，等待编辑框渲染
    setTimeout(() => {
      itemRef.current?.scrollIntoView({ block: 'center' })
    }, 50)
  }, [message.content])

  const handleCancelEdit = (): void => {
    setIsEditing(false)
    setEditContent(message.content)
  }

  const handleSaveEdit = (): void => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit(message.id, editContent.trim())
    }
    setIsEditing(false)
  }

  const handleEditAndResend = (): void => {
    if (editContent.trim()) {
      onEditAndResend(message.id, editContent.trim())
    }
    setIsEditing(false)
  }

  const handleCopy = (): void => {
    navigator.clipboard.writeText(displayContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const getSelectedText = (): string => {
    return window.getSelection()?.toString() || ''
  }

  const contextMenuItems: MenuProps['items'] = [
    {
      key: 'copy',
      label: '复制',
      onClick: () => {
        const selected = getSelectedText()
        navigator.clipboard.writeText(selected || displayContent)
      }
    },
    {
      key: 'quote',
      label: '引用到输入框',
      onClick: () => {
        const selected = getSelectedText()
        onQuote?.(selected || displayContent)
      }
    }
  ]

  return (
    <div
      ref={itemRef}
      className={`message-item ${isStreaming ? 'message-item--streaming' : ''} ${isLast ? 'message-item--last' : ''}`}
      data-message-id={message.id}
    >
      <div className="message-item__avatar">
        <Avatar
          size={32}
          icon={isUser ? <UserOutlined /> : <RobotOutlined />}
          style={{
            backgroundColor: isUser ? '#1890ff' : '#52c41a'
          }}
        />
      </div>

      <div className="message-item__content">
        <div className="message-item__header">
          <span className="message-item__role">{isUser ? '你' : 'AI'}</span>
          <span className="message-item__time">{formatTime(message.createdAt)}</span>

          {/* 折叠按钮 */}
          <Tooltip title={message.collapsed ? '展开' : '折叠'}>
            <Button
              type="text"
              size="small"
              className="message-item__collapse-btn"
              icon={message.collapsed ? <DownOutlined /> : <UpOutlined />}
              onClick={() => onToggleCollapse?.(message.id)}
            />
          </Tooltip>

          {/* 模型选择器 - assistant 消息 */}
          {isAssistant && (
            <ModelSelector
              value={message.modelId}
              onChange={(llmId) => onRetry(message.id, llmId)}
              disabled={isStreaming}
            />
          )}

          {/* 分支导航 - 仅在有多个分支时显示 */}
          {branchCount > 1 && (
            <BranchNavigator
              currentIndex={branchIndex}
              totalCount={branchCount}
              siblings={siblings}
              onSwitchBranch={onSwitchBranch}
            />
          )}
        </div>

        {/* 推理内容 */}
        {displayReasoning && (
          <div className={`message-item__reasoning ${reasoningExpanded ? 'message-item__reasoning--expanded' : ''}`}>
            <div
              className="message-item__reasoning-label"
              onClick={() => setReasoningExpanded(!reasoningExpanded)}
            >
              {reasoningExpanded ? <DownOutlined /> : <RightOutlined />}
              <span>思考过程</span>
            </div>
            <div className="message-item__reasoning-content">{displayReasoning}</div>
          </div>
        )}

        {/* 消息内容 */}
        {isEditing ? (
          <div className="message-item__edit">
            <TextArea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              autoSize={{ minRows: 2, maxRows: 10 }}
              autoFocus
            />
            <div className="message-item__edit-actions">
              <Button size="small" icon={<CloseOutlined />} onClick={handleCancelEdit}>
                取消
              </Button>
              <Button size="small" icon={<CheckOutlined />} onClick={handleSaveEdit}>
                保存
              </Button>
              {isUser && (
                <Button
                  size="small"
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleEditAndResend}
                >
                  保存并重发
                </Button>
              )}
            </div>
          </div>
        ) : message.collapsed ? (
          <div
            className="message-item__preview"
            onClick={() => onToggleCollapse?.(message.id)}
          >
            {collapsedPreview}
          </div>
        ) : (
          <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']}>
            <div className="message-item__body">{displayContent}</div>
          </Dropdown>
        )}

        {/* 操作按钮 */}
        {!isStreaming && !isEditing && (
          <div className="message-item__actions">
            <Tooltip title={copied ? '已复制' : '复制'}>
              <Button
                type="text"
                size="small"
                icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                onClick={handleCopy}
              />
            </Tooltip>
            <Tooltip title="编辑">
              <Button type="text" size="small" icon={<EditOutlined />} onClick={handleStartEdit} />
            </Tooltip>
            {isAssistant && (
              <Tooltip title="重试">
                <Button
                  type="text"
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => onRetry(message.id)}
                />
              </Tooltip>
            )}
            {isUser && isLeaf && (
              <Tooltip title="继续生成">
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowDownOutlined />}
                  onClick={() => onContinue(message.id)}
                />
              </Tooltip>
            )}
            <Popconfirm
              title="确定删除此消息？"
              onConfirm={() => onDelete(message.id)}
              okText="删除"
              cancelText="取消"
            >
              <Tooltip title="删除">
                <Button type="text" size="small" icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </div>
        )}
      </div>
    </div>
  )
}
