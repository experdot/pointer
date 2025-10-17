import { useCallback } from 'react'
import { App } from 'antd'
import { v4 as uuidv4 } from 'uuid'
import { usePagesStore } from '../../../../stores/pagesStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useMessagesStore } from '../../../../stores/messagesStore'
import { ChatMessage, FileAttachment } from '../../../../types/type'
import { MessageTree } from '../messageTree'
import { UseAIServiceReturn } from './useAIService'

export interface UseMessageOperationsProps {
  chatId: string
  chat: any
  aiService: UseAIServiceReturn
  messageTree: MessageTree
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  selectedModel?: string
}

export interface UseMessageOperationsReturn {
  handleSendMessage: (
    content: string,
    customModelId?: string,
    customParentId?: string,
    attachments?: FileAttachment[]
  ) => Promise<void>
  handleRetryMessage: (messageId: string) => Promise<void>
  handleContinueMessage: (messageId: string) => Promise<void>
  handleEditMessage: (messageId: string, newContent: string) => Promise<void>
  handleEditAndResendMessage: (messageId: string, newContent: string, newAttachments?: FileAttachment[]) => Promise<void>
  handleToggleBookmark: (messageId: string) => void
  handleModelChangeForMessage: (messageId: string, newModelId: string) => Promise<void>
  handleDeleteMessage: (messageId: string) => Promise<void>
}

