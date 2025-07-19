import { useCallback } from 'react'
import { App } from 'antd'
import { v4 as uuidv4 } from 'uuid'
import { usePagesStore } from '../../../../stores/pagesStore'
import { useMessagesStore } from '../../../../stores/messagesStore'
import { ChatMessage } from '../../../../types/type'
import { MessageTree } from '../messageTree'
import { UseAIServiceReturn } from './useAIService'

export interface UseMessageOperationsProps {
  chatId: string
  chat: any
  aiService: UseAIServiceReturn
  messageTree: MessageTree
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

export interface UseMessageOperationsReturn {
  handleSendMessage: (content: string, customModelId?: string, customParentId?: string) => Promise<void>
  handleRetryMessage: (messageId: string) => Promise<void>
  handleEditMessage: (messageId: string, newContent: string) => Promise<void>
  handleEditAndResendMessage: (messageId: string, newContent: string) => Promise<void>
  handleToggleFavorite: (messageId: string) => void
  handleModelChangeForMessage: (messageId: string, newModelId: string) => Promise<void>
}

export function useMessageOperations({
  chatId,
  chat,
  aiService,
  messageTree,
  isLoading,
  setIsLoading
}: UseMessageOperationsProps): UseMessageOperationsReturn {
  const { addMessageToParent, toggleMessageFavorite } = useMessagesStore()
  const { message } = App.useApp()

  const handleSendMessage = useCallback(
    async (content: string, customModelId?: string, customParentId?: string) => {
      if (!content.trim() || isLoading) return

      const llmConfig = aiService.getLLMConfig(customModelId)
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now()
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
        // Use the messages we just calculated instead of relying on state
        const allMessages = [...currentMessages, userMessageWithParent]
        await aiService.sendAIMessage(allMessages, llmConfig, userMessageWithParent.id, 'chat', {
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
    [
      isLoading,
      aiService,
      chatId,
      chat,
      addMessageToParent,
      messageTree,
      setIsLoading
    ]
  )

  const handleRetryMessage = useCallback(
    async (messageId: string) => {
      if (!chat || isLoading) return

      const llmConfig = aiService.getLLMConfig()
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      // 找到要重试的消息
      const messageToRetry = chat.messages.find((msg: any) => msg.id === messageId)
      if (!messageToRetry) return

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
    async (messageId: string, newContent: string) => {
      if (!chat || isLoading) return

      const llmConfig = aiService.getLLMConfig()
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      // 找到要编辑的消息
      const targetMessage = chat.messages.find((msg: any) => msg.id === messageId)
      if (!targetMessage) return

      setIsLoading(true)

      try {
        if (targetMessage.role === 'user') {
          // 对于用户消息，创建一个新的编辑版本作为兄弟分支
          const editedUserMessage = {
            id: uuidv4(),
            role: 'user' as const,
            content: newContent.trim(),
            timestamp: Date.now(),
            parentId: targetMessage.parentId || null
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
          await aiService.sendAIMessage(messagesToSend, llmConfig, editedUserMessage.id, 'edit_resend', {
            editResend: {
              originalMessageId: messageId,
              newContent: newContent
            }
          })
        } else {
          // 对于AI消息，从其父消息重新生成
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
          await aiService.sendAIMessage(messagesToSend, llmConfig, targetMessage.parentId, 'edit_resend', {
            editResend: {
              originalMessageId: messageId,
              newContent: newContent
            }
          })
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
      setIsLoading
    ]
  )

  const handleToggleFavorite = useCallback(
    (messageId: string) => {
      if (!chat) return
      toggleMessageFavorite(chatId, messageId)
    },
    [chat, chatId, toggleMessageFavorite]
  )

  const handleModelChangeForMessage = useCallback(
    async (messageId: string, newModelId: string) => {
      if (!chat || isLoading) return

      const { settings } = usePagesStore.getState()
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
        await aiService.sendAIMessage(messagesToSend, llmConfig, targetMessage.parentId, 'model_change', {
          modelChange: {
            originalMessageId: messageId,
            newModelId: newModelId
          }
        })
      } catch (error) {
        console.error('Model change failed:', error)
        message.error('切换模型失败，请检查网络连接和配置')
      } finally {
        setIsLoading(false)
      }
    },
    [
      chat,
      isLoading,
      chatId,
      aiService,
      messageTree,
      setIsLoading
    ]
  )

  return {
    handleSendMessage,
    handleRetryMessage,
    handleEditMessage,
    handleEditAndResendMessage,
    handleToggleFavorite,
    handleModelChangeForMessage
  }
} 