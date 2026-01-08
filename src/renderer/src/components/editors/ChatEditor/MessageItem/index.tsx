import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Avatar } from 'antd'
import type { InputRef } from 'antd'
import { UserOutlined, RobotOutlined } from '@ant-design/icons'
import { TopicHeader } from './TopicHeader'
import { MessageHeader } from './MessageHeader'
import { TitleRow } from './TitleRow'
import { ReasoningContent } from './ReasoningContent'
import { MessageContent } from './MessageContent'
import { MessageActions } from './MessageActions'
import { MessageAttachments } from '../MessageAttachments'
import type { ChatMessage, FileAttachment, Topic } from '../../../../types/type'
import type { GenerateOptions } from '../../../common/AIGeneratePopover'
import '../MessageItem.css'

// 保持向后兼容的 Props 接口
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
  onExport?: (messageId: string) => void
  onExportText?: (text: string) => void
  onExportCode?: (code: string, language: string) => void
  onExportTable?: (markdown: string) => void
  onUpdateTitle?: (messageId: string, title: string) => void
  onGenerateTitle?: (messageId: string, options: GenerateOptions) => Promise<void>
  onGenerateTopic?: (messageId: string, options: GenerateOptions) => Promise<void>
  topic?: Topic
  topicMessageCount?: number
  onCreateTopic?: (messageId: string, name: string) => void
  onUpdateTopic?: (topicId: string, updates: Partial<Omit<Topic, 'id'>>) => void
  onDeleteTopic?: (topicId: string) => void
  onToggleTopicCollapse?: (topicId: string) => void
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
  onToggleCollapse,
  onExport,
  onExportText,
  onExportCode,
  onExportTable,
  onUpdateTitle,
  onGenerateTitle,
  onGenerateTopic,
  topic,
  topicMessageCount,
  onCreateTopic,
  onUpdateTopic,
  onDeleteTopic,
  onToggleTopicCollapse
}: MessageItemProps): React.JSX.Element {
  // 编辑状态
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [editAttachments, setEditAttachments] = useState<FileAttachment[]>([])
  const [copied, setCopied] = useState(false)

  // 推理内容展开状态
  const [reasoningExpanded, setReasoningExpanded] = useState(!!isStreaming && !!streamingReasoning)
  const wasStreaming = useRef(isStreaming)
  const userToggledReasoning = useRef(false)

  // Title 编辑状态
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitleValue, setEditTitleValue] = useState(message.title || '')
  const [titlePopoverOpen, setTitlePopoverOpen] = useState(false)
  const titleInputRef = useRef<InputRef>(null)

  // Topic 编辑状态
  const [isEditingTopic, setIsEditingTopic] = useState(false)
  const [editTopicValue, setEditTopicValue] = useState(topic?.name || '')
  const [topicPopoverOpen, setTopicPopoverOpen] = useState(false)
  const topicInputRef = useRef<InputRef>(null)

  const itemRef = useRef<HTMLDivElement>(null)

  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  // 显示内容
  const displayContent = isStreaming ? (streamingContent ?? '') : message.content
  const displayReasoning = isStreaming ? streamingReasoning : message.reasoning_content

  // 折叠预览文本
  const collapsedPreview = useMemo(() => {
    if (!message.collapsed) return ''
    if (isStreaming) return '流式输出中...'
    const text = displayContent.replace(/\s+/g, ' ').trim()
    return text.length > 80 ? text.slice(0, 80) + '...' : text
  }, [message.collapsed, displayContent, isStreaming])

  // streaming 时有 reasoning 就展开
  useEffect(() => {
    if (isStreaming && streamingReasoning && !userToggledReasoning.current) {
      if (!reasoningExpanded) {
        setReasoningExpanded(true)
      }
    }
  }, [isStreaming, streamingReasoning, reasoningExpanded])

  // streaming 结束后自动折叠
  useEffect(() => {
    if (wasStreaming.current && !isStreaming) {
      setReasoningExpanded(false)
      userToggledReasoning.current = false
    }
    wasStreaming.current = isStreaming
  }, [isStreaming])

  // 编辑处理
  const handleStartEdit = useCallback((): void => {
    setEditContent(message.content)
    setEditAttachments(message.attachments ?? [])
    setIsEditing(true)
    setTimeout(() => {
      itemRef.current?.scrollIntoView({ block: 'center' })
    }, 50)
  }, [message.content, message.attachments])

  const handleCancelEdit = useCallback((): void => {
    setIsEditing(false)
    setEditContent(message.content)
    setEditAttachments(message.attachments ?? [])
  }, [message.content, message.attachments])

  const handleSaveEdit = useCallback((): void => {
    const contentChanged = editContent.trim() !== message.content
    const attachmentsChanged =
      JSON.stringify(editAttachments) !== JSON.stringify(message.attachments ?? [])

    if (editContent.trim() && (contentChanged || attachmentsChanged)) {
      onEdit(message.id, editContent.trim(), editAttachments)
    }
    setIsEditing(false)
  }, [editContent, editAttachments, message.id, message.content, message.attachments, onEdit])

  const handleEditAndResend = useCallback((): void => {
    if (editContent.trim() || editAttachments.length > 0) {
      onEditAndResend(message.id, editContent.trim(), editAttachments)
    }
    setIsEditing(false)
  }, [editContent, editAttachments, message.id, onEditAndResend])

  // 复制处理
  const handleCopy = useCallback((): void => {
    navigator.clipboard.writeText(displayContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [displayContent])

  // 推理内容展开/折叠
  const handleToggleReasoning = useCallback((): void => {
    userToggledReasoning.current = true
    setReasoningExpanded((prev) => !prev)
  }, [])

  // Title 编辑处理
  const handleStartTitleEdit = useCallback(() => {
    setEditTitleValue(message.title || '')
    setIsEditingTitle(true)
    setTimeout(() => titleInputRef.current?.focus(), 50)
  }, [message.title])

  const handleSaveTitle = useCallback(() => {
    const trimmedTitle = editTitleValue.trim()
    onUpdateTitle?.(message.id, trimmedTitle)
    setIsEditingTitle(false)
  }, [message.id, editTitleValue, onUpdateTitle])

  const handleCancelTitleEdit = useCallback(() => {
    setIsEditingTitle(false)
    setEditTitleValue(message.title || '')
  }, [message.title])

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSaveTitle()
      } else if (e.key === 'Escape') {
        handleCancelTitleEdit()
      }
    },
    [handleSaveTitle, handleCancelTitleEdit]
  )

  const handleTitlePopoverOpenChange = useCallback((open: boolean) => {
    setTitlePopoverOpen(open)
    if (!open) setIsEditingTitle(false)
  }, [])

  // Topic 编辑处理
  const handleStartTopicEdit = useCallback(() => {
    setEditTopicValue(topic?.name || '')
    setIsEditingTopic(true)
    setTimeout(() => topicInputRef.current?.focus(), 50)
  }, [topic?.name])

  const handleSaveTopic = useCallback(() => {
    const trimmedTopic = editTopicValue.trim()
    if (trimmedTopic) {
      if (topic) {
        onUpdateTopic?.(topic.id, { name: trimmedTopic })
      } else {
        onCreateTopic?.(message.id, trimmedTopic)
      }
    }
    setIsEditingTopic(false)
  }, [message.id, topic, editTopicValue, onUpdateTopic, onCreateTopic])

  const handleCancelTopicEdit = useCallback(() => {
    setIsEditingTopic(false)
    setEditTopicValue(topic?.name || '')
  }, [topic?.name])

  const handleTopicKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSaveTopic()
      } else if (e.key === 'Escape') {
        handleCancelTopicEdit()
      }
    },
    [handleSaveTopic, handleCancelTopicEdit]
  )

  const handleTopicPopoverOpenChange = useCallback((open: boolean) => {
    setTopicPopoverOpen(open)
    if (!open) setIsEditingTopic(false)
  }, [])

  // Callbacks 分组
  const topicCallbacks = useMemo(
    () => ({
      onCreateTopic,
      onUpdateTopic,
      onDeleteTopic,
      onToggleTopicCollapse,
      onGenerateTopic
    }),
    [onCreateTopic, onUpdateTopic, onDeleteTopic, onToggleTopicCollapse, onGenerateTopic]
  )

  const titleCallbacks = useMemo(
    () => ({
      onUpdateTitle,
      onGenerateTitle
    }),
    [onUpdateTitle, onGenerateTitle]
  )

  const exportCallbacks = useMemo(
    () => ({
      onExport,
      onExportText,
      onExportCode,
      onExportTable
    }),
    [onExport, onExportText, onExportCode, onExportTable]
  )

  return (
    <div
      ref={itemRef}
      className={`message-item ${isUser ? 'message-item--user' : 'message-item--assistant'} ${isStreaming ? 'message-item--streaming' : ''} ${isLast ? 'message-item--last' : ''} ${message.hasError ? 'message-item--error' : ''}`}
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
        {/* Topic 头部 */}
        {topic && (
          <TopicHeader
            topic={topic}
            topicMessageCount={topicMessageCount}
            messageId={message.id}
            displayContent={displayContent}
            isEditing={isEditingTopic}
            editValue={editTopicValue}
            popoverOpen={topicPopoverOpen}
            inputRef={topicInputRef}
            onEditValueChange={setEditTopicValue}
            onStartEdit={handleStartTopicEdit}
            onSave={handleSaveTopic}
            onCancel={handleCancelTopicEdit}
            onKeyDown={handleTopicKeyDown}
            onPopoverOpenChange={handleTopicPopoverOpenChange}
            topicCallbacks={topicCallbacks}
          />
        )}

        {/* Topic 折叠时隐藏以下所有内容 */}
        {!(topic && topic.collapsed) && (
          <>
            {/* 消息头部 */}
            <MessageHeader
              message={message}
              isUser={isUser}
              isAssistant={isAssistant}
              isStreaming={isStreaming}
              branchIndex={branchIndex}
              branchCount={branchCount}
              siblings={siblings}
              onToggleCollapse={onToggleCollapse}
              onRetry={onRetry}
              onSwitchBranch={onSwitchBranch}
            />

            {/* 标题行 */}
            <TitleRow
              messageId={message.id}
              title={message.title}
              isEditing={isEditingTitle}
              editValue={editTitleValue}
              popoverOpen={titlePopoverOpen}
              inputRef={titleInputRef}
              onEditValueChange={setEditTitleValue}
              onStartEdit={handleStartTitleEdit}
              onSave={handleSaveTitle}
              onCancel={handleCancelTitleEdit}
              onKeyDown={handleTitleKeyDown}
              onPopoverOpenChange={handleTitlePopoverOpenChange}
              titleCallbacks={titleCallbacks}
            />

            {/* 推理内容 */}
            {displayReasoning && (
              <ReasoningContent
                content={displayReasoning}
                expanded={reasoningExpanded}
                onToggle={handleToggleReasoning}
              />
            )}

            {/* 消息附件 */}
            {message.attachments && message.attachments.length > 0 && !message.collapsed && (
              <MessageAttachments attachments={message.attachments} />
            )}

            {/* 消息内容 */}
            <MessageContent
              message={message}
              displayContent={displayContent}
              isUser={isUser}
              isAssistant={isAssistant}
              isStreaming={isStreaming}
              isEditing={isEditing}
              editContent={editContent}
              editAttachments={editAttachments}
              collapsed={message.collapsed ?? false}
              collapsedPreview={collapsedPreview}
              topic={topic}
              onEditContentChange={setEditContent}
              onEditAttachmentsChange={setEditAttachments}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              onEditAndResend={handleEditAndResend}
              onToggleCollapse={() => onToggleCollapse?.(message.id)}
              onStartTitleEdit={handleStartTitleEdit}
              onStartTopicEdit={handleStartTopicEdit}
              topicCallbacks={topicCallbacks}
              exportCallbacks={exportCallbacks}
              onQuote={onQuote}
            />

            {/* 操作按钮 */}
            {!isStreaming && !isEditing && (
              <MessageActions
                isUser={isUser}
                isAssistant={isAssistant}
                isLeaf={isLeaf}
                copied={copied}
                onCopy={handleCopy}
                onStartEdit={handleStartEdit}
                onRetry={() => onRetry(message.id)}
                onContinue={() => onContinue(message.id)}
                onDelete={() => onDelete(message.id)}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
})
