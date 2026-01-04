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
  UpOutlined,
  PictureOutlined
} from '@ant-design/icons'
import { Streamdown } from 'streamdown'
import { BranchNavigator } from './BranchNavigator'
import { ModelSelector } from './ModelSelector'
import { ModelConfigSelector } from './ModelConfigSelector'
import { MessageAttachments } from './MessageAttachments'
import { AttachmentPreview } from './AttachmentPreview'
import { selectAndSaveAttachments } from '../../../hooks/useAttachment'
import type { ChatMessage, FileAttachment } from '../../../types/type'

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
  onRetry: (messageId: string, llmId?: string, modelConfigId?: string) => void
  onContinue: (messageId: string) => void
  onDelete: (messageId: string) => void
  onEdit: (messageId: string, content: string, attachments?: FileAttachment[]) => void
  onEditAndResend: (messageId: string, content: string, attachments?: FileAttachment[]) => void
  onSwitchBranch: (messageId: string) => void
  onQuote?: (text: string) => void
  onToggleCollapse?: (messageId: string) => void
}

export const MessageItem = React.memo(function MessageItem({
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
  const [editAttachments, setEditAttachments] = useState<FileAttachment[]>([])
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
    setEditAttachments(message.attachments ?? [])
    setIsEditing(true)
    // 延迟滚动，等待编辑框渲染
    setTimeout(() => {
      itemRef.current?.scrollIntoView({ block: 'center' })
    }, 50)
  }, [message.content, message.attachments])

  const handleCancelEdit = (): void => {
    setIsEditing(false)
    setEditContent(message.content)
    setEditAttachments(message.attachments ?? [])
  }

  const handleSaveEdit = (): void => {
    const contentChanged = editContent.trim() !== message.content
    const attachmentsChanged =
      JSON.stringify(editAttachments) !== JSON.stringify(message.attachments ?? [])

    if (editContent.trim() && (contentChanged || attachmentsChanged)) {
      onEdit(message.id, editContent.trim(), editAttachments)
    }
    setIsEditing(false)
  }

  const handleEditAndResend = (): void => {
    if (editContent.trim() || editAttachments.length > 0) {
      onEditAndResend(message.id, editContent.trim(), editAttachments)
    }
    setIsEditing(false)
  }

  const handleRemoveEditAttachment = useCallback((attachmentId: string): void => {
    setEditAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
  }, [])

  const handleAddEditAttachments = useCallback(async (): Promise<void> => {
    const newAttachments = await selectAndSaveAttachments()
    if (newAttachments.length > 0) {
      setEditAttachments((prev) => [...prev, ...newAttachments])
    }
  }, [])

  // 编辑模式拖拽上传
  const [isEditDragOver, setIsEditDragOver] = useState(false)

  const handleEditDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      setIsEditDragOver(true)
    }
  }, [])

  const handleEditDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsEditDragOver(false)
  }, [])

  const handleEditDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsEditDragOver(false)

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(f.type)
    )
    if (files.length === 0) return

    // 读取并保存文件
    for (const file of files) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.readAsDataURL(file)
      })

      const fileId = Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
      const result = await window.api.attachment.save({
        fileId,
        fileName: file.name,
        base64Content: base64
      })

      if (result.success && result.localPath) {
        const localPath = result.localPath
        setEditAttachments((prev) => [
          ...prev,
          {
            id: fileId,
            name: file.name,
            type: file.type,
            size: file.size,
            localPath,
            createdAt: Date.now()
          }
        ])
      }
    }
  }, [])

  // 编辑模式粘贴上传
  const handleEditPaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    const imageFiles: File[] = []

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) imageFiles.push(file)
      }
    }

    if (imageFiles.length === 0) return

    e.preventDefault()

    for (const file of imageFiles) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.readAsDataURL(file)
      })

      const fileId = Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
      const result = await window.api.attachment.save({
        fileId,
        fileName: file.name,
        base64Content: base64
      })

      if (result.success && result.localPath) {
        const localPath = result.localPath
        setEditAttachments((prev) => [
          ...prev,
          {
            id: fileId,
            name: file.name,
            type: file.type,
            size: file.size,
            localPath,
            createdAt: Date.now()
          }
        ])
      }
    }
  }, [])

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
      className={`message-item ${isStreaming ? 'message-item--streaming' : ''} ${isLast ? 'message-item--last' : ''} ${message.hasError ? 'message-item--error' : ''}`}
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

          {/* 模型配置选择器 - assistant 消息 */}
          {isAssistant && (
            <ModelConfigSelector
              value={message.modelConfigId}
              onChange={(modelConfigId) => onRetry(message.id, undefined, modelConfigId)}
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
          <div
            className={`message-item__reasoning ${reasoningExpanded ? 'message-item__reasoning--expanded' : ''}`}
          >
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

        {/* 消息附件 */}
        {message.attachments && message.attachments.length > 0 && !message.collapsed && (
          <MessageAttachments attachments={message.attachments} />
        )}

        {/* 消息内容 */}
        {isEditing ? (
          <div
            className={`message-item__edit ${isUser && isEditDragOver ? 'message-item__edit--drag-over' : ''}`}
            onDragOver={isUser ? handleEditDragOver : undefined}
            onDragLeave={isUser ? handleEditDragLeave : undefined}
            onDrop={isUser ? handleEditDrop : undefined}
          >
            {/* 用户消息编辑时显示附件预览 */}
            {isUser && editAttachments.length > 0 && (
              <AttachmentPreview
                attachments={editAttachments}
                onRemove={handleRemoveEditAttachment}
              />
            )}
            <TextArea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onPaste={isUser ? handleEditPaste : undefined}
              autoSize={{ minRows: 2, maxRows: 10 }}
              autoFocus
            />
            <div className="message-item__edit-actions">
              {isUser && (
                <Tooltip title="添加图片">
                  <Button
                    size="small"
                    type="text"
                    icon={<PictureOutlined />}
                    onClick={handleAddEditAttachments}
                  />
                </Tooltip>
              )}
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
            {/* 拖拽提示 */}
            {isUser && isEditDragOver && (
              <div className="message-item__edit-drag-overlay">
                <PictureOutlined />
                <span>释放以添加图片</span>
              </div>
            )}
          </div>
        ) : message.collapsed ? (
          <div className="message-item__preview" onClick={() => onToggleCollapse?.(message.id)}>
            {collapsedPreview}
          </div>
        ) : (
          <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']}>
            <div className="message-item__body">
              <Streamdown isAnimating={isStreaming && isAssistant}>
                {displayContent}
              </Streamdown>
            </div>
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
})
