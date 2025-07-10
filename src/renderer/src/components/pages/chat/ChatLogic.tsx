import React, { useState, useCallback, useMemo } from 'react'
import { App } from 'antd'
import { v4 as uuidv4 } from 'uuid'
import { useAppContext } from '../../../store/AppContext'
import { ChatMessage, LLMConfig, AITask } from '../../../types'
import { createAIService } from '../../../services/aiService'
import { MessageTree } from './messageTree'

interface ChatLogicProps {
  chatId: string
  children: (props: {
    isLoading: boolean
    selectedModel: string | undefined
    onModelChange: (modelId: string) => void
    onSendMessage: (content: string, customModelId?: string) => Promise<void>
    onStopGeneration: () => void
    onRetryMessage: (messageId: string) => Promise<void>
    onEditMessage: (messageId: string, newContent: string) => Promise<void>
    onEditAndResendMessage: (messageId: string, newContent: string) => Promise<void>
    onToggleFavorite: (messageId: string) => void
    onModelChangeForMessage: (messageId: string, newModelId: string) => Promise<void>
  }) => React.ReactNode
}

export default function ChatLogic({ chatId, children }: ChatLogicProps) {
  const { state, dispatch } = useAppContext()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string | undefined>(
    state.settings.defaultLLMId
  )
  // 使用 Map 管理多个并行的 AI 服务实例
  const [activeAIServices, setActiveAIServices] = useState<Map<string, any>>(new Map())
  const { message } = App.useApp()

  const chat = state.pages.find((c) => c.id === chatId)

  // 创建消息树实例
  const messageTree = useMemo(() => {
    if (!chat) return new MessageTree()
    return new MessageTree(chat.messages)
  }, [chat?.messages])

  // Helper function to clear streaming message
  const clearStreamingMessage = useCallback(() => {
    dispatch({
      type: 'CLEAR_STREAMING_MESSAGE',
      payload: { chatId }
    })
  }, [chatId, dispatch])

  const getLLMConfig = useCallback(
    (modelId?: string): LLMConfig | null => {
      const targetModelId = modelId || selectedModel || state.settings.defaultLLMId
      return state.settings.llmConfigs?.find((config) => config.id === targetModelId) || null
    },
    [selectedModel, state.settings.defaultLLMId, state.settings.llmConfigs]
  )

  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModel(modelId)
  }, [])

  const sendAIMessage = useCallback(
    async (messages: ChatMessage[], llmConfig: LLMConfig, parentId?: string, taskType: 'chat' | 'retry' | 'edit_resend' | 'model_change' = 'chat', taskContext?: any): Promise<string> => {
      const aiService = createAIService(llmConfig)
      const messageId = uuidv4()

      // 将AI服务实例添加到活跃服务列表中
      setActiveAIServices((prev) => new Map(prev).set(messageId, aiService))

      // 创建AI任务监控
      const task: AITask = {
        id: messageId,
        requestId: aiService.id, // 使用AI服务的requestId
        type: taskType,
        status: 'running',
        title: taskType === 'chat' ? '发送消息' : taskType === 'retry' ? '重试消息' : taskType === 'edit_resend' ? '编辑重发' : '模型切换',
        description: `使用模型 ${llmConfig.name} 生成回复`,
        chatId,
        messageId,
        modelId: llmConfig.id,
        startTime: Date.now(),
        context: taskContext
      }

      dispatch({
        type: 'ADD_AI_TASK',
        payload: { task }
      })

      return new Promise((resolve, reject) => {
        const streamingTimestamp = Date.now()

        // 立即创建一个空的AI消息
        const initialAiMessage: ChatMessage = {
          id: messageId,
          role: 'assistant',
          content: '',
          timestamp: streamingTimestamp,
          modelId: llmConfig.id,
          isStreaming: true,
          parentId
        }

        dispatch({
          type: 'ADD_MESSAGE_TO_PARENT',
          payload: { chatId, message: initialAiMessage, parentId }
        })

        let streamingContent = ''
        let streamingReasoning = ''

        aiService.sendMessage(messages, {
          onChunk: (chunk: string) => {
            streamingContent += chunk
            // 更新现有消息的内容
            dispatch({
              type: 'UPDATE_MESSAGE_CONTENT',
              payload: {
                chatId,
                messageId,
                content: streamingContent
              }
            })
          },
          onReasoning: (reasoning_content: string) => {
            streamingReasoning += reasoning_content
            // 实时更新reasoning内容
            dispatch({
              type: 'UPDATE_MESSAGE_REASONING',
              payload: {
                chatId,
                messageId,
                reasoning_content: streamingReasoning
              }
            })
          },
          onComplete: (fullResponse: string, reasoning_content?: string) => {
            const finalContent = fullResponse || streamingContent
            const finalReasoning = reasoning_content || streamingReasoning || undefined
            // 标记消息为完成状态
            dispatch({
              type: 'COMPLETE_MESSAGE_STREAMING_WITH_REASONING',
              payload: {
                chatId,
                messageId,
                content: finalContent,
                reasoning_content: finalReasoning
              }
            })
            // 更新任务状态为完成
            dispatch({
              type: 'UPDATE_AI_TASK',
              payload: {
                taskId: messageId,
                updates: {
                  status: 'completed',
                  endTime: Date.now()
                }
              }
            })
            // 从活跃服务列表中移除
            setActiveAIServices((prev) => {
              const newMap = new Map(prev)
              newMap.delete(messageId)
              return newMap
            })
            resolve(finalContent)
          },
          onError: (error: Error) => {
            // 删除出错的消息
            dispatch({
              type: 'REMOVE_MESSAGE',
              payload: { chatId, messageId }
            })
            // 更新任务状态为失败
            dispatch({
              type: 'UPDATE_AI_TASK',
              payload: {
                taskId: messageId,
                updates: {
                  status: 'failed',
                  endTime: Date.now(),
                  error: error.message
                }
              }
            })
            // 从活跃服务列表中移除
            setActiveAIServices((prev) => {
              const newMap = new Map(prev)
              newMap.delete(messageId)
              return newMap
            })
            reject(error)
          }
        })
      })
    },
    [chatId, dispatch]
  )

  const handleSendMessage = useCallback(
    async (content: string, customModelId?: string) => {
      if (!content.trim() || isLoading) return

      const llmConfig = getLLMConfig(customModelId)
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      // Clear any existing streaming message
      clearStreamingMessage()

      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now()
      }

      // Get current messages before adding the new one
      const currentMessages = chat?.messages || []

      // 获取当前路径中的最后一条消息作为父消息
      const currentPath = chat?.currentPath || messageTree.getCurrentPath()
      const parentId = currentPath.length > 0 ? currentPath[currentPath.length - 1] : undefined

      // Add user message with parent relationship
      const userMessageWithParent = {
        ...userMessage,
        parentId: parentId || null
      }

      dispatch({
        type: 'ADD_MESSAGE_TO_PARENT',
        payload: { chatId, message: userMessageWithParent, parentId }
      })

      // Update chat title if it's the first message
      if (chat && currentMessages.length === 0) {
        const title = content.trim().slice(0, 50) + (content.trim().length > 50 ? '...' : '')
        dispatch({
          type: 'UPDATE_CHAT',
          payload: { id: chatId, updates: { title } }
        })
      }

      setIsLoading(true)

      try {
        // Use the messages we just calculated instead of relying on state
        const allMessages = [...currentMessages, userMessageWithParent]
        await sendAIMessage(allMessages, llmConfig, userMessageWithParent.id, 'chat', {
          chat: {
            messageContent: content.trim(),
            parentMessageId: parentId
          }
        })
        // AI消息已经在sendAIMessage的onComplete中添加了
      } catch (error) {
        console.error('Send message failed:', error)
        message.error('发送消息失败，请检查网络连接和配置')
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, getLLMConfig, chatId, chat, dispatch, sendAIMessage, clearStreamingMessage]
  )

  const handleRetryMessage = useCallback(
    async (messageId: string) => {
      if (!chat || isLoading) return

      const llmConfig = getLLMConfig()
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      // Clear any existing streaming message
      clearStreamingMessage()

      // 找到要重试的消息
      const messageToRetry = chat.messages.find((msg) => msg.id === messageId)
      if (!messageToRetry) return

      // 在树状结构中，重试意味着从父消息重新生成一个新的分支
      // 获取当前路径，找到要重试消息的父消息
      const currentPath = chat.currentPath || messageTree.getCurrentPath()
      const currentPathMessages = currentPath
        .map((id) => chat.messages.find((msg) => msg.id === id))
        .filter(Boolean) as ChatMessage[]

      // 找到要重试消息的父消息
      const parentMessage = messageToRetry.parentId
        ? chat.messages.find((msg) => msg.id === messageToRetry.parentId)
        : null

      // 构建到父消息为止的消息历史
      let messagesToSend: ChatMessage[] = []
      if (parentMessage) {
        // 如果有父消息，构建到父消息为止的路径
        const parentIndex = currentPathMessages.findIndex((msg) => msg.id === parentMessage.id)
        if (parentIndex >= 0) {
          messagesToSend = currentPathMessages.slice(0, parentIndex + 1)
        }
      }

      setIsLoading(true)

      try {
        // 生成新的AI回复作为兄弟分支
        await sendAIMessage(messagesToSend, llmConfig, parentMessage?.id, 'retry', {
          retry: {
            originalMessageId: messageId
          }
        })
        // AI消息已经在sendAIMessage的onComplete中添加了
      } catch (error) {
        console.error('Retry message failed:', error)
        message.error('重试失败，请检查网络连接和配置')
      } finally {
        setIsLoading(false)
      }
    },
    [
      chat,
      isLoading,
      getLLMConfig,
      chatId,
      dispatch,
      sendAIMessage,
      clearStreamingMessage,
      messageTree
    ]
  )

  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!chat) return

      const updatedMessages = chat.messages.map((msg) =>
        msg.id === messageId ? { ...msg, content: newContent, timestamp: Date.now() } : msg
      )

      dispatch({
        type: 'UPDATE_CHAT',
        payload: {
          id: chatId,
          updates: { messages: updatedMessages }
        }
      })
    },
    [chat, chatId, dispatch]
  )

  const handleEditAndResendMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!chat || isLoading) return

      const llmConfig = getLLMConfig()
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      // Clear any existing streaming message
      clearStreamingMessage()

      // 找到要编辑的消息
      const targetMessage = chat.messages.find((msg) => msg.id === messageId)
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
          dispatch({
            type: 'ADD_MESSAGE_TO_PARENT',
            payload: { chatId, message: editedUserMessage, parentId: targetMessage.parentId }
          })

          // 获取到编辑消息父节点为止的消息历史
          const currentPath = chat.currentPath || messageTree.getCurrentPath()
          const currentPathMessages = currentPath
            .map((id) => chat.messages.find((msg) => msg.id === id))
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
          await sendAIMessage(messagesToSend, llmConfig, editedUserMessage.id, 'edit_resend', {
            editResend: {
              originalMessageId: messageId,
              newContent: newContent
            }
          })
        } else {
          // 对于AI消息，从其父消息重新生成
          const currentPath = chat.currentPath || messageTree.getCurrentPath()
          const currentPathMessages = currentPath
            .map((id) => chat.messages.find((msg) => msg.id === id))
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
          await sendAIMessage(messagesToSend, llmConfig, targetMessage.parentId, 'edit_resend', {
            editResend: {
              originalMessageId: messageId,
              newContent: newContent
            }
          })
        }
      } catch (error) {
        console.error('Edit and resend failed:', error)
        message.error('编辑并重发失败，请检查网络连接和配置')
      } finally {
        setIsLoading(false)
      }
    },
    [
      chat,
      isLoading,
      getLLMConfig,
      chatId,
      dispatch,
      sendAIMessage,
      clearStreamingMessage,
      messageTree
    ]
  )

  const handleToggleFavorite = useCallback(
    (messageId: string) => {
      if (!chat) return

      const updatedMessages = chat.messages.map((msg) =>
        msg.id === messageId ? { ...msg, isFavorited: !msg.isFavorited } : msg
      )

      dispatch({
        type: 'UPDATE_CHAT',
        payload: {
          id: chatId,
          updates: { messages: updatedMessages }
        }
      })
    },
    [chat, chatId, dispatch]
  )

  const handleModelChangeForMessage = useCallback(
    async (messageId: string, newModelId: string) => {
      if (!chat || isLoading) return

      const llmConfig = state.settings.llmConfigs?.find((config) => config.id === newModelId)
      if (!llmConfig) {
        message.error('所选模型配置不存在')
        return
      }

      // Clear any existing streaming message
      clearStreamingMessage()

      // 找到要更改模型的消息
      const targetMessage = chat.messages.find((msg) => msg.id === messageId)
      if (!targetMessage || targetMessage.role !== 'assistant') return

      // 获取当前路径，构建到父消息为止的消息历史
      const currentPath = chat.currentPath || messageTree.getCurrentPath()
      const currentPathMessages = currentPath
        .map((id) => chat.messages.find((msg) => msg.id === id))
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
        await sendAIMessage(messagesToSend, llmConfig, targetMessage.parentId, 'model_change', {
          modelChange: {
            originalMessageId: messageId,
            newModelId: newModelId
          }
        })
        // AI消息已经在sendAIMessage的onComplete中添加了
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
      dispatch,
      sendAIMessage,
      state.settings.llmConfigs,
      clearStreamingMessage,
      messageTree
    ]
  )

  const handleStopGeneration = useCallback(() => {
    // 停止所有活跃的AI服务
    activeAIServices.forEach((aiService, messageId) => {
      aiService.stopStreaming()
      // 更新对应的任务状态
      dispatch({
        type: 'UPDATE_AI_TASK',
        payload: {
          taskId: messageId,
          updates: {
            status: 'cancelled',
            endTime: Date.now()
          }
        }
      })
    })
    setActiveAIServices(new Map())
    setIsLoading(false)
  }, [activeAIServices, dispatch])

  return children({
    isLoading,
    selectedModel,
    onModelChange: handleModelChange,
    onSendMessage: handleSendMessage,
    onStopGeneration: handleStopGeneration,
    onRetryMessage: handleRetryMessage,
    onEditMessage: handleEditMessage,
    onEditAndResendMessage: handleEditAndResendMessage,
    onToggleFavorite: handleToggleFavorite,
    onModelChangeForMessage: handleModelChangeForMessage
  })
}
