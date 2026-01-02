import { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react'
import { Empty } from 'antd'
import { MessageItem } from './MessageItem'
import { streamingManager } from '../../../services/streamingManager'
import { useChatUIStore } from '../../../stores/chatUIStore'
import type { ChatMessage } from '../../../types/type'

export interface MessageListRef {
  scrollToMessage: (messageId: string) => void
  scrollToPrev: () => void
  scrollToNext: () => void
  collapseAll: () => void
  expandAll: () => void
}

interface MessageListProps {
  pageId: string
  messages: ChatMessage[]
  isStreaming: boolean
  onRetry: (messageId: string, llmId?: string) => void
  onContinue: (messageId: string) => void
  onDelete: (messageId: string) => void
  onEdit: (messageId: string, content: string) => void
  onEditAndResend: (messageId: string, content: string) => void
  onSwitchBranch: (messageId: string) => void
  onQuote: (text: string) => void
  getChildMessages: (parentId: string | undefined) => ChatMessage[]
  onToggleCollapse: (messageId: string) => void
  onCollapseAll: () => void
  onExpandAll: () => void
}

export const MessageList = forwardRef<MessageListRef, MessageListProps>(function MessageList(
  {
    pageId,
    messages,
    isStreaming,
    onRetry,
    onContinue,
    onDelete,
    onEdit,
    onEditAndResend,
    onSwitchBranch,
    onQuote,
    getChildMessages,
    onToggleCollapse,
    onCollapseAll,
    onExpandAll
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)
  const lastScrollTop = useRef(0)
  const prevPageId = useRef(pageId)
  const scrollRAF = useRef<number>()
  const { getState, setScrollTop } = useChatUIStore()

  // 订阅 streamingManager 更新
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    return streamingManager.subscribe(() => forceUpdate((n) => n + 1))
  }, [])

  const handleScroll = (): void => {
    const container = containerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50

    if (scrollTop < lastScrollTop.current) {
      shouldAutoScroll.current = false
    } else if (scrollTop > lastScrollTop.current && isNearBottom) {
      shouldAutoScroll.current = true
    }

    lastScrollTop.current = scrollTop
    // 保存滚动位置（-1 表示在底部）
    setScrollTop(pageId, isNearBottom ? -1 : scrollTop)
  }

  useEffect(() => {
    if (isStreaming && shouldAutoScroll.current && containerRef.current) {
      if (scrollRAF.current) cancelAnimationFrame(scrollRAF.current)
      scrollRAF.current = requestAnimationFrame(() => {
        containerRef.current?.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: 'smooth'
        })
      })
    }
  })

  useEffect(() => {
    if (isStreaming) {
      shouldAutoScroll.current = true
    }
  }, [isStreaming])

  // 切换 page 时恢复滚动位置
  useEffect(() => {
    if (pageId !== prevPageId.current) {
      prevPageId.current = pageId
      const container = containerRef.current
      if (!container) return

      const savedScrollTop = getState(pageId).scrollTop
      if (savedScrollTop === -1) {
        container.scrollTop = container.scrollHeight
      } else {
        container.scrollTop = savedScrollTop
      }
      shouldAutoScroll.current = savedScrollTop === -1
    }
  }, [pageId, getState])

  // 获取当前可见的第一条消息索引
  const getCurrentVisibleIndex = (): number => {
    const container = containerRef.current
    if (!container) return 0

    const containerRect = container.getBoundingClientRect()
    const messageEls = container.querySelectorAll('[data-message-id]')

    for (let i = 0; i < messageEls.length; i++) {
      const rect = messageEls[i].getBoundingClientRect()
      // 消息顶部在容器可见区域内
      if (rect.top >= containerRect.top - 50) {
        return i
      }
    }
    return messages.length - 1
  }

  // 暴露方法
  useImperativeHandle(ref, () => ({
    scrollToMessage: (messageId: string) => {
      const container = containerRef.current
      if (!container) return

      const messageEl = container.querySelector(`[data-message-id="${messageId}"]`)
      if (messageEl) {
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
        shouldAutoScroll.current = false
      }
    },
    scrollToPrev: () => {
      const currentIndex = getCurrentVisibleIndex()
      if (currentIndex > 0) {
        const prevId = messages[currentIndex - 1].id
        const container = containerRef.current
        const messageEl = container?.querySelector(`[data-message-id="${prevId}"]`)
        if (messageEl) {
          messageEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
          shouldAutoScroll.current = false
        }
      }
    },
    scrollToNext: () => {
      const currentIndex = getCurrentVisibleIndex()
      const container = containerRef.current
      if (!container) return

      if (currentIndex < messages.length - 1) {
        // 还有下一条，滚动到下一条的 start
        const nextId = messages[currentIndex + 1].id
        const messageEl = container.querySelector(`[data-message-id="${nextId}"]`)
        if (messageEl) {
          messageEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
          shouldAutoScroll.current = false
        }
      } else {
        // 已经是最后一条，滚动到底部
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
        shouldAutoScroll.current = true
      }
    },
    collapseAll: onCollapseAll,
    expandAll: onExpandAll
  }))

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="chat-editor__messages chat-editor__messages--empty">
        <Empty description="开始新对话" />
      </div>
    )
  }

  return (
    <div className="chat-editor__messages" ref={containerRef} onScroll={handleScroll}>
      {messages.map((message, index) => {
        const parentId = message.parentMessageId
        const siblings = getChildMessages(parentId)
        const branchIndex = siblings.findIndex((s) => s.id === message.id)
        const branchCount = siblings.length
        const childMessages = getChildMessages(message.id)
        const isLeaf = childMessages.length === 0

        // 检查是否是正在 streaming 的消息
        const streaming = streamingManager.get(message.id)

        return (
          <MessageItem
            key={message.id}
            message={message}
            isLast={index === messages.length - 1}
            isLeaf={isLeaf}
            isStreaming={!!streaming}
            streamingContent={streaming?.content}
            streamingReasoning={streaming?.reasoning}
            branchIndex={branchIndex}
            branchCount={branchCount}
            siblings={siblings}
            onRetry={onRetry}
            onContinue={onContinue}
            onDelete={onDelete}
            onEdit={onEdit}
            onEditAndResend={onEditAndResend}
            onSwitchBranch={onSwitchBranch}
            onQuote={onQuote}
            onToggleCollapse={onToggleCollapse}
          />
        )
      })}
    </div>
  )
})
