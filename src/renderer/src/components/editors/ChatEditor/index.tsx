import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useChat } from '../../../hooks/useChat'
import { useMessageQueue } from '../../../hooks/useMessageQueue'
import { streamingManager } from '../../../services/streamingManager'
import { toggleMessageCollapsed, setMessagesCollapsed } from '../../../services/messagesService'
import { useChatUIStore } from '../../../stores/chatUIStore'
import { useMessagesStore } from '../../../stores/messagesStore'
import { useGlobalSearchHighlight } from '../../../hooks/useGlobalSearchHighlight'
import { MessageList, MessageListRef } from './MessageList'
import { InputArea, InputAreaRef } from './InputArea'
import { Header } from './Header'
import { BranchPathBar } from './BranchPathBar'
import { MessageQueueDrawer } from './MessageQueueDrawer'
import { SearchBar } from './SearchBar'
import './ChatEditor.css'

interface ChatEditorProps {
  pageId: string
}

export function ChatEditor({ pageId }: ChatEditorProps): React.JSX.Element {
  const {
    page,
    messages,
    currentPath,
    sendMessage,
    stopStreaming,
    retryMessage,
    continueMessage,
    deleteMessage,
    editMessage,
    editAndResend,
    switchBranch,
    getChildMessages,
    // Title/Topic 相关
    topics,
    topicGroups,
    outline,
    updateTitle,
    generateTitle,
    // Topic 操作（独立 Topic 实体）
    createTopic,
    updateTopic,
    deleteTopic,
    toggleTopicCollapse,
    generateTopic,
    // 批量操作
    batchGenerateTitles,
    batchProgress,
    smartSegmentation,
    isSegmenting
  } = useChat({ pageId })

  // 订阅 streamingManager 以获取 isStreaming 状态
  const [streamingVersion, forceUpdate] = useState(0)
  useEffect(() => {
    return streamingManager.subscribe(() => forceUpdate((n) => n + 1))
  }, [])

  // 检查当前对话是否有 streaming 消息
  const isStreaming = useMemo(() => {
    return currentPath.some((msg) => streamingManager.isStreaming(msg.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- streamingVersion 用于触发重新计算
  }, [currentPath, streamingVersion])

  // 消息队列
  const {
    items: queueItems,
    count: queueCount,
    isPaused,
    handleSend: queueHandleSend,
    handleStop: queueHandleStop,
    enqueue,
    remove: removeQueueItem,
    update: updateQueueItem,
    clear: clearQueue,
    resumeQueue
  } = useMessageQueue({
    pageId,
    isStreaming,
    onSendMessage: sendMessage
  })

  // Drawer 状态
  const [drawerOpen, setDrawerOpen] = useState(false)

  const inputAreaRef = useRef<InputAreaRef>(null)
  const messageListRef = useRef<MessageListRef>(null)
  const messageContainerRef = useRef<HTMLDivElement | null>(null)

  // 搜索状态
  const searchState = useChatUIStore((state) => state.getState(pageId).search)
  const setSearchOpen = useChatUIStore((state) => state.setSearchOpen)

  // 同步 messageContainerRef
  useEffect(() => {
    messageContainerRef.current = messageListRef.current?.getContainer() ?? null
  })

  // 键盘事件监听（Ctrl+F 打开搜索）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(pageId, true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pageId, setSearchOpen])

  // 监听 selectedMessageId 变化，滚动到目标消息（用于全局搜索跳转）
  const { cache } = useMessagesStore()
  const selectedMessageId = cache[pageId]?.selectedMessageId
  useEffect(() => {
    if (selectedMessageId) {
      // 延迟执行，确保消息列表已渲染
      setTimeout(() => {
        messageListRef.current?.scrollToMessage(selectedMessageId, true)
      }, 100)
    }
  }, [selectedMessageId])

  // 全局搜索高亮
  useGlobalSearchHighlight({
    containerRef: messageContainerRef,
    messages: currentPath,
    pageId
  })

  const handleQuote = useCallback((text: string) => {
    inputAreaRef.current?.appendText(`> ${text}\n\n`)
  }, [])

  const handleScrollToMessage = useCallback((messageId: string) => {
    messageListRef.current?.scrollToMessage(messageId)
  }, [])

  const handleScrollToPrev = useCallback(() => {
    messageListRef.current?.scrollToPrev()
  }, [])

  const handleScrollToNext = useCallback(() => {
    messageListRef.current?.scrollToNext()
  }, [])

  const handleToggleCollapse = useCallback(
    (messageId: string) => {
      toggleMessageCollapsed(pageId, messageId)
    },
    [pageId]
  )

  const handleCollapseAll = useCallback(() => {
    const nonStreamingIds = currentPath
      .filter((m) => !streamingManager.isStreaming(m.id))
      .map((m) => m.id)
    setMessagesCollapsed(pageId, nonStreamingIds, true)
  }, [pageId, currentPath])

  const handleExpandAll = useCallback(() => {
    const ids = currentPath.map((m) => m.id)
    setMessagesCollapsed(pageId, ids, false)
  }, [pageId, currentPath])

  // 停止 streaming 并暂停队列（先暂停队列，防止 streaming 停止后触发自动处理）
  const handleStopWithQueue = useCallback(async () => {
    await queueHandleStop()
    await stopStreaming()
  }, [stopStreaming, queueHandleStop])

  // 打开/关闭 Drawer
  const handleOpenDrawer = useCallback(() => {
    setDrawerOpen(true)
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false)
  }, [])

  if (!page) {
    return <div className="chat-editor chat-editor--empty">页面不存在</div>
  }

  return (
    <div className="chat-editor">
      <Header page={page} />
      <BranchPathBar
        messages={currentPath}
        getChildMessages={getChildMessages}
        onSwitchBranch={switchBranch}
        onScrollToMessage={handleScrollToMessage}
        onScrollToPrev={handleScrollToPrev}
        onScrollToNext={handleScrollToNext}
        onCollapseAll={handleCollapseAll}
        onExpandAll={handleExpandAll}
        outline={outline}
        currentMessageId={selectedMessageId}
        onToggleTopicCollapse={toggleTopicCollapse}
        onBatchGenerateTitles={batchGenerateTitles}
        batchProgress={batchProgress}
        onSmartSegmentation={smartSegmentation}
        isSegmenting={isSegmenting}
      />
      {searchState.isOpen && (
        <SearchBar pageId={pageId} messages={currentPath} containerRef={messageContainerRef} />
      )}
      <MessageList
        ref={messageListRef}
        pageId={pageId}
        messages={currentPath}
        allMessages={messages}
        isStreaming={isStreaming}
        onRetry={retryMessage}
        onContinue={continueMessage}
        onDelete={deleteMessage}
        onEdit={editMessage}
        onEditAndResend={editAndResend}
        onSwitchBranch={switchBranch}
        onQuote={handleQuote}
        onToggleCollapse={handleToggleCollapse}
        onCollapseAll={handleCollapseAll}
        onExpandAll={handleExpandAll}
        onUpdateTitle={updateTitle}
        onGenerateTitle={generateTitle}
        // Topic 相关
        topics={topics}
        topicGroups={topicGroups}
        onCreateTopic={createTopic}
        onUpdateTopic={updateTopic}
        onDeleteTopic={deleteTopic}
        onToggleTopicCollapse={toggleTopicCollapse}
        onGenerateTopic={generateTopic}
      />
      <InputArea
        ref={inputAreaRef}
        pageId={pageId}
        onSend={queueHandleSend}
        onStop={handleStopWithQueue}
        isStreaming={isStreaming}
        disabled={!page}
        queueCount={queueCount}
        isPaused={isPaused}
        onQueueButtonClick={handleOpenDrawer}
        onResumeQueue={resumeQueue}
      />
      <MessageQueueDrawer
        open={drawerOpen}
        items={queueItems}
        onClose={handleCloseDrawer}
        onAdd={enqueue}
        onRemove={removeQueueItem}
        onUpdate={updateQueueItem}
        onClear={clearQueue}
      />
    </div>
  )
}
