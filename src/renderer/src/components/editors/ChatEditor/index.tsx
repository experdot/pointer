import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { App } from 'antd'
import { useChat } from '../../../hooks/useChat'
import { useMessageQueue } from '../../../hooks/useMessageQueue'
import { toggleMessageCollapsed, setMessagesCollapsed } from '../../../services/messagesService'
import * as navigationService from '../../../services/navigationService'
import { generateSessionTitleWithOptions } from '../../../services/titleService'
import { useMessagesStore } from '../../../stores/messagesStore'
import { useChatUIStore } from '../../../stores/chatUIStore'
import { useNavigationStore } from '../../../stores/navigationStore'
import { useGlobalSearchHighlight } from '../../../hooks/useGlobalSearchHighlight'
import { useChatShortcuts } from '../../../hooks/useChatShortcuts'
import { useTabsStore } from '../../../stores/tabsStore'
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
  const { message: notify } = App.useApp()
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
    hasLLMConfig,
    hasDefaultLLM,
    // Title/Topic 相关
    topics,
    topicGroups,
    outline,
    updateTitle,
    deleteTitle,
    // Topic 操作（独立 Topic 实体）
    createTopic,
    updateTopic,
    deleteTopic,
    toggleTopicCollapse,
    // 批量操作进度
    batchProgress,
    isSegmenting,
    // 带选项的生成方法
    generateTitleWithOptions,
    generateTopicWithOptions,
    batchGenerateTitlesWithOptions,
    smartSegmentationWithOptions
  } = useChat({ pageId })

  // 流式状态来自内核镜像
  const streamingMap = useMessagesStore((state) => state.streaming)
  const isStreaming = useMemo(
    () => currentPath.some((message) => Boolean(streamingMap[message.id])),
    [currentPath, streamingMap]
  )

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
  const setSearchQuery = useChatUIStore((state) => state.setSearchQuery)
  const requestSearchFocus = useChatUIStore((state) => state.requestSearchFocus)
  const isActiveTab = useTabsStore((state) =>
    state.tabs.some(
      (tab) => tab.type === 'chat' && tab.dataId === pageId && tab.id === state.activeTabId
    )
  )

  // 同步 messageContainerRef
  useEffect(() => {
    messageContainerRef.current = messageListRef.current?.getContainer() ?? null
  })

  // 监听导航请求，执行滚动
  const pendingNavigation = useNavigationStore((s) => s.pendingNavigation)
  const pendingRelativeNavigation = useNavigationStore((s) => s.pendingRelativeNavigation)
  const clearNavigation = useNavigationStore((s) => s.clearNavigation)
  const clearRelativeNavigation = useNavigationStore((s) => s.clearRelativeNavigation)

  // 处理绝对导航请求
  useEffect(() => {
    if (!pendingNavigation || pendingNavigation.pageId !== pageId) {
      return
    }
    const { version, messageId, instant } = pendingNavigation
    // 延迟执行，确保 Topic 展开后 DOM 已更新
    const timer = setTimeout(() => {
      messageListRef.current?.scrollToMessage(messageId, instant)
      clearNavigation(version)
    }, 50)
    return () => clearTimeout(timer)
  }, [pendingNavigation, pageId, clearNavigation])

  // 处理相对导航请求（上一条/下一条）
  useEffect(() => {
    if (!pendingRelativeNavigation || pendingRelativeNavigation.pageId !== pageId) {
      return
    }
    const { version, direction } = pendingRelativeNavigation
    const timer = setTimeout(() => {
      if (direction === 'prev') {
        messageListRef.current?.scrollToPrev()
      } else {
        messageListRef.current?.scrollToNext()
      }
      clearRelativeNavigation(version)
    }, 0)
    return () => clearTimeout(timer)
  }, [pendingRelativeNavigation, pageId, clearRelativeNavigation])

  // 全局搜索高亮
  useGlobalSearchHighlight({
    containerRef: messageContainerRef,
    messages: currentPath,
    pageId
  })

  const handleQuote = useCallback((text: string) => {
    inputAreaRef.current?.appendText(`> ${text}\n\n`)
  }, [])

  const handleNavigateToMessage = useCallback(
    (messageId: string) => {
      navigationService.navigateToMessage({ pageId, messageId, instant: false })
    },
    [pageId]
  )

  const handleNavigateToPrev = useCallback(() => {
    navigationService.requestScrollToPrev(pageId)
  }, [pageId])

  const handleNavigateToNext = useCallback(() => {
    navigationService.requestScrollToNext(pageId)
  }, [pageId])

  const handleScrollToFirst = useCallback(() => {
    messageListRef.current?.scrollToFirst()
  }, [])

  const handleScrollToLast = useCallback(() => {
    messageListRef.current?.scrollToLast()
  }, [])

  const handleToggleCollapse = useCallback(
    (messageId: string) => {
      toggleMessageCollapsed(pageId, messageId)
    },
    [pageId]
  )

  const handleCollapseAll = useCallback(() => {
    const nonStreamingIds = currentPath.filter((m) => !streamingMap[m.id]).map((m) => m.id)
    setMessagesCollapsed(pageId, nonStreamingIds, true)
  }, [pageId, currentPath, streamingMap])

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

  useChatShortcuts({
    enabled: isActiveTab,
    navigationEnabled: isActiveTab && !isStreaming,
    onOpenSearch: (selectedText) => {
      if (selectedText) {
        setSearchQuery(pageId, selectedText)
      }
      setSearchOpen(pageId, true)
      requestSearchFocus(pageId)
    },
    onScrollToPrev: handleNavigateToPrev,
    onScrollToNext: handleNavigateToNext,
    onScrollToFirst: handleScrollToFirst,
    onScrollToLast: handleScrollToLast
  })

  if (!page) {
    return <div className="chat-editor chat-editor--empty">页面不存在</div>
  }

  return (
    <div className="chat-editor">
      <Header
        page={page}
        onGenerate={async (options) => {
          const result = await generateSessionTitleWithOptions(page.id, options)
          if (!result.success) {
            console.error('生成会话标题失败：', result.error)
            notify.error(`生成会话标题失败：${result.error ?? '未知原因'}`)
          }
        }}
      />
      <BranchPathBar
        messages={currentPath}
        getChildMessages={getChildMessages}
        onSwitchBranch={switchBranch}
        onNavigateToMessage={handleNavigateToMessage}
        onNavigateToPrev={handleNavigateToPrev}
        onNavigateToNext={handleNavigateToNext}
        onCollapseAll={handleCollapseAll}
        onExpandAll={handleExpandAll}
        outline={outline}
        onBatchGenerateTitles={batchGenerateTitlesWithOptions}
        onSmartSegment={smartSegmentationWithOptions}
        batchProgress={batchProgress}
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
        onDeleteTitle={deleteTitle}
        onGenerateTitle={generateTitleWithOptions}
        onGenerateTopic={generateTopicWithOptions}
        // Topic 相关
        topics={topics}
        topicGroups={topicGroups}
        onCreateTopic={createTopic}
        onUpdateTopic={updateTopic}
        onDeleteTopic={deleteTopic}
        onToggleTopicCollapse={toggleTopicCollapse}
      />
      <InputArea
        ref={inputAreaRef}
        pageId={pageId}
        onSend={queueHandleSend}
        onStop={handleStopWithQueue}
        isStreaming={isStreaming}
        disabled={!page}
        hasLLMConfig={hasLLMConfig}
        hasDefaultLLM={hasDefaultLLM}
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