export function useMessageOperations({
  chatId,
  chat,
  aiService,
  messageTree,
  isLoading,
  setIsLoading,
  selectedModel
}: UseMessageOperationsProps): UseMessageOperationsReturn {
  const { addMessageToParent, toggleMessageBookmark, deleteMessageAndChildren } = useMessagesStore()
  const { settings } = useSettingsStore()
  const { message, modal } = App.useApp()

  const handleSendMessage = useCallback(
    async (content: string, customModelId?: string, customParentId?: string, attachments?: FileAttachment[]) => {
      // 允许空内容但有附件的情况
      if (!content.trim() && (!attachments || attachments.length === 0)) return
      if (isLoading) return

      const llmConfig = aiService.getLLMConfig(customModelId)
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
        attachments: attachments
      }

      // Get current messages before adding the new one
      const currentMessages = chat?.messages || []

      // 获取父消息ID：优先使用传入的customParentId，否则从当前路径获取
      let parentId: string | undefined
      if (customParentId !== undefined) {
        parentId = customParentId
      } else {
        const currentPath = chat?.currentPath || messageTree.getCurrentPath()
        parentId = currentPath.length > 0 ? currentPath[currentPath.length - 1] : undefined
      }

      // Add user message with parent relationship
      const userMessageWithParent = {
        ...userMessage,
        parentId: parentId || null
      }

      addMessageToParent(chatId, userMessageWithParent, parentId)

      // Update chat title if it's the first message
      if (chat && currentMessages.length === 0) {
        const title = content.trim().slice(0, 50) + (content.trim().length > 50 ? '...' : '')
        const { updatePage } = usePagesStore.getState()
        updatePage(chatId, { title })
      }

      setIsLoading(true)

      try {
        // 获取当前分支路径上的消息，而不是全部消息
        const currentPath = chat?.currentPath || messageTree.getCurrentPath()
        const currentPathMessages = currentPath
          .map((id: string) => chat.messages.find((msg: any) => msg.id === id))
          .filter(Boolean) as ChatMessage[]

        // 构建要发送给AI的消息历史（当前分支 + 新用户消息）
        const messagesToSend = [...currentPathMessages, userMessageWithParent]

        await aiService.sendAIMessage(messagesToSend, llmConfig, userMessageWithParent.id, 'chat', {
          chat: {
            messageContent: content.trim(),
            parentMessageId: parentId
          }
        })
      } catch (error) {
        console.error('Send message failed:', error)
        message.error('发送消息失败，请检查网络连接和配置')
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, aiService, chatId, chat, addMessageToParent, messageTree, setIsLoading]
  )

  const handleRetryMessage = useCallback(
    async (messageId: string) => {
      if (!chat || isLoading) return

      // 找到要重试的消息
      const messageToRetry = chat.messages.find((msg: any) => msg.id === messageId)
      if (!messageToRetry) return

      // 使用原消息的模型ID
      const modelIdToUse = messageToRetry.modelId
      const llmConfig = aiService.getLLMConfig(modelIdToUse)
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      // 在树状结构中，重试意味着从父消息重新生成一个新的分支
      const currentPath = chat.currentPath || messageTree.getCurrentPath()
      const currentPathMessages = currentPath
        .map((id: string) => chat.messages.find((msg: any) => msg.id === id))
        .filter(Boolean) as ChatMessage[]

      // 找到要重试消息的父消息
      const parentMessage = messageToRetry.parentId
        ? chat.messages.find((msg: any) => msg.id === messageToRetry.parentId)
        : null

      // 构建到父消息为止的消息历史
      let messagesToSend: ChatMessage[] = []
      if (parentMessage) {
        const parentIndex = currentPathMessages.findIndex((msg) => msg.id === parentMessage.id)
        if (parentIndex >= 0) {
          messagesToSend = currentPathMessages.slice(0, parentIndex + 1)
        }
      }

      setIsLoading(true)

      try {
        await aiService.sendAIMessage(messagesToSend, llmConfig, parentMessage?.id, 'retry', {
          retry: {
            originalMessageId: messageId
          }
        })
      } catch (error) {
        console.error('Retry message failed:', error)
        message.error('重试失败，请检查网络连接和配置：' + error)
      } finally {
        setIsLoading(false)
      }
    },
    [chat, isLoading, aiService, chatId, messageTree, setIsLoading]
  )

  const handleContinueMessage = useCallback(
    async (messageId: string) => {
      if (!chat || isLoading) return

      // 找到要继续的用户消息
      const targetMessage = chat.messages.find((msg: any) => msg.id === messageId)
      if (!targetMessage || targetMessage.role !== 'user') return

      // 使用当前选中的模型
      const llmConfig = aiService.getLLMConfig(selectedModel)
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      setIsLoading(true)

      try {
        // 获取当前路径上的消息历史，包含到该用户消息为止的所有消息
        const currentPath = chat.currentPath || messageTree.getCurrentPath()
        const currentPathMessages = currentPath
          .map((id: string) => chat.messages.find((msg: any) => msg.id === id))
          .filter(Boolean) as ChatMessage[]

        // 构建到目标消息为止的消息历史
        let messagesToSend: ChatMessage[] = []
        const targetIndex = currentPathMessages.findIndex((msg) => msg.id === messageId)
        if (targetIndex >= 0) {
          messagesToSend = currentPathMessages.slice(0, targetIndex + 1)
        } else {
          // 如果在当前路径中找不到，直接从所有消息中构建路径
          messagesToSend = [targetMessage]
        }

        // 从该用户消息继续生成AI回复
        await aiService.sendAIMessage(messagesToSend, llmConfig, messageId, 'chat', {
          continue: {
            fromMessageId: messageId
          }
        })
      } catch (error) {
        console.error('Continue message failed:', error)
        message.error('继续对话失败，请检查网络连接和配置：' + error)
      } finally {
        setIsLoading(false)
      }
    },
    [chat, isLoading, aiService, chatId, messageTree, setIsLoading, selectedModel]
  )

  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!chat) return

      const { updatePage } = usePagesStore.getState()
      const updatedMessages = chat.messages.map((msg: any) =>
        msg.id === messageId ? { ...msg, content: newContent, timestamp: Date.now() } : msg
      )

      updatePage(chatId, { messages: updatedMessages })
    },
    [chat, chatId]
  )

  const handleEditAndResendMessage = useCallback(
    async (messageId: string, newContent: string, newAttachments?: FileAttachment[]) => {
      if (!chat || isLoading) return

      // 找到要编辑的消息
      const targetMessage = chat.messages.find((msg: any) => msg.id === messageId)
      if (!targetMessage) return

      // 判断当前消息是否有后继消息（子消息）
      const hasChildren = chat.messages.some((msg: any) => msg.parentId === messageId)

      // 如果是用户消息，使用当前选中的模型；如果是AI消息，使用原消息的模型
      const modelIdToUse = targetMessage.role === 'user' ? selectedModel : targetMessage.modelId
      const llmConfig = aiService.getLLMConfig(modelIdToUse)
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      setIsLoading(true)

      try {
        if (targetMessage.role === 'user') {
          if (!hasChildren) {
            // 没有后继消息时，直接编辑原消息内容，然后追加AI回复
            const { updatePage } = usePagesStore.getState()
            const updatedMessages = chat.messages.map((msg: any) =>
              msg.id === messageId ? { ...msg, content: newContent.trim(), timestamp: Date.now() } : msg
            )
            updatePage(chatId, { messages: updatedMessages })

            // 获取当前路径上的消息历史
            const currentPath = chat.currentPath || messageTree.getCurrentPath()
            const currentPathMessages = currentPath
              .map((id: string) => updatedMessages.find((msg: any) => msg.id === id))
              .filter(Boolean) as ChatMessage[]

            // 直接追加AI回复，就像正常发送消息一样
            await aiService.sendAIMessage(
              currentPathMessages,
              llmConfig,
              messageId,
              'edit_resend',
              {
                editResend: {
                  originalMessageId: messageId,
                  newContent: newContent,
                  isDirectAppend: true
                }
              }
            )
          } else {
            // 有后继消息时，创建兄弟分支
            const editedUserMessage = {
              id: uuidv4(),
              role: 'user' as const,
              content: newContent.trim(),
              timestamp: Date.now(),
              parentId: targetMessage.parentId || null,
              attachments: newAttachments !== undefined ? newAttachments : targetMessage.attachments // 使用编辑后的附件，如果没有传入则使用原消息的附件
            }

            // 添加编辑后的用户消息
            addMessageToParent(chatId, editedUserMessage, targetMessage.parentId)

            // 获取到编辑消息父节点为止的消息历史
            const currentPath = chat.currentPath || messageTree.getCurrentPath()
            const currentPathMessages = currentPath
              .map((id: string) => chat.messages.find((msg: any) => msg.id === id))
              .filter(Boolean) as ChatMessage[]

            let messagesToSend: ChatMessage[] = []
            if (targetMessage.parentId) {
              const parentIndex = currentPathMessages.findIndex(
                (msg) => msg.id === targetMessage.parentId
              )
              if (parentIndex >= 0) {
                messagesToSend = [...currentPathMessages.slice(0, parentIndex + 1), editedUserMessage]
              } else {
                messagesToSend = [editedUserMessage]
              }
            } else {
              messagesToSend = [editedUserMessage]
            }

            // 生成新的AI回复
            await aiService.sendAIMessage(
              messagesToSend,
              llmConfig,
              editedUserMessage.id,
              'edit_resend',
              {
                editResend: {
                  originalMessageId: messageId,
                  newContent: newContent
                }
              }
            )
          }
        } else {
          if (!hasChildren) {
            // AI消息没有后继消息时，只需要直接编辑内容，不需要重新生成
            const { updatePage } = usePagesStore.getState()
            const updatedMessages = chat.messages.map((msg: any) =>
              msg.id === messageId ? { ...msg, content: newContent.trim(), timestamp: Date.now() } : msg
            )
            updatePage(chatId, { messages: updatedMessages })
          } else {
            // 有后继消息时，从父消息重新生成作为兄弟分支
            const currentPath = chat.currentPath || messageTree.getCurrentPath()
            const currentPathMessages = currentPath
              .map((id: string) => chat.messages.find((msg: any) => msg.id === id))
              .filter(Boolean) as ChatMessage[]

            let messagesToSend: ChatMessage[] = []
            if (targetMessage.parentId) {
              const parentIndex = currentPathMessages.findIndex(
                (msg) => msg.id === targetMessage.parentId
              )
              if (parentIndex >= 0) {
                messagesToSend = currentPathMessages.slice(0, parentIndex + 1)
              }
            }

            // 生成新的AI回复作为兄弟分支
            await aiService.sendAIMessage(
              messagesToSend,
              llmConfig,
              targetMessage.parentId,
              'edit_resend',
              {
                editResend: {
                  originalMessageId: messageId,
                  newContent: newContent
                }
              }
            )
          }
        }
      } catch (error) {
        console.error('Edit and resend failed:', error)
        message.error('编辑并重发失败，请检查网络连接和配置' + error)
      } finally {
        setIsLoading(false)
      }
    },
    [
      chat,
      isLoading,
      aiService,
      chatId,
      messageTree,
      addMessageToParent,
      setIsLoading,
      selectedModel
    ]
  )

  const handleToggleBookmark = useCallback(
    (messageId: string) => {
      if (!chat) return
      toggleMessageBookmark(chatId, messageId)
    },
    [chat, chatId, toggleMessageBookmark]
  )

  const handleModelChangeForMessage = useCallback(
    async (messageId: string, newModelId: string) => {
      if (!chat || isLoading) return

      const llmConfig = settings.llmConfigs?.find((config: any) => config.id === newModelId)
      if (!llmConfig) {
        message.error('所选模型配置不存在')
        return
      }

      // 找到要更改模型的消息
      const targetMessage = chat.messages.find((msg: any) => msg.id === messageId)
      if (!targetMessage || targetMessage.role !== 'assistant') return

      // 获取当前路径，构建到父消息为止的消息历史
      const currentPath = chat.currentPath || messageTree.getCurrentPath()
      const currentPathMessages = currentPath
        .map((id: string) => chat.messages.find((msg: any) => msg.id === id))
        .filter(Boolean) as ChatMessage[]

      let messagesToSend: ChatMessage[] = []
      if (targetMessage.parentId) {
        const parentIndex = currentPathMessages.findIndex(
          (msg) => msg.id === targetMessage.parentId
        )
        if (parentIndex >= 0) {
          messagesToSend = currentPathMessages.slice(0, parentIndex + 1)
        }
      }

      setIsLoading(true)

      try {
        // 使用新模型生成AI回复作为兄弟分支
        await aiService.sendAIMessage(
          messagesToSend,
          llmConfig,
          targetMessage.parentId,
          'model_change',
          {
            modelChange: {
              originalMessageId: messageId,
              newModelId: newModelId
            }
          }
        )
      } catch (error) {
        console.error('Model change failed:', error)
        message.error('切换模型失败，请检查网络连接和配置')
      } finally {
        setIsLoading(false)
      }
    },
    [chat, isLoading, chatId, aiService, messageTree, setIsLoading, settings]
  )

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!chat) return

      // 找到要删除的消息
      const messageToDelete = chat.messages?.find((msg: any) => msg.id === messageId)
      if (!messageToDelete) return

      // 计算要删除的消息总数（包括子分支）
      const countChildrenRecursively = (msgId: string): number => {
        let count = 1 // 当前消息
        const msg = chat.messages?.find((m: any) => m.id === msgId)
        if (msg?.children) {
          msg.children.forEach((childId: string) => {
            count += countChildrenRecursively(childId)
          })
        }
        return count
      }

      const totalCount = countChildrenRecursively(messageId)
      const hasChildren = totalCount > 1

      // 显示确认对话框
      const confirmText = hasChildren
        ? `确定要删除这条消息及其所有子分支吗？（共 ${totalCount} 条消息）`
        : '确定要删除这条消息吗？'

      const confirmed = await new Promise<boolean>((resolve) => {
        modal.confirm({
          title: '删除消息',
          content: confirmText,
          okText: '删除',
          cancelText: '取消',
          okType: 'danger',
          onOk: () => resolve(true),
          onCancel: () => resolve(false)
        })
      })

      if (!confirmed) return

      try {
        // 调用删除方法
        deleteMessageAndChildren(chatId, messageId)
        message.success(hasChildren ? `已删除 ${totalCount} 条消息` : '已删除消息')
      } catch (error) {
        console.error('Delete message failed:', error)
        message.error('删除消息失败')
      }
    },
    [chat, chatId, deleteMessageAndChildren, message, modal]
  )

  return {
    handleSendMessage,
    handleRetryMessage,
    handleContinueMessage,
    handleEditMessage,
    handleEditAndResendMessage,
    handleToggleBookmark,
    handleModelChangeForMessage,
    handleDeleteMessage
  }
}
