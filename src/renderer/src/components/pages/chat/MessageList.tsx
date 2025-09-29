import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import { ChatMessage, LLMConfig } from '../../../types/type'
import MessageItem from './MessageItem'
import WelcomeMessage from './WelcomeMessage'
import MessageSearch from './MessageSearch'
import { MessageTree } from './messageTree'
import { useStreamingMessage } from '../../../stores/messagesStore'
import { useMessageSearch } from '../../../hooks/useMessageSearch'

interface MessageListProps {
  chatId: string // 添加chatId prop
  messages: ChatMessage[]
  currentPath?: string[]
  isLoading?: boolean
  streamingContent?: string
  streamingTimestamp?: number
  llmConfigs?: LLMConfig[]
  selectedMessageId?: string | null // 新增：选中的消息ID，用于滚动定位
  onRetryMessage?: (messageId: string) => void
  onEditMessage?: (messageId: string, newContent: string) => void
  onEditAndResendMessage?: (messageId: string, newContent: string) => void
  onToggleFavorite?: (messageId: string) => void
  onModelChange?: (messageId: string, newModelId: string) => void
  onDeleteMessage?: (messageId: string) => void
  onSwitchBranch?: (messageId: string, branchIndex: number) => void
  onStopGeneration?: () => void
  onQuote?: (text: string) => void
  onCreateNewChat?: (text: string) => void
  // 折叠相关
  collapsedMessages?: string[]
  onToggleMessageCollapse?: (messageId: string) => void
  // 设置相关
  onOpenSettings?: () => void
}

