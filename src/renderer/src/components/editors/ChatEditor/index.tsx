import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useChat } from '../../../hooks/useChat'
import { streamingManager } from '../../../services/streamingManager'
import { toggleMessageCollapsed, setMessagesCollapsed } from '../../../services/messagesService'
import { MessageList, MessageListRef } from './MessageList'
import { InputArea, InputAreaRef } from './InputArea'
import { Header } from './Header'
import { BranchPathBar } from './BranchPathBar'
import './ChatEditor.css'

interface ChatEditorProps {
  pageId: string
}

export function ChatEditor({ pageId }: ChatEditorProps): React.JSX.Element {
  const {
    page,
    currentPath,
    sendMessage,
    stopStreaming,
    retryMessage,
    continueMessage,
    deleteMessage,
    editMessage,
    editAndResend,
    switchBranch,
    getChildMessages
  } = useChat({ pageId })

  // 订阅 streamingManager 以获取 isStreaming 状态
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    return streamingManager.subscribe(() => forceUpdate((n) => n + 1))
  }, [])

  // 检查当前对话是否有 streaming 消息
  const isStreaming = useMemo(() => {
    return currentPath.some((msg) => streamingManager.isStreaming(msg.id))
  }, [currentPath])

  const inputAreaRef = useRef<InputAreaRef>(null)
  const messageListRef = useRef<MessageListRef>(null)

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

  if (!page) {
    return <div className="chat-editor chat-editor--empty">页面不存在</div>
  }

  return (
    <div className="chat-editor">
      <Header page={page} onCollapseAll={handleCollapseAll} onExpandAll={handleExpandAll} />
      <BranchPathBar
        messages={currentPath}
        getChildMessages={getChildMessages}
        onSwitchBranch={switchBranch}
        onScrollToMessage={handleScrollToMessage}
        onScrollToPrev={handleScrollToPrev}
        onScrollToNext={handleScrollToNext}
      />
      <MessageList
        ref={messageListRef}
        pageId={pageId}
        messages={currentPath}
        isStreaming={isStreaming}
        onRetry={retryMessage}
        onContinue={continueMessage}
        onDelete={deleteMessage}
        onEdit={editMessage}
        onEditAndResend={editAndResend}
        onSwitchBranch={switchBranch}
        onQuote={handleQuote}
        getChildMessages={getChildMessages}
        onToggleCollapse={handleToggleCollapse}
        onCollapseAll={handleCollapseAll}
        onExpandAll={handleExpandAll}
      />
      <InputArea
        ref={inputAreaRef}
        pageId={pageId}
        onSend={sendMessage}
        onStop={stopStreaming}
        isStreaming={isStreaming}
        disabled={!page}
      />
    </div>
  )
}
