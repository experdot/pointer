import React, { useState, useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import { useAppContext } from '../../store/AppContext'
import ChatLogic from './ChatLogic'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import ChatInput, { ChatInputRef } from './ChatInput'
import Settings from '../Settings'
import { MessageTree } from '../../utils/messageTree'

interface ChatWindowProps {
  chatId: string
}

export interface ChatWindowRef {
  focus: () => void
}

const ChatWindow = forwardRef<ChatWindowRef, ChatWindowProps>(({ chatId }, ref) => {
  const { state, dispatch } = useAppContext()
  const [inputValue, setInputValue] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const chatInputRef = useRef<ChatInputRef>(null)

  useImperativeHandle(ref, () => ({
    focus: () => {
      chatInputRef.current?.focus()
    }
  }))

  const chat = state.chats.find((c) => c.id === chatId)

  // 创建消息树实例
  const messageTree = useMemo(() => {
    if (!chat) return new MessageTree()
    return new MessageTree(chat.messages)
  }, [chat?.messages])

  // 处理分支切换（所有消息都使用兄弟分支切换）
  const handleSwitchBranch = (messageId: string, branchIndex: number) => {
    const newPath = messageTree.switchToSiblingBranch(messageId, branchIndex)
    dispatch({
      type: 'UPDATE_CURRENT_PATH',
      payload: { chatId, path: newPath }
    })
  }

  // 处理消息折叠
  const handleToggleMessageCollapse = (messageId: string) => {
    dispatch({
      type: 'TOGGLE_MESSAGE_COLLAPSE',
      payload: { chatId, messageId }
    })
  }

  // 处理全部折叠
  const handleCollapseAll = () => {
    dispatch({
      type: 'COLLAPSE_ALL_MESSAGES',
      payload: { chatId }
    })
  }

  // 处理全部展开
  const handleExpandAll = () => {
    dispatch({
      type: 'EXPAND_ALL_MESSAGES',
      payload: { chatId }
    })
  }

  // 处理打开设置
  const handleOpenSettings = () => {
    setSettingsOpen(true)
  }

  if (!chat) {
    return <div className="chat-window-error">聊天不存在</div>
  }

  // 获取当前聊天的折叠状态
  const collapsedMessages = state.collapsedMessages[chatId] || []
  const allMessagesCollapsed = state.allMessagesCollapsed[chatId] || false

  return (
    <div className="chat-window">
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
            <ChatHeader
              chatId={chatId}
              chatTitle={chat.title}
              messages={chat.messages}
              currentPath={chat.currentPath}
              allMessagesCollapsed={allMessagesCollapsed}
              onCollapseAll={handleCollapseAll}
              onExpandAll={handleExpandAll}
            />
            <MessageList
              messages={chat.messages}
              currentPath={chat.currentPath}
              isLoading={isLoading}
              streamingContent={chat.streamingMessage?.content}
              streamingTimestamp={chat.streamingMessage?.timestamp}
              llmConfigs={state.settings.llmConfigs || []}
              onRetryMessage={onRetryMessage}
              onEditMessage={onEditMessage}
              onEditAndResendMessage={onEditAndResendMessage}
              onToggleFavorite={onToggleFavorite}
              onModelChange={onModelChangeForMessage}
              onSwitchBranch={handleSwitchBranch}
              // 折叠相关props
              collapsedMessages={collapsedMessages}
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
              llmConfigs={state.settings.llmConfigs || []}
              selectedModel={selectedModel}
              defaultModelId={state.settings.defaultLLMId}
              onModelChange={onModelChange}
              onOpenSettings={handleOpenSettings}
            />
          </>
        )}
      </ChatLogic>
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
})

ChatWindow.displayName = 'ChatWindow'

export default ChatWindow
