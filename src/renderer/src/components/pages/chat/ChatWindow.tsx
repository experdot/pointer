import React, {
  useState,
  useMemo,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback
} from 'react'
import { usePagesStore } from '../../../stores/pagesStore'
import { useTabsStore } from '../../../stores/tabsStore'
import { useUIStore } from '../../../stores/uiStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useMessagesStore } from '../../../stores/messagesStore'
import ChatLogic from './ChatLogic'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import ChatInput, { ChatInputRef } from './ChatInput'
import PageLineageDisplay from '../../common/PageLineageDisplay'
import MessageTreeSidebar from './MessageTreeSidebar'
import { MessageTree } from './messageTree'
import { ChatMessage } from '../../../types/type'

interface ChatWindowProps {
  chatId: string
}

export interface ChatWindowRef {
  focus: () => void
}

const ChatWindow = forwardRef<ChatWindowRef, ChatWindowProps>(({ chatId }, ref) => {
  const { pages, createAndOpenSettingsPage } = usePagesStore()
  const { setActiveTab } = useTabsStore()
  const {
    collapsedMessages,
    allMessagesCollapsed,
    toggleMessageCollapse,
    collapseAllMessages,
    collapseAIMessages,
    expandAllMessages
  } = useUIStore()
  const { settings } = useSettingsStore()
  const { updateCurrentPath } = useMessagesStore()
  const [inputValue, setInputValue] = useState('')
  const [messageTreeCollapsed, setMessageTreeCollapsed] = useState(true)
  const [messageTreeWidth, setMessageTreeWidth] = useState(() => {
    const saved = localStorage.getItem('messageTreeWidth')
    return saved ? parseInt(saved, 10) : 300
  })
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  // 自动提问相关状态
  const [autoQuestionEnabled, setAutoQuestionEnabled] = useState(false)
  const [autoQuestionMode, setAutoQuestionMode] = useState<'ai' | 'preset'>('ai')
  const [autoQuestionListId, setAutoQuestionListId] = useState<string | undefined>(() => {
    // 确保有可用的提示词列表时才设置默认值
    const lists = settings.promptLists || []
    return lists.length > 0 ? settings.defaultPromptListId || lists[0].id : undefined
  })
  const chatInputRef = useRef<ChatInputRef>(null)

  useImperativeHandle(ref, () => ({
    focus: () => {
      chatInputRef.current?.focus()
    }
  }))

  const chat = pages.find((c) => c.id === chatId)

  // 初始化时设置selectedMessageId
  React.useEffect(() => {
    if (chat?.selectedMessageId) {
      setSelectedMessageId(chat.selectedMessageId)
      // 清除selectedMessageId，避免重复滚动
      setTimeout(() => {
        const { updatePage } = usePagesStore.getState()
        updatePage(chatId, { selectedMessageId: undefined })
      }, 1000)
    }
  }, [chat?.selectedMessageId, chatId])

  // 创建消息树实例
  const messageTree = useMemo(() => {
    if (!chat) return new MessageTree()
    return new MessageTree(chat.messages)
  }, [chat?.messages])

  // 处理分支切换（所有消息都使用兄弟分支切换）
  const handleSwitchBranch = useCallback(
    (messageId: string, branchIndex: number) => {
      const newPath = messageTree.switchToSiblingBranch(messageId, branchIndex)
      updateCurrentPath(chatId, newPath)
    },
    [messageTree, updateCurrentPath, chatId]
  )

  const handleToggleMessageCollapse = useCallback(
    (messageId: string) => {
      toggleMessageCollapse(chatId, messageId)
    },
    [toggleMessageCollapse, chatId]
  )

  const handleCollapseAll = useCallback(() => {
    collapseAllMessages(
      chatId,
      chat.messages.map((msg) => msg.id)
    )
  }, [collapseAllMessages, chatId, chat?.messages])

  const handleExpandAll = useCallback(() => {
    expandAllMessages(chatId)
  }, [expandAllMessages, chatId])

  const handleCollapseAI = useCallback(() => {
    // 筛选出所有AI消息的ID
    const aiMessageIds = chat.messages
      .filter((msg) => msg.role === 'assistant')
      .map((msg) => msg.id)
    collapseAIMessages(chatId, aiMessageIds)
  }, [collapseAIMessages, chatId, chat?.messages])

  const handleQuote = useCallback((text: string) => {
    // 将引用的文本插入到输入框中
    chatInputRef.current?.insertQuote(text)
  }, [])

  const handleCreateNewChat = useCallback((text: string) => {
    // 生成对话标题（取前30个字符）
    const title = text.length > 30 ? text.substring(0, 30) + '...' : text

    // 创建新对话并打开
    const { createChatWithInitialMessage } = usePagesStore.getState()
    const newChatId = createChatWithInitialMessage(title, text, chat?.folderId, chatId)

    // 切换到新创建的对话
    setActiveTab(newChatId)
  }, [chat?.folderId, chatId, setActiveTab])

  const handleOpenSettings = useCallback(() => {
    const settingsPageId = createAndOpenSettingsPage('llm') // 从聊天窗口点击设置通常是想配置模型
    setActiveTab(settingsPageId)
  }, [createAndOpenSettingsPage, setActiveTab])

  const handleToggleMessageTree = useCallback(() => {
    setMessageTreeCollapsed(!messageTreeCollapsed)
  }, [messageTreeCollapsed])

  const handleMessageTreeNodeSelect = useCallback(
    (messageId: string) => {
      if (!chat?.messages) return

      // 设置选中的消息ID，用于滚动
      setSelectedMessageId(messageId)

      const messageMap = new Map<string, ChatMessage>()
      chat.messages.forEach((msg) => {
        messageMap.set(msg.id, msg)
      })

      // 构建从根节点到选中节点的路径
      const pathToSelected: string[] = []
      let currentMsg = messageMap.get(messageId)
      while (currentMsg) {
        pathToSelected.unshift(currentMsg.id)
        if (currentMsg.parentId) {
          currentMsg = messageMap.get(currentMsg.parentId)
        } else {
          break
        }
      }

      // 如果选中的节点在当前路径中，需要保持到叶子节点的完整路径
      if (chat.currentPath && chat.currentPath.includes(messageId)) {
        // 找到选中节点在当前路径中的位置
        const selectedIndex = chat.currentPath.findIndex((id) => id === messageId)
        if (selectedIndex !== -1) {
          // 从根节点到选中节点的路径 + 选中节点之后的原路径
          const afterSelected = chat.currentPath.slice(selectedIndex + 1)
          const newPath = [...pathToSelected, ...afterSelected]
          updateCurrentPath(chatId, newPath)
          return
        }
      }

      // 如果不在当前路径中，则需要延续到第一个子节点的路径
      let extendedPath = [...pathToSelected]
      let lastNode = messageMap.get(messageId)

      // 如果该节点有子节点，默认选择第一个子节点并延续路径
      while (lastNode && lastNode.children && lastNode.children.length > 0) {
        const firstChild = messageMap.get(lastNode.children[0])
        if (firstChild) {
          extendedPath.push(firstChild.id)
          lastNode = firstChild
        } else {
          break
        }
      }

      // 更新当前路径
      updateCurrentPath(chatId, extendedPath)
    },
    [chat?.messages, chat?.currentPath, updateCurrentPath, chatId]
  )

  const handleMessageTreePathChange = useCallback(
    (path: string[]) => {
      // 更新当前路径
      updateCurrentPath(chatId, path)
    },
    [updateCurrentPath, chatId]
  )

  const handleMessageTreeWidthChange = useCallback((width: number) => {
    setMessageTreeWidth(width)
    localStorage.setItem('messageTreeWidth', width.toString())
  }, [])

  const handleAutoQuestionChange = useCallback(
    (enabled: boolean, mode: 'ai' | 'preset', listId?: string) => {
      console.log('ChatWindow handleAutoQuestionChange:', {
        enabled,
        mode,
        listId,
        currentEnabled: autoQuestionEnabled,
        currentMode: autoQuestionMode,
        currentListId: autoQuestionListId
      })

      setAutoQuestionEnabled(enabled)
      setAutoQuestionMode(mode)
      if (listId) {
        setAutoQuestionListId(listId)
      } else if (mode === 'preset' && !listId && settings.promptLists?.length > 0) {
        // 如果选择预设模式但没有指定listId，使用默认的
        const defaultListId = settings.defaultPromptListId || settings.promptLists[0].id
        setAutoQuestionListId(defaultListId)
        console.log('ChatWindow 自动设置 defaultListId:', defaultListId)
      }
    },
    [settings.promptLists, settings.defaultPromptListId]
  )

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
        <ChatLogic
          chatId={chatId}
          autoQuestionEnabled={autoQuestionEnabled}
          autoQuestionMode={autoQuestionMode}
          autoQuestionListId={autoQuestionListId}
        >
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
            onModelChangeForMessage,
            onDeleteMessage,
            onTriggerFollowUpQuestion
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
              <div
                className="chat-content"
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
              >
                <ChatHeader
                  chatId={chatId}
                  chatTitle={chat.title}
                  messages={chat.messages}
                  currentPath={chat.currentPath}
                  allMessagesCollapsed={allMessagesCollapsed[chatId] || false}
                  onCollapseAll={handleCollapseAll}
                  onExpandAll={handleExpandAll}
                  onCollapseAI={handleCollapseAI}
                  messageTreeCollapsed={messageTreeCollapsed}
                  onToggleMessageTree={handleToggleMessageTree}
                  llmConfigs={settings.llmConfigs}
                  chat={chat}
                />
                <MessageList
                  chatId={chatId}
                  messages={chat.messages}
                  currentPath={chat.currentPath}
                  isLoading={isLoading}
                  streamingContent={chat.streamingMessage?.content}
                  streamingTimestamp={chat.streamingMessage?.timestamp}
                  llmConfigs={settings.llmConfigs || []}
                  selectedMessageId={selectedMessageId}
                  onRetryMessage={onRetryMessage}
                  onEditMessage={onEditMessage}
                  onEditAndResendMessage={onEditAndResendMessage}
                  onToggleFavorite={onToggleFavorite}
                  onModelChange={onModelChangeForMessage}
                  onDeleteMessage={onDeleteMessage}
                  onSwitchBranch={handleSwitchBranch}
                  // 引用相关props
                  onQuote={handleQuote}
                  onCreateNewChat={handleCreateNewChat}
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
                  onSend={useCallback(async () => {
                    if (inputValue.trim()) {
                      setInputValue('') // 立即清空输入框
                      await onSendMessage(inputValue, selectedModel)
                      // 在下一个tick中聚焦，确保界面更新完成
                      setTimeout(() => {
                        chatInputRef.current?.focus()
                      }, 0)
                    }
                  }, [inputValue, onSendMessage, selectedModel])}
                  onStop={onStopGeneration}
                  disabled={isLoading}
                  loading={isLoading}
                  llmConfigs={settings.llmConfigs || []}
                  selectedModel={selectedModel}
                  defaultModelId={settings.defaultLLMId}
                  onModelChange={onModelChange}
                  onOpenSettings={handleOpenSettings}
                  // 自动提问相关props
                  autoQuestionEnabled={autoQuestionEnabled}
                  autoQuestionMode={autoQuestionMode}
                  autoQuestionListId={autoQuestionListId}
                  onAutoQuestionChange={handleAutoQuestionChange}
                  onTriggerFollowUpQuestion={onTriggerFollowUpQuestion}
                />
              </div>
            </>
          )}
        </ChatLogic>
      </div>
    </div>
  )
})

export default ChatWindow
