import {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useMemo,
  useLayoutEffect
} from 'react'
import { Empty } from 'antd'
import { MessageItem } from './MessageItem'
import { streamingManager } from '../../../services/streamingManager'
import {
  filterMessagesByTopicCollapse,
  findTopicByStartMessageId
} from '../../../services/messagesService'
import type { ChatMessage, FileAttachment, Topic, TopicGroup } from '../../../types/type'
import type { GenerateOptions } from '../../common/AIGeneratePopover'
import './MessageList.css'

export interface MessageListRef {
  scrollToMessage: (messageId: string, instant?: boolean) => void
  scrollToPrev: () => void
  scrollToNext: () => void
  collapseAll: () => void
  expandAll: () => void
  getContainer: () => HTMLDivElement | null
}

interface MessageListProps {
  pageId: string
  messages: ChatMessage[]
  allMessages: ChatMessage[]
  isStreaming: boolean
  onRetry: (messageId: string, llmId?: string, modelConfigId?: string) => void
  onContinue: (messageId: string) => void
  onDelete: (messageId: string) => void
  onEdit: (messageId: string, content: string, attachments?: FileAttachment[]) => void
  onEditAndResend: (messageId: string, content: string, attachments?: FileAttachment[]) => void
  onSwitchBranch: (messageId: string) => void
  onQuote: (text: string) => void
  onToggleCollapse: (messageId: string) => void
  onCollapseAll: () => void
  onExpandAll: () => void
  // Title 相关
  onUpdateTitle?: (messageId: string, title: string) => void
  onGenerateTitle?: (messageId: string, options: GenerateOptions) => Promise<void>
  onGenerateTopic?: (messageId: string, options: GenerateOptions) => Promise<void>
  // Topic 相关（独立 Topic 实体）
  topics: Topic[]
  topicGroups: TopicGroup[]
  onCreateTopic?: (messageId: string, name: string) => void
  onUpdateTopic?: (topicId: string, updates: Partial<Omit<Topic, 'id'>>) => void
  onDeleteTopic?: (topicId: string) => void
  onToggleTopicCollapse?: (topicId: string) => void
}