const MessageList = React.memo(function MessageList({
  chatId,
  messages,
  currentPath = [],
  isLoading = false,
  streamingContent,
  llmConfigs = [],
  selectedMessageId,
  onRetryMessage,
  onEditMessage,
  onEditAndResendMessage,
  onToggleFavorite,
  onModelChange,
  onDeleteMessage,
  onSwitchBranch,
  collapsedMessages = [],
  onToggleMessageCollapse,
  onOpenSettings,
  onQuote,
  onCreateNewChat
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const prevMessagesLength = useRef<number>(0)
  const prevStreamingContent = useRef<string>('')
  const prevCurrentPath = useRef<string[]>([])
  const prevSelectedMessageId = useRef<string | null>(null)
  const isInitialRender = useRef<boolean>(true)
  
  // 控制是否自动滚动到底部
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true)

  // 搜索功能
  const searchHook = useMessageSearch(messages)
  const {
    searchQuery,
    currentMatchIndex,
    totalMatches,
    isSearchVisible,
    showSearch,
    hideSearch,
    search,
    getCurrentMatch,
    getHighlightInfo
  } = searchHook

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

  // 获取最后一条消息的ID，用于订阅其流式内容
  const lastMessageId = displayMessages.length > 0 ? displayMessages[displayMessages.length - 1].id : null
  
  // 只订阅最后一条消息的流式内容
  const lastMessageStreaming = useStreamingMessage(chatId, lastMessageId || '')

  // 计算当前的流式内容，用于触发滚动
  const currentStreamingContent = lastMessageStreaming?.content || ''

  // 检查是否距离底部较近
  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return true
    
    const threshold = 100 // 100px 的阈值，仅用于判断是否接近底部以恢复自动滚动
    const { scrollTop, scrollHeight, clientHeight } = container
    return scrollHeight - scrollTop - clientHeight <= threshold
  }, [])

  // 处理鼠标滚轮事件
  const handleWheel = useCallback((event: WheelEvent) => {
    if (isInitialRender.current) return // 忽略初次渲染时的滚动事件
    
    const deltaY = event.deltaY
    
    if (deltaY < 0) {
      // 向上滚动，停止自动滚动
      if (isAutoScrollEnabled) {
        setIsAutoScrollEnabled(false)
      }
    } else if (deltaY > 0) {
      // 向下滚动，如果接近底部就恢复自动滚动
      if (!isAutoScrollEnabled && isNearBottom()) {
        setIsAutoScrollEnabled(true)
      }
    }
  }, [isAutoScrollEnabled, isNearBottom])

  // 添加和移除滚轮事件监听器
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    container.addEventListener('wheel', handleWheel, { passive: true })

    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  // 添加键盘事件监听器
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+F 打开搜索
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault()
        showSearch()
      }
      // Esc 关闭搜索
      else if (event.key === 'Escape' && isSearchVisible) {
        hideSearch()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showSearch, hideSearch, isSearchVisible])

  const scrollToBottom = (behavior: 'smooth' | 'instant' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  // 滚动到指定的消息
  const scrollToMessage = (messageId: string, behavior: 'smooth' | 'instant' = 'smooth') => {
    const messageElement = messageRefs.current.get(messageId)
    if (messageElement) {
      messageElement.scrollIntoView({ behavior, block: 'start' })
    }
  }

  // 处理搜索导航
  const handleSearch = useCallback((query: string, currentIndex: number, direction: 'next' | 'previous') => {
    search(query, currentIndex, direction)
  }, [search])

  useEffect(() => {
    const currentMessagesLength = messages.length
    const currentPathString = JSON.stringify(currentPath)
    const prevPathString = JSON.stringify(prevCurrentPath.current)

    // 检查路径是否发生变化（排除初次渲染）
    const pathChanged = !isInitialRender.current && currentPathString !== prevPathString
    
    // 检查选中消息是否发生变化
    const selectedMessageChanged = !isInitialRender.current && selectedMessageId !== prevSelectedMessageId.current

    // 如果正在搜索，不进行自动滚动
    const isSearching = isSearchVisible && searchQuery

    // 只在以下情况下滚动：
    // 1. 消息总数增加（有新消息）- 滚动到底部
    // 2. 流式内容发生变化（正在接收AI回复）- 滚动到底部
    // 3. 初次渲染且有消息 - 滚动到底部
    // 4. 当前路径发生变化（用户点击消息树切换分支）- 滚动到底部
    // 5. 选中消息发生变化（用户点击消息树中的特定消息）- 滚动到选中消息
    const shouldScrollToBottom =
      !isSearching && (
        currentMessagesLength > prevMessagesLength.current ||
        currentStreamingContent !== prevStreamingContent.current ||
        (isInitialRender.current && currentMessagesLength > 0) ||
        (pathChanged && !selectedMessageChanged)
      )

    const shouldScrollToMessage = selectedMessageChanged && selectedMessageId

    // 用户主动选择消息时强制滚动，不受自动滚动状态限制
    if (shouldScrollToMessage) {
      // 滚动到选中的消息（强制执行，不受自动滚动状态影响）
      scrollToMessage(selectedMessageId!, 'smooth')
      // 用户主动导航时，恢复自动滚动功能
      if (!isAutoScrollEnabled) {
        setIsAutoScrollEnabled(true)
      }
    } else if (isAutoScrollEnabled && shouldScrollToBottom) {
      // 只有在启用自动滚动时才自动滚动到底部
      const behavior = isInitialRender.current ? 'instant' : 'smooth'
      scrollToBottom(behavior)
    }

    // 标记初次渲染已完成
    if (isInitialRender.current) {
      isInitialRender.current = false
    }

    // 更新引用值
    prevMessagesLength.current = currentMessagesLength
    prevStreamingContent.current = currentStreamingContent
    prevCurrentPath.current = [...currentPath]
    prevSelectedMessageId.current = selectedMessageId
  }, [messages.length, currentStreamingContent, currentPath, selectedMessageId, isAutoScrollEnabled, isSearchVisible, searchQuery])

  // 单独处理搜索滚动
  useEffect(() => {
    if (!searchQuery || !isSearchVisible) return

    // 搜索结果变化时滚动到当前匹配项
    const currentMatch = getCurrentMatch()
    if (currentMatch) {
      // 使用短延时确保高亮已经应用
      const timeoutId = setTimeout(() => {
        // 优先查找具体的高亮元素
        // 首先尝试使用更精确的选择器
        let currentHighlight = document.querySelector(
          `.search-highlight.current-match[data-message-id="${currentMatch.messageId}"][data-match-index="${currentMatch.matchIndex || 0}"]`
        )

        // 如果没找到，尝试查找任何当前高亮
        if (!currentHighlight) {
          currentHighlight = document.querySelector('.search-highlight.current-match')
        }

        if (currentHighlight) {
          // 滚动到具体的高亮元素
          currentHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' })
        } else {
          // 如果没找到高亮元素，至少滚动到消息
          const messageElement = messageRefs.current.get(currentMatch.messageId)
          if (messageElement) {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }
      }, 200) // 稍微增加延时确保DOM更新完成

      return () => clearTimeout(timeoutId)
    }
  }, [searchQuery, currentMatchIndex, isSearchVisible, getCurrentMatch])

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
      <div className="messages-container" ref={messagesContainerRef}>
        <WelcomeMessage onOpenSettings={onOpenSettings} />
      </div>
    )
  }

  return (
    <div className="messages-container" ref={messagesContainerRef}>
      {/* 搜索组件 */}
      {isSearchVisible && (
        <MessageSearch
          isVisible={isSearchVisible}
          onClose={() => {
            hideSearch()
            // 立即清空搜索查询，确保高亮被清除
            search('', 0, 'next')
          }}
          onSearch={handleSearch}
          currentIndex={currentMatchIndex}
          totalMatches={totalMatches}
        />
      )}

      <div className="messages-list">
        {displayMessages.map((message, index) => (
          <div
            key={message.id}
            ref={(el) => {
              if (el) {
                messageRefs.current.set(message.id, el)
              } else {
                messageRefs.current.delete(message.id)
              }
            }}
          >
            <MessageItem
              message={message}
              isLoading={isLoading}
              isLastMessage={index === displayMessages.length - 1 && !streamingContent}
              llmConfigs={llmConfigs}
              chatId={chatId} // 传递chatId
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
              onDelete={onDeleteMessage}
              onQuote={onQuote}
              onCreateNewChat={onCreateNewChat}
              // 折叠相关
              isCollapsed={collapsedMessages.includes(message.id)}
              onToggleCollapse={onToggleMessageCollapse}
              // 搜索相关
              searchQuery={searchQuery}
              getCurrentMatch={getCurrentMatch}
              getHighlightInfo={getHighlightInfo}
              currentMatchIndex={currentMatchIndex}
            />
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>
    </div>
  )
})

export default MessageList
