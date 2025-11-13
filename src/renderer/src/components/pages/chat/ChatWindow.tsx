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
import { useFavoritesStore } from '../../../stores/favoritesStore'
import { App, Drawer } from 'antd'
import ChatLogic from './ChatLogic'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import ChatInput, { ChatInputRef } from './ChatInput'
import PageLineageDisplay from '../../common/PageLineageDisplay'
import MessageTreeSidebar from './MessageTreeSidebar'
import MessageQueuePanel from './MessageQueuePanel'
import { MessageTree } from './messageTree'
import { ChatMessage, FileAttachment } from '../../../types/type'
import { useMessageQueue } from './useMessageQueue'

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
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [messageTreeCollapsed, setMessageTreeCollapsed] = useState(true)
  const [messageTreeWidth, setMessageTreeWidth] = useState(() => {
    const saved = localStorage.getItem('messageTreeWidth')
    return saved ? parseInt(saved, 10) : 300
  })
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [visibleMessageId, setVisibleMessageId] = useState<string | null>(null)
  const [scrollTriggeredSelection, setScrollTriggeredSelection] = useState(false)
  const isUserNavigatingRef = useRef(false)
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // 队列面板状态
  const [queuePanelVisible, setQueuePanelVisible] = useState(false)
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

  const handleCreateNewChat = useCallback(
    (text: string) => {
      // 生成对话标题（取前30个字符）
      const title = text.length > 30 ? text.substring(0, 30) + '...' : text

      // 创建新对话并打开
      const { createChatWithInitialMessage } = usePagesStore.getState()
      const newChatId = createChatWithInitialMessage(title, text, chat?.folderId, chatId)

      // 切换到新创建的对话
      setActiveTab(newChatId)
    },
    [chat?.folderId, chatId, setActiveTab]
  )

  const handleOpenSettings = useCallback(() => {
    const settingsPageId = createAndOpenSettingsPage('llm') // 从聊天窗口点击设置通常是想配置模型
    setActiveTab(settingsPageId)
  }, [createAndOpenSettingsPage, setActiveTab])

  const handleToggleMessageTree = useCallback(() => {
    setMessageTreeCollapsed(!messageTreeCollapsed)
  }, [messageTreeCollapsed])

  const { modal } = App.useApp()
  const { favoriteMessage, favoriteTextFragment, createFolder, folders } = useFavoritesStore()

  const handleAddToFavorites = useCallback(
    async (messageId: string) => {
      try {
        // 可以添加一个对话框让用户选择文件夹
        // 这里先实现简单版本，直接收藏到根目录
        const favoriteId = favoriteMessage(chatId, messageId, true, undefined, undefined)
        modal.success({
          title: '添加成功',
          content: '消息已添加到收藏夹',
          okText: '确定'
        })
      } catch (error) {
        console.error('添加收藏失败:', error)
        modal.error({
          title: '添加失败',
          content: '添加到收藏夹失败，请重试',
          okText: '确定'
        })
      }
    },
    [chatId, favoriteMessage, modal]
  )

  const handleFavoriteTextFragment = useCallback(
    async (messageId: string, text: string) => {
      try {
        const favoriteId = favoriteTextFragment(chatId, messageId, text, undefined, undefined)
        modal.success({
          title: '添加成功',
          content: '文本片段已添加到收藏夹',
          okText: '确定'
        })
      } catch (error) {
        console.error('添加收藏失败:', error)
        modal.error({
          title: '添加失败',
          content: '添加到收藏夹失败，请重试',
          okText: '确定'
        })
      }
    },
    [chatId, favoriteTextFragment, modal]
  )

  const handleMessageTreeNodeSelect = useCallback(
    (messageId: string) => {
      if (!chat?.messages) return

      // 标记用户正在主动导航
      isUserNavigatingRef.current = true

      // 清除之前的超时
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current)
      }

      // 2秒后恢复滚动监听
      navigationTimeoutRef.current = setTimeout(() => {
        isUserNavigatingRef.current = false
      }, 2000)

      // 设置选中的消息ID，用于滚动
      setSelectedMessageId(messageId)
      // 标记这是用户手动选择，而非滚动触发
      setScrollTriggeredSelection(false)

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

  // 处理消息列表中可见消息变化
  const handleVisibleMessageChange = useCallback((messageId: string | null) => {
    if (!messageId) return

    // 如果用户正在主动导航，忽略滚动触发的选择
    if (isUserNavigatingRef.current) {
      return
    }

    // 更新可见的消息ID
    setVisibleMessageId(messageId)
    // 标记这是由滚动触发的选择
    setScrollTriggeredSelection(true)
  }, [])

  // 组件卸载时清理定时器
  React.useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current)
      }
    }
  }, [])

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

  // 自动提问功能已移除，相关功能已整合到消息队列中

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
            onContinueMessage,
            onEditMessage,
            onEditAndResendMessage,
            onToggleStar,
            onModelChangeForMessage,
            onDeleteMessage,
            getLLMConfig
          }) => {
            // 在这里初始化消息队列
            const messageQueue = useMessageQueue({
              chatId,
              onProcessMessage: onSendMessage,
              isLoading,
              selectedModel,
              getLLMConfig
            })

            const handleToggleQueuePanel = useCallback(() => {
              setQueuePanelVisible((prev) => !prev)
            }, [])

            const handleStopWithQueue = useCallback(() => {
              // 先调用原始的停止方法
              onStopGeneration()
              // 如果队列中有正在处理的项，标记为失败
              messageQueue.handleStop()
            }, [onStopGeneration, messageQueue])

            return (
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
                  scrollTriggeredMessageId={scrollTriggeredSelection ? visibleMessageId : null}
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
                    onContinueMessage={onContinueMessage}
                    onEditMessage={onEditMessage}
                    onEditAndResendMessage={onEditAndResendMessage}
                    onToggleStar={onToggleStar}
                    onAddToFavorites={handleAddToFavorites}
                    onFavoriteTextFragment={handleFavoriteTextFragment}
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
                    // 可见消息变化回调
                    onVisibleMessageChange={handleVisibleMessageChange}
                  />
                  <ChatInput
                    ref={chatInputRef}
                    value={inputValue}
                    onChange={setInputValue}
                    onSend={useCallback(async () => {
                      if (inputValue.trim() || attachments.length > 0) {
                        // 判断是否应该加入队列：队列已启用且（AI正在回答或队列中有待处理消息）
                        const shouldAddToQueue =
                          messageQueue.config.enabled &&
                          (isLoading || messageQueue.getQueueStats().pending > 0)

                        const messageContent = inputValue.trim()
                        const messageAttachments = [...attachments]

                        setInputValue('') // 立即清空输入框
                        setAttachments([]) // 立即清空附件

                        if (shouldAddToQueue) {
                          // 添加到队列，包含附件
                          messageQueue.addToQueue(messageContent, selectedModel, {
                            autoResume: true,
                            attachments:
                              messageAttachments.length > 0 ? messageAttachments : undefined
                          })
                        } else {
                          // 发送消息，如果有附件则传递附件参数
                          await onSendMessage(
                            messageContent || '请分析这张图片',
                            selectedModel,
                            undefined,
                            messageAttachments.length > 0 ? messageAttachments : undefined
                          )
                        }

                        // 在下一个tick中聚焦，确保界面更新完成
                        setTimeout(() => {
                          chatInputRef.current?.focus()
                        }, 0)
                      }
                    }, [
                      inputValue,
                      attachments,
                      onSendMessage,
                      selectedModel,
                      isLoading,
                      messageQueue,
                      chat,
                      chatId,
                      settings
                    ])}
                    onStop={handleStopWithQueue}
                    disabled={isLoading}
                    loading={isLoading}
                    llmConfigs={settings.llmConfigs || []}
                    selectedModel={selectedModel}
                    defaultModelId={settings.defaultLLMId}
                    onModelChange={onModelChange}
                    onOpenSettings={handleOpenSettings}
                    // 消息队列相关props
                    queueEnabled={messageQueue.config.enabled}
                    queuePendingCount={messageQueue.getQueueStats().pending}
                    queuePaused={messageQueue.config.paused}
                    queueAutoProcess={messageQueue.config.autoProcess}
                    onToggleQueuePanel={handleToggleQueuePanel}
                    onResumeQueue={messageQueue.resumeQueue}
                    // 文件附件相关props
                    attachments={attachments}
                    onAttachmentsChange={setAttachments}
                  />

                  {/* 消息队列面板 */}
                  <Drawer
                    title="消息队列"
                    placement="right"
                    open={queuePanelVisible}
                    onClose={() => setQueuePanelVisible(false)}
                    width={400}
                    destroyOnClose={false}
                  >
                    <MessageQueuePanel
                      queue={messageQueue.queue}
                      config={messageQueue.config}
                      currentlyProcessing={messageQueue.currentlyProcessing}
                      selectedModel={selectedModel}
                      onAddToQueue={messageQueue.addToQueue}
                      onRemoveFromQueue={messageQueue.removeFromQueue}
                      onEditQueueItem={messageQueue.editQueueItem}
                      onClearQueue={messageQueue.clearQueue}
                      onClearCompletedItems={messageQueue.clearCompletedItems}
                      onRetryQueueItem={messageQueue.retryQueueItem}
                      onProcessNext={messageQueue.processNextInQueue}
                      onUpdateConfig={messageQueue.updateConfig}
                      onReorderQueue={messageQueue.reorderQueue}
                      onGenerateAIQuestion={messageQueue.generateAIQuestion}
                      onImportPromptList={messageQueue.importPromptList}
                    />
                  </Drawer>
                </div>
              </>
            )
          }}
        </ChatLogic>
      </div>
    </div>
  )
})

export default ChatWindow
