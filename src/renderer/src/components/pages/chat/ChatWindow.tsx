import React, { useState, useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import { usePagesStore } from '../../../stores/pagesStore'
import { useUIStore } from '../../../stores/uiStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useMessagesStore } from '../../../stores/messagesStore'
import ChatLogic from './ChatLogic'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import ChatInput, { ChatInputRef } from './ChatInput'
import Settings from '../../Settings'
import PageLineageDisplay from '../../common/PageLineageDisplay'
import MessageTreeSidebar from './MessageTreeSidebar'
import { MessageTree } from './messageTree'

interface ChatWindowProps {
  chatId: string
}

export interface ChatWindowRef {
  focus: () => void
}

const ChatWindow = forwardRef<ChatWindowRef, ChatWindowProps>(({ chatId }, ref) => {
  const { pages } = usePagesStore()
  const {
    collapsedMessages,
    allMessagesCollapsed,
    toggleMessageCollapse,
    collapseAllMessages,
    expandAllMessages
  } = useUIStore()
  const { settings } = useSettingsStore()
  const { updateCurrentPath } = useMessagesStore()
  const [inputValue, setInputValue] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [messageTreeCollapsed, setMessageTreeCollapsed] = useState(true)
  const [messageTreeWidth, setMessageTreeWidth] = useState(() => {
    const saved = localStorage.getItem('messageTreeWidth')
    return saved ? parseInt(saved, 10) : 300
  })
  const chatInputRef = useRef<ChatInputRef>(null)

  useImperativeHandle(ref, () => ({
    focus: () => {
      chatInputRef.current?.focus()
    }
  }))

  const chat = pages.find((c) => c.id === chatId)

  // 创建消息树实例
  const messageTree = useMemo(() => {
    if (!chat) return new MessageTree()
    return new MessageTree(chat.messages)
  }, [chat?.messages])

  // 处理分支切换（所有消息都使用兄弟分支切换）
  const handleSwitchBranch = (messageId: string, branchIndex: number) => {
    const newPath = messageTree.switchToSiblingBranch(messageId, branchIndex)
    updateCurrentPath(chatId, newPath)
  }

  const handleToggleMessageCollapse = (messageId: string) => {
    toggleMessageCollapse(chatId, messageId)
  }

  const handleCollapseAll = () => {
    collapseAllMessages(chatId, chat.messages.map((msg) => msg.id))
  }

  const handleExpandAll = () => {
    expandAllMessages(chatId)
  }

  const handleOpenSettings = () => {
    setSettingsOpen(true)
  }

  const handleToggleMessageTree = () => {
    setMessageTreeCollapsed(!messageTreeCollapsed)
  }

  const handleMessageTreeNodeSelect = (messageId: string) => {
    // 构建到选中消息的路径
    const path: string[] = []
    let currentMsg = chat?.messages.find((msg) => msg.id === messageId)

    while (currentMsg) {
      path.unshift(currentMsg.id)
      if (currentMsg.parentId) {
        currentMsg = chat?.messages.find((msg) => msg.id === currentMsg!.parentId)
      } else {
        break
      }
    }

    // 更新当前路径
    updateCurrentPath(chatId, path)
  }

  const handleMessageTreePathChange = (path: string[]) => {
    // 更新当前路径
    updateCurrentPath(chatId, path)
  }

  const handleMessageTreeWidthChange = (width: number) => {
    setMessageTreeWidth(width)
    localStorage.setItem('messageTreeWidth', width.toString())
  }

  if (!chat) {
    return <div className="chat-window-error">聊天不存在</div>
  }

  // 获取当前聊天的折叠状态
  const collapsedMessagesForChat = collapsedMessages[chatId] || []
  const allMessagesCollapsedForChat = allMessagesCollapsed[chatId] || false

  return (
    <div className="chat-window">
      {/* 页面溯源信息 */}
      <div
        style={{
          borderBottom: '1px solid #f0f0f0',
          backgroundColor: '#fafafa',
          padding: '8px 16px'
        }}
      >
        <PageLineageDisplay pageId={chatId} size="small" showInCard={false} />
      </div>

      <div className="chat-window-content">
        <ChatLogic chatId={chatId}>
          {({
            isLoading,
            selectedModel,
            onModelChange,
            onSendMessage,
            onStopGeneration,
            onRetryMessage,
            onEditMessage,
            onEditAndResendMessage,
            onToggleFavorite,
            onModelChangeForMessage
          }) => (
            <>
              {/* 消息树侧边栏 */}
              <MessageTreeSidebar
                messages={chat.messages || []}
                currentPath={chat.currentPath}
                onNodeSelect={handleMessageTreeNodeSelect}
                onPathChange={handleMessageTreePathChange}
                collapsed={messageTreeCollapsed}
                onToggleCollapse={handleToggleMessageTree}
                width={messageTreeWidth}
                onWidthChange={handleMessageTreeWidthChange}
              />

              {/* 聊天主内容区 */}
              <div className="chat-main-content">
                <ChatHeader
                  chatId={chatId}
                  chatTitle={chat.title}
                  messages={chat.messages}
                  currentPath={chat.currentPath}
                  allMessagesCollapsed={allMessagesCollapsed[chatId] || false}
                  onCollapseAll={handleCollapseAll}
                  onExpandAll={handleExpandAll}
                  messageTreeCollapsed={messageTreeCollapsed}
                  onToggleMessageTree={handleToggleMessageTree}
                />
                <MessageList
                  messages={chat.messages}
                  currentPath={chat.currentPath}
                  isLoading={isLoading}
                  streamingContent={chat.streamingMessage?.content}
                  streamingTimestamp={chat.streamingMessage?.timestamp}
                  llmConfigs={settings.llmConfigs || []}
                  onRetryMessage={onRetryMessage}
                  onEditMessage={onEditMessage}
                  onEditAndResendMessage={onEditAndResendMessage}
                  onToggleFavorite={onToggleFavorite}
                  onModelChange={onModelChangeForMessage}
                  onSwitchBranch={handleSwitchBranch}
                  // 折叠相关props
                  collapsedMessages={collapsedMessagesForChat}
                  onToggleMessageCollapse={handleToggleMessageCollapse}
                  // 设置相关props
                  onOpenSettings={handleOpenSettings}
                />
                <ChatInput
                  ref={chatInputRef}
                  value={inputValue}
                  onChange={setInputValue}
                  onSend={async () => {
                    if (inputValue.trim()) {
                      await onSendMessage(inputValue)
                      setInputValue('')
                    }
                  }}
                  onStop={onStopGeneration}
                  disabled={isLoading}
                  loading={isLoading}
                  llmConfigs={settings.llmConfigs || []}
                  selectedModel={selectedModel}
                  defaultModelId={settings.defaultLLMId}
                  onModelChange={onModelChange}
                  onOpenSettings={handleOpenSettings}
                />
              </div>
            </>
          )}
        </ChatLogic>
      </div>
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
})

export default ChatWindow