export const MessageList = forwardRef<MessageListRef, MessageListProps>(function MessageList(
  {
    pageId,
    messages,
    allMessages,
    isStreaming,
    onRetry,
    onContinue,
    onDelete,
    onEdit,
    onEditAndResend,
    onSwitchBranch,
    onQuote,
    onToggleCollapse,
    onCollapseAll,
    onExpandAll,
    onUpdateTitle,
    onGenerateTitle,
    onGenerateTopic,
    // Topic 相关
    topics,
    topicGroups,
    onCreateTopic,
    onUpdateTopic,
    onDeleteTopic,
    onToggleTopicCollapse
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)
  const lastScrollTop = useRef(0)
  const prevPageId = useRef(pageId)

  // 订阅 streamingManager 更新
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    return streamingManager.subscribe(() => forceUpdate((n) => n + 1))
  }, [])

  // 预计算 childrenMap: O(N) 一次性构建，后续查找 O(1)
  // 使用 allMessages 而非 messages，因为需要知道所有分支的信息
  const childrenMap = useMemo(() => {
    const map = new Map<string | undefined, ChatMessage[]>()
    for (const msg of allMessages) {
      const parentId = msg.parentMessageId
      const existing = map.get(parentId)
      if (existing) {
        existing.push(msg)
      } else {
        map.set(parentId, [msg])
      }
    }
    // 按 branchIndex 排序
    for (const children of map.values()) {
      children.sort((a, b) => (a.branchIndex ?? 0) - (b.branchIndex ?? 0))
    }
    return map
  }, [allMessages])

  // 预计算每条消息的分支信息: O(N)
  const branchInfoMap = useMemo(() => {
    const map = new Map<string, { branchIndex: number; branchCount: number; isLeaf: boolean }>()
    for (const msg of messages) {
      const siblings = childrenMap.get(msg.parentMessageId) ?? []
      const branchIndex = siblings.findIndex((s) => s.id === msg.id)
      const children = childrenMap.get(msg.id)
      map.set(msg.id, {
        branchIndex,
        branchCount: siblings.length,
        isLeaf: !children || children.length === 0
      })
    }
    return map
  }, [messages, childrenMap])

  // 创建 Topic 消息数量映射（基于传入的 topicGroups）
  const topicMessageCountMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const group of topicGroups) {
      map.set(group.startMessageId, group.messageIds.length)
    }
    return map
  }, [topicGroups])

  // 根据 Topic 折叠状态过滤要显示的消息
  const visibleMessages = useMemo(
    () => filterMessagesByTopicCollapse(messages, topicGroups),
    [messages, topicGroups]
  )

  // 滚动到底部
  const scrollToBottom = (behavior: ScrollBehavior = 'instant'): void => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior
    })
  }

  // 用户滚动时判断是否需要自动滚动
  const handleScroll = (): void => {
    const container = containerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50

    // 向上滚动时禁用自动滚动，滚到底部时恢复
    if (scrollTop < lastScrollTop.current) {
      shouldAutoScroll.current = false
    } else if (isNearBottom) {
      shouldAutoScroll.current = true
    }

    lastScrollTop.current = scrollTop
  }

  // 切换会话时滚动到底部
  useLayoutEffect(() => {
    if (pageId !== prevPageId.current) {
      prevPageId.current = pageId
      shouldAutoScroll.current = true
      scrollToBottom()
    }
  }, [pageId])

  // 消息变化时，如果是自动滚动模式则滚动到底部
  useLayoutEffect(() => {
    if (shouldAutoScroll.current) {
      scrollToBottom()
    }
  }, [messages])

  // streaming 时持续滚动到底部
  useEffect(() => {
    if (isStreaming && shouldAutoScroll.current) {
      scrollToBottom('smooth')
    }
  })

  // 开始 streaming 时启用自动滚动
  useEffect(() => {
    if (isStreaming) {
      shouldAutoScroll.current = true
    }
  }, [isStreaming])

  // 获取当前可见的第一条消息索引（基于 visibleMessages）
  const getCurrentVisibleIndex = (): number => {
    const container = containerRef.current
    if (!container || visibleMessages.length === 0) return 0

    const containerRect = container.getBoundingClientRect()
    const messageEls = container.querySelectorAll('[data-message-id]')

    // 遍历 DOM 元素，找到第一个在可见区域内的消息
    for (const el of messageEls) {
      const rect = el.getBoundingClientRect()

      // 对于高度小的消息（如折叠 Topic），顶部必须在视口内才算"当前"
      // 对于高度大的消息，允许顶部在视口上方 50px 以内
      const threshold = rect.height < 80 ? 0 : -50

      if (rect.top >= containerRect.top + threshold) {
        // 通过消息 ID 在 visibleMessages 中查找实际索引
        const messageId = el.getAttribute('data-message-id')
        if (messageId) {
          const index = visibleMessages.findIndex((m) => m.id === messageId)
          if (index >= 0) return index
        }
        break
      }
    }
    return visibleMessages.length - 1
  }

  // 暴露方法
  useImperativeHandle(ref, () => ({
    scrollToMessage: (messageId: string, instant?: boolean) => {
      const container = containerRef.current
      if (!container) return

      const messageEl = container.querySelector(`[data-message-id="${messageId}"]`)
      if (messageEl) {
        messageEl.scrollIntoView({ behavior: instant ? 'instant' : 'smooth', block: 'start' })
        shouldAutoScroll.current = false
      }
    },
    scrollToPrev: () => {
      const currentIndex = getCurrentVisibleIndex()
      if (currentIndex > 0) {
        // 使用 visibleMessages 确保导航到可见消息
        const prevId = visibleMessages[currentIndex - 1].id
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

      if (currentIndex < visibleMessages.length - 1) {
        // 使用 visibleMessages 确保导航到可见消息
        const nextId = visibleMessages[currentIndex + 1].id
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
    expandAll: onExpandAll,
    getContainer: () => containerRef.current
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
      {visibleMessages.map((message, index) => {
        // 使用预计算的映射表: O(1) 查找
        const branchInfo = branchInfoMap.get(message.id)
        const siblings = childrenMap.get(message.parentMessageId) ?? []

        // 检查是否是正在 streaming 的消息
        const streaming = streamingManager.get(message.id)

        // Topic 消息数量（仅 Topic 起始消息有）
        const topicMessageCount = topicMessageCountMap.get(message.id)

        // 查找此消息关联的 Topic（当此消息是 Topic 起始消息时）
        const messageTopic = findTopicByStartMessageId(topics, message.id)

        return (
          <MessageItem
            key={message.id}
            message={message}
            isLast={index === visibleMessages.length - 1}
            isLeaf={branchInfo?.isLeaf ?? true}
            isStreaming={!!streaming}
            streamingContent={streaming?.content}
            streamingReasoning={streaming?.reasoning}
            branchIndex={branchInfo?.branchIndex ?? 0}
            branchCount={branchInfo?.branchCount ?? 1}
            siblings={siblings}
            onRetry={onRetry}
            onContinue={onContinue}
            onDelete={onDelete}
            onEdit={onEdit}
            onEditAndResend={onEditAndResend}
            onSwitchBranch={onSwitchBranch}
            onQuote={onQuote}
            onToggleCollapse={onToggleCollapse}
            onUpdateTitle={onUpdateTitle}
            onGenerateTitle={onGenerateTitle}
            onGenerateTopic={onGenerateTopic}
            // Topic 相关
            topic={messageTopic}
            topicMessageCount={topicMessageCount}
            onCreateTopic={onCreateTopic}
            onUpdateTopic={onUpdateTopic}
            onDeleteTopic={onDeleteTopic}
            onToggleTopicCollapse={onToggleTopicCollapse}
          />
        )
      })}
    </div>
  )
})
