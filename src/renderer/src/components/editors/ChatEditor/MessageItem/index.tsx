import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Avatar } from 'antd'
import { UserOutlined, RobotOutlined } from '@ant-design/icons'
import { TopicHeader } from './TopicHeader'
import { MessageHeader } from './MessageHeader'
import { TitleRow } from './TitleRow'
import { ReasoningContent } from './ReasoningContent'
import { MessageContent } from './MessageContent'
import { MessageActions } from './MessageActions'
import { MessageAttachments } from '../MessageAttachments'
import type { FileAttachment } from '../../../../types/type'
import type { MessageItemProps, TitleRowRef, TopicHeaderRef } from './types'
import '../MessageItem.css'

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
  topic,
  topicMessageCount,
  actionCallbacks,
  titleCallbacks,
  topicCallbacks,
  exportCallbacks
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

  // 子组件 refs
  const titleRowRef = useRef<TitleRowRef>(null)
  const topicHeaderRef = useRef<TopicHeaderRef>(null)
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
      actionCallbacks.onEdit(message.id, editContent.trim(), editAttachments)
    }
    setIsEditing(false)
  }, [
    editContent,
    editAttachments,
    message.id,
    message.content,
    message.attachments,
    actionCallbacks
  ])

  const handleEditAndResend = useCallback((): void => {
    if (editContent.trim() || editAttachments.length > 0) {
      actionCallbacks.onEditAndResend(message.id, editContent.trim(), editAttachments)
    }
    setIsEditing(false)
  }, [editContent, editAttachments, message.id, actionCallbacks])

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

  // 触发 TitleRow 编辑
  const handleStartTitleEdit = useCallback(() => {
    titleRowRef.current?.startEdit()
  }, [])

  // 触发 TopicHeader 编辑
  const handleStartTopicEdit = useCallback(() => {
    topicHeaderRef.current?.startEdit()
  }, [])

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
            ref={topicHeaderRef}
            topic={topic}
            topicMessageCount={topicMessageCount}
            messageId={message.id}
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
              onToggleCollapse={actionCallbacks.onToggleCollapse}
              onRetry={actionCallbacks.onRetry}
              onSwitchBranch={actionCallbacks.onSwitchBranch}
            />

            {/* 标题行 */}
            <TitleRow
              ref={titleRowRef}
              messageId={message.id}
              title={message.title}
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
              onToggleCollapse={() => actionCallbacks.onToggleCollapse?.(message.id)}
              onStartTitleEdit={handleStartTitleEdit}
              onStartTopicEdit={handleStartTopicEdit}
              topicCallbacks={topicCallbacks}
              exportCallbacks={exportCallbacks}
              onQuote={actionCallbacks.onQuote}
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
                onRetry={() => actionCallbacks.onRetry(message.id)}
                onContinue={() => actionCallbacks.onContinue(message.id)}
                onDelete={() => actionCallbacks.onDelete(message.id)}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
})
