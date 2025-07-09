import React, { useRef, useEffect, useMemo } from 'react'
import { Empty } from 'antd'
import { ChatMessage, LLMConfig } from '../../../types'
import MessageItem from './MessageItem'
import WelcomeMessage from './WelcomeMessage'
import { MessageTree } from './messageTree'

interface MessageListProps {
  messages: ChatMessage[]
  currentPath?: string[]
  isLoading?: boolean
  streamingContent?: string
  streamingTimestamp?: number
  llmConfigs?: LLMConfig[]
  onRetryMessage?: (messageId: string) => void
  onEditMessage?: (messageId: string, newContent: string) => void
  onEditAndResendMessage?: (messageId: string, newContent: string) => void
  onToggleFavorite?: (messageId: string) => void
  onModelChange?: (messageId: string, newModelId: string) => void
  onSwitchBranch?: (messageId: string, branchIndex: number) => void
  onStopGeneration?: () => void
  // 折叠相关
  collapsedMessages?: string[]
  onToggleMessageCollapse?: (messageId: string) => void
  // 设置相关
  onOpenSettings?: () => void
}

export default function MessageList({
  messages,
  currentPath = [],
  isLoading = false,
  streamingContent,
  llmConfigs = [],
  onRetryMessage,
  onEditMessage,
  onEditAndResendMessage,
  onToggleFavorite,
  onModelChange,
  onSwitchBranch,
  collapsedMessages = [],
  onToggleMessageCollapse,
  onOpenSettings
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevMessagesLength = useRef<number>(0)
  const prevStreamingContent = useRef<string>('')
  const isInitialRender = useRef<boolean>(true)

  // 使用传入的消息树（从父组件创建，避免重复创建）
  const messageTree = useMemo(() => {
    return new MessageTree(messages)
  }, [messages])

  // 获取要显示的消息（沿着当前路径）
  const displayMessages = useMemo(() => {
    if (currentPath.length > 0) {
      // 使用提供的路径
      return currentPath
        .map((id) => messages.find((msg) => msg.id === id))
        .filter(Boolean) as ChatMessage[]
    } else {
      // 使用消息树的默认路径
      return messageTree.getCurrentPathMessages()
    }
  }, [messages, currentPath, messageTree])

  const scrollToBottom = (behavior: 'smooth' | 'instant' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  useEffect(() => {
    const currentMessagesLength = messages.length
    const currentStreamingContent = streamingContent || ''

    // 只在以下情况下滚动到底部：
    // 1. 消息总数增加（有新消息）
    // 2. 流式内容发生变化（正在接收AI回复）
    // 3. 初次渲染且有消息
    const shouldScroll =
      currentMessagesLength > prevMessagesLength.current ||
      currentStreamingContent !== prevStreamingContent.current ||
      (isInitialRender.current && currentMessagesLength > 0)

    if (shouldScroll) {
      // 初次渲染时直接跳转到底部，其他情况平滑滚动
      const behavior = isInitialRender.current ? 'instant' : 'smooth'
      scrollToBottom(behavior)

      // 标记初次渲染已完成
      if (isInitialRender.current) {
        isInitialRender.current = false
      }
    }

    // 更新引用值
    prevMessagesLength.current = currentMessagesLength
    prevStreamingContent.current = currentStreamingContent
  }, [messages.length, streamingContent])

  // 处理子分支切换
  const handleChildBranchSwitch = (parentMessageId: string, direction: 'previous' | 'next') => {
    const currentIndex = messageTree.getCurrentChildBranchIndex(parentMessageId)
    const branchCount = messageTree.getChildBranchCount(parentMessageId)

    let newIndex: number
    if (direction === 'previous') {
      newIndex = Math.max(0, currentIndex - 1)
    } else {
      newIndex = Math.min(branchCount - 1, currentIndex + 1)
    }

    if (newIndex !== currentIndex) {
      // 直接调用消息树的子分支切换方法
      const newPath = messageTree.switchToChildBranch(parentMessageId, newIndex)
      // 通过回调更新状态
      onSwitchBranch?.(parentMessageId, newIndex)
    }
  }

  // 处理兄弟分支切换
  const handleSiblingBranchSwitch = (messageId: string, direction: 'previous' | 'next') => {
    const currentIndex = messageTree.getCurrentSiblingBranchIndex(messageId)
    const branchCount = messageTree.getSiblingBranchCount(messageId)

    let newIndex: number
    if (direction === 'previous') {
      newIndex = Math.max(0, currentIndex - 1)
    } else {
      newIndex = Math.min(branchCount - 1, currentIndex + 1)
    }

    if (newIndex !== currentIndex) {
      // 直接调用消息树的兄弟分支切换方法
      const newPath = messageTree.switchToSiblingBranch(messageId, newIndex)
      // 通过回调更新状态
      onSwitchBranch?.(messageId, newIndex)
    }
  }

  if (!messages || (messages?.length === 0 && !streamingContent)) {
    return (
      <div className="messages-container">
        <WelcomeMessage onOpenSettings={onOpenSettings} />
      </div>
    )
  }

  return (
    <div className="messages-container">
      <div className="messages-list">
        {displayMessages.map((message, index) => (
          <MessageItem
            key={message.id}
            message={message}
            isLoading={isLoading}
            isLastMessage={index === displayMessages.length - 1 && !streamingContent}
            llmConfigs={llmConfigs}
            // 分支导航props - 所有消息都使用兄弟分支导航
            hasChildBranches={messageTree.hasSiblingBranches(message.id)}
            branchIndex={messageTree.getCurrentSiblingBranchIndex(message.id)}
            branchCount={messageTree.getSiblingBranchCount(message.id)}
            onBranchPrevious={(messageId) => handleSiblingBranchSwitch(messageId, 'previous')}
            onBranchNext={(messageId) => handleSiblingBranchSwitch(messageId, 'next')}
            // 原有的回调
            onRetry={onRetryMessage}
            onEdit={onEditMessage}
            onEditAndResend={onEditAndResendMessage}
            onToggleFavorite={onToggleFavorite}
            onModelChange={onModelChange}
            // 折叠相关
            isCollapsed={collapsedMessages.includes(message.id)}
            onToggleCollapse={onToggleMessageCollapse}
          />
        ))}

        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
