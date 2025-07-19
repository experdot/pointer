import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { App } from 'antd'
import { v4 as uuidv4 } from 'uuid'
import { usePagesStore } from '../../../stores/pagesStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useMessagesStore } from '../../../stores/messagesStore'
import { useAITasksStore } from '../../../stores/aiTasksStore'
import { ChatMessage, LLMConfig, AITask } from '../../../types/type'
import { createAIService } from '../../../services/aiService'
import { MessageTree } from './messageTree'

interface ChatLogicProps {
  chatId: string
  // 自动提问配置
  autoQuestionEnabled?: boolean
  autoQuestionMode?: 'ai' | 'preset'
  autoQuestionListId?: string
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

export default function ChatLogic({ 
  chatId, 
  autoQuestionEnabled = false,
  autoQuestionMode = 'ai',
  autoQuestionListId,
  children 
}: ChatLogicProps) {
  const { pages } = usePagesStore()
  const { settings, getModelConfigForLLM } = useSettingsStore()
  
  // 使用ref存储最新的自动提问状态，避免闭包问题
  const autoQuestionRef = useRef({
    enabled: autoQuestionEnabled,
    mode: autoQuestionMode,
    listId: autoQuestionListId
  })
  
  // 为预设列表维护独立的计数器
  const promptCounterRef = useRef<Map<string, number>>(new Map())
  
  // 重置特定预设列表的计数器
  const resetPromptCounter = useCallback((listId: string) => {
    promptCounterRef.current.set(listId, 0)
    console.log(`预设列表计数器已重置: ${listId}`)
  }, [])
  
  // 获取预设列表的当前进度
  const getPromptProgress = useCallback((listId: string) => {
    const count = promptCounterRef.current.get(listId) || 0
    const list = settings.promptLists?.find(l => l.id === listId)
    return {
      current: count,
      total: list?.prompts.length || 0,
      completed: list ? count >= list.prompts.length : false
    }
  }, [settings.promptLists])
  
  // 每次props变化时更新ref
  useEffect(() => {
    const prevListId = autoQuestionRef.current.listId
    autoQuestionRef.current = {
      enabled: autoQuestionEnabled,
      mode: autoQuestionMode,
      listId: autoQuestionListId
    }
    
    // 当切换到不同的预设列表时，可以选择重置计数器（这里暂时保持进度）
    // 如果需要重置，可以取消注释下面的代码：
    // if (autoQuestionMode === 'preset' && autoQuestionListId && prevListId !== autoQuestionListId) {
    //   promptCounterRef.current.set(autoQuestionListId, 0)
    //   console.log(`预设列表切换，重置计数器: ${autoQuestionListId}`)
    // }
  }, [autoQuestionEnabled, autoQuestionMode, autoQuestionListId])
  const {
    addMessageToParent,
    updateMessageContent,
    updateMessageReasoning,
    completeMessageStreaming,
    clearStreamingMessage,
    toggleMessageFavorite,
    removeMessage,
    // 使用新的优化版本的流式消息处理方法
    updateStreamingMessageContent,
    updateStreamingMessageReasoning,
    completeStreamingMessage
  } = useMessagesStore()
  const { addTask, updateTask, removeTask } = useAITasksStore()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string | undefined>(settings.defaultLLMId)
  // 使用 Map 管理多个并行的 AI 服务实例
  const [activeAIServices, setActiveAIServices] = useState<Map<string, any>>(new Map())
  const { message } = App.useApp()

  const chat = pages.find((c) => c.id === chatId)

  // 创建消息树实例
  const messageTree = useMemo(() => {
    if (!chat) return new MessageTree()
    return new MessageTree(chat.messages)
  }, [chat?.messages])

    // Helper function to clear streaming message
  const clearStreamingMessageHelper = useCallback(() => {
    clearStreamingMessage(chatId)
  }, [chatId, clearStreamingMessage])

  const getLLMConfig = useCallback(
    (modelId?: string): LLMConfig | null => {
      const targetModelId = modelId || selectedModel || settings.defaultLLMId
      return settings.llmConfigs?.find((config) => config.id === targetModelId) || null
    },
    [selectedModel, settings.defaultLLMId, settings.llmConfigs]
  )

  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModel(modelId)
  }, [])

  const sendAIMessage = useCallback(
    async (
      messages: ChatMessage[],
      llmConfig: LLMConfig,
      parentId?: string,
      taskType: 'chat' | 'retry' | 'edit_resend' | 'model_change' = 'chat',
      taskContext?: any
    ): Promise<string> => {
      const modelConfig = getModelConfigForLLM(llmConfig.id)
      if (!modelConfig) {
        console.warn('未找到模型配置', llmConfig.id)
      }
      const aiService = createAIService(llmConfig, modelConfig)
      const messageId = uuidv4()

      // 将AI服务实例添加到活跃服务列表中
      setActiveAIServices((prev) => new Map(prev).set(messageId, aiService))

      // 创建AI任务监控
      const task: AITask = {
        id: messageId,
        requestId: aiService.id, // 使用AI服务的requestId
        type: taskType,
        status: 'running',
        title:
          taskType === 'chat'
            ? '发送消息'
            : taskType === 'retry'
              ? '重试消息'
              : taskType === 'edit_resend'
                ? '编辑重发'
                : '模型切换',
        description: `使用模型 ${llmConfig.name} 生成回复`,
        chatId,
        messageId,
        modelId: llmConfig.id,
        startTime: Date.now(),
        context: taskContext
      }

      addTask(task)

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

        addMessageToParent(chatId, initialAiMessage, parentId)

        let streamingContent = ''
        let streamingReasoning = ''

        aiService.sendMessage(messages, {
          onChunk: (chunk: string) => {
            streamingContent += chunk
            // 使用优化版本的流式消息更新方法，避免频繁更新整个页面
            updateStreamingMessageContent(chatId, messageId, streamingContent)
          },
          onReasoning: (reasoning_content: string) => {
            streamingReasoning += reasoning_content
            // 使用优化版本的流式消息更新方法，避免频繁更新整个页面
            updateStreamingMessageReasoning(chatId, messageId, streamingReasoning)
          },
          onComplete: async (fullResponse: string, reasoning_content?: string) => {
            const finalContent = fullResponse || streamingContent
            const finalReasoning = reasoning_content || streamingReasoning || undefined
            // 使用优化版本完成流式消息，只在最后更新页面
            completeStreamingMessage(chatId, messageId, finalContent, finalReasoning)
            // 更新任务状态为完成
            updateTask(messageId, {
              status: 'completed',
              endTime: Date.now()
            })
            // 从活跃服务列表中移除
            setActiveAIServices((prev) => {
              const newMap = new Map(prev)
              newMap.delete(messageId)
              return newMap
            })

            // 检查是否启用自动提问，且这是普通聊天任务
            // 使用ref获取最新的自动提问配置，避免闭包问题
            const currentAutoQuestion = autoQuestionRef.current
            console.log('ChatLogic onComplete - 检查自动提问:', {
              enabled: currentAutoQuestion.enabled,
              mode: currentAutoQuestion.mode,
              listId: currentAutoQuestion.listId,
              taskType,
              willTrigger: currentAutoQuestion.enabled && taskType === 'chat'
            })
            
            if (currentAutoQuestion.enabled && taskType === 'chat') {
              try {
                // 延迟一点时间让用户看到AI回答完成
                setTimeout(async () => {
                  await generateAndSendFollowUpQuestion(messageId)
                }, 1000)
              } catch (error) {
                console.error('Auto follow-up question failed:', error)
              }
            }

            resolve(finalContent)
          },
          onError: (error: Error) => {
            // 删除出错的消息
            removeMessage(chatId, messageId)
            // 清除流式消息状态
            clearStreamingMessage(chatId, messageId)
            // 更新任务状态为失败
            updateTask(messageId, {
              status: 'failed',
              endTime: Date.now(),
              error: error.message
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
    [
      chatId,
      addTask,
      addMessageToParent,
      updateMessageContent,
      updateMessageReasoning,
      completeMessageStreaming,
      updateTask,
      removeMessage,
      updateStreamingMessageContent,
      updateStreamingMessageReasoning,
      completeStreamingMessage,
      clearStreamingMessage
      // 注意：autoQuestion相关状态通过autoQuestionRef获取，不需要在依赖数组中
    ]
  )



  const handleSendMessage = useCallback(
    async (content: string, customModelId?: string, customParentId?: string) => {
      if (!content.trim() || isLoading) return

      const llmConfig = getLLMConfig(customModelId)
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      // Clear any existing streaming message
      clearStreamingMessageHelper()

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
    [
      isLoading,
      getLLMConfig,
      chatId,
      chat,
      sendAIMessage,
      clearStreamingMessageHelper,
      addMessageToParent
    ]
  )

  // 生成并发送追问的函数
  const generateAndSendFollowUpQuestion = useCallback(
    async (lastAIMessageId: string) => {
      if (isLoading) return

      // 再次检查自动提问开关是否还开启着
      const currentAutoQuestion = autoQuestionRef.current
      if (!currentAutoQuestion.enabled) {
        console.log('generateAndSendFollowUpQuestion - 自动提问已关闭，函数开始时跳过')
        return
      }

      const llmConfig = getLLMConfig()
      if (!llmConfig) return

      try {
        // 重新获取最新的页面状态
        const { pages } = usePagesStore.getState()
        const currentChat = pages.find((c) => c.id === chatId)
        if (!currentChat || !currentChat.messages) return

        // 获取当前对话历史
        const currentPath = currentChat.currentPath || []
        const currentMessages = currentPath
          .map((id) => currentChat.messages.find((msg) => msg.id === id))
          .filter(Boolean) as ChatMessage[]

        console.log('generateAndSendFollowUpQuestion - currentChat.messages.length:', currentChat.messages?.length)
        console.log('generateAndSendFollowUpQuestion - currentPath:', currentPath)
        console.log('generateAndSendFollowUpQuestion - currentMessages.length:', currentMessages.length)

        if (currentMessages.length < 2) {
          console.log('generateAndSendFollowUpQuestion - 对话历史不足，跳过自动追问')
          return // 至少需要一个用户消息和一个AI消息
        }

        let nextQuestion: string = ''

        if (currentAutoQuestion.mode === 'preset') {
          // 预设列表模式
          const listId = currentAutoQuestion.listId!
          const promptList = settings.promptLists?.find(list => list.id === listId)
          if (!promptList || !promptList.prompts.length) {
            console.log('generateAndSendFollowUpQuestion - 未找到有效的提示词列表')
            return
          }

          // 获取当前预设列表的计数器
          const currentCount = promptCounterRef.current.get(listId) || 0
          
          // 检查是否已经问完所有提示词
          if (currentCount >= promptList.prompts.length) {
            console.log(`generateAndSendFollowUpQuestion - 预设模式，列表 "${promptList.name}" 所有提示词已问完 (${currentCount}/${promptList.prompts.length})，停止自动提问`)
            // 问完后重置计数器，下次可以重新开始
            promptCounterRef.current.set(listId, 0)
            console.log(`generateAndSendFollowUpQuestion - 预设模式，列表 "${promptList.name}" 计数器已重置`)
            return
          }
          
          nextQuestion = promptList.prompts[currentCount]
          console.log(`generateAndSendFollowUpQuestion - 预设模式，列表 "${promptList.name}" 使用提示词 ${currentCount + 1}/${promptList.prompts.length}: ${nextQuestion}`)
          
          // 直接发送预设的问题
          setTimeout(async () => {
            try {
              // 发送前再次检查最新状态
              const latestAutoQuestion = autoQuestionRef.current
              if (!latestAutoQuestion.enabled) {
                console.log('generateAndSendFollowUpQuestion - 自动提问已关闭，跳过发送')
                return
              }

              const { pages: latestPages } = usePagesStore.getState()
              const latestChat = latestPages.find((c) => c.id === chatId)
              if (latestChat) {
                const latestCurrentPath = latestChat.currentPath || []
                const parentId = latestCurrentPath.length > 0 ? latestCurrentPath[latestCurrentPath.length - 1] : undefined
                console.log('generateAndSendFollowUpQuestion - 预设模式，使用父消息ID:', parentId)
                
                // 发送预设问题
                await handleSendMessage(nextQuestion, undefined, parentId)
                
                // 发送成功后，更新计数器
                const newCount = (promptCounterRef.current.get(listId) || 0) + 1
                promptCounterRef.current.set(listId, newCount)
                console.log(`generateAndSendFollowUpQuestion - 预设模式，列表 "${promptList.name}" 计数器更新: ${newCount}/${promptList.prompts.length}`)
              }
            } catch (error) {
              console.error('Auto follow-up AI response failed:', error)
            }
          }, 500)
          return
        }

        // AI生成模式
        console.log('generateAndSendFollowUpQuestion - 对话消息详情:', currentMessages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content?.substring(0, 100) + '...'
        })))
        
        const followUpPrompt = `请基于以下对话历史，生成一个合理的用户追问问题。要求：
1. 问题应该自然地延续对话话题
2. 问题应该能够引发有价值的讨论
3. 问题应该简洁明了，不超过50字
4. 只返回问题本身，不要添加额外说明

对话历史：
${currentMessages.map((msg, index) => {
  const role = msg.role === 'user' ? '用户' : 'AI'
  return `${role}: ${msg.content}`
}).join('\n\n')}

请生成一个合适的追问问题：`

        // 创建用于生成追问的消息数组
        const followUpMessage: ChatMessage = {
          id: 'follow-up-generation',
          role: 'user',
          content: followUpPrompt,
          timestamp: Date.now()
        }

        // 调用AI服务生成追问
        const modelConfig = getModelConfigForLLM(llmConfig.id)
        if (!modelConfig) {
          console.warn('未找到模型配置', llmConfig.id)
        }
        const aiService = createAIService(llmConfig, modelConfig)

        return new Promise((resolve, reject) => {
          let generatedQuestion = ''

          aiService.sendMessage([followUpMessage], {
            onChunk: (chunk: string) => {
              generatedQuestion += chunk
            },
            onComplete: async (fullResponse: string) => {
              const finalQuestion = (fullResponse || generatedQuestion).trim()
              
              if (finalQuestion && finalQuestion.length > 0) {
                // 重新获取最新状态以获得正确的父消息ID
                setTimeout(async () => {
                  try {
                    // 再次检查自动提问开关是否还开启着
                    const latestAutoQuestion = autoQuestionRef.current
                    if (!latestAutoQuestion.enabled) {
                      console.log('generateAndSendFollowUpQuestion - 自动提问已关闭，跳过发送')
                      return
                    }

                    const { pages: latestPages } = usePagesStore.getState()
                    const latestChat = latestPages.find((c) => c.id === chatId)
                    if (latestChat) {
                      const latestCurrentPath = latestChat.currentPath || []
                      const parentId = latestCurrentPath.length > 0 ? latestCurrentPath[latestCurrentPath.length - 1] : undefined
                      console.log('generateAndSendFollowUpQuestion - 使用父消息ID:', parentId)
                      await handleSendMessage(finalQuestion, undefined, parentId)
                    }
                  } catch (error) {
                    console.error('Auto follow-up AI response failed:', error)
                  }
                }, 500)
              }
              resolve(finalQuestion)
            },
            onError: (error: Error) => {
              console.error('Failed to generate follow-up question:', error)
              reject(error)
            }
          })
        })
      } catch (error) {
        console.error('generateAndSendFollowUpQuestion error:', error)
        throw error
      }
    },
    [isLoading, getLLMConfig, getModelConfigForLLM, chatId, handleSendMessage]
    // 注意：autoQuestion相关状态通过autoQuestionRef获取，不需要在依赖数组中
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
      clearStreamingMessageHelper()

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
        message.error('重试失败，请检查网络连接和配置：' + error)
      } finally {
        setIsLoading(false)
      }
    },
    [chat, isLoading, getLLMConfig, chatId, sendAIMessage, clearStreamingMessageHelper, messageTree]
  )

  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!chat) return

      const { updatePage } = usePagesStore.getState()
      const updatedMessages = chat.messages.map((msg) =>
        msg.id === messageId ? { ...msg, content: newContent, timestamp: Date.now() } : msg
      )

      updatePage(chatId, { messages: updatedMessages })
    },
    [chat, chatId]
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
      clearStreamingMessageHelper()

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
          addMessageToParent(chatId, editedUserMessage, targetMessage.parentId)

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
        message.error('编辑并重发失败，请检查网络连接和配置' + error)
      } finally {
        setIsLoading(false)
      }
    },
    [
      chat,
      isLoading,
      getLLMConfig,
      chatId,
      sendAIMessage,
      clearStreamingMessageHelper,
      messageTree,
      addMessageToParent
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

      const llmConfig = settings.llmConfigs?.find((config) => config.id === newModelId)
      if (!llmConfig) {
        message.error('所选模型配置不存在')
        return
      }

      // Clear any existing streaming message
      clearStreamingMessageHelper()

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
      sendAIMessage,
      settings.llmConfigs,
      clearStreamingMessageHelper,
      messageTree
    ]
  )

  const handleStopGeneration = useCallback(() => {
    // 停止所有活跃的AI服务
    activeAIServices.forEach((aiService, messageId) => {
      aiService.stopStreaming()
      // 更新对应的任务状态
      updateTask(messageId, {
        status: 'cancelled',
        endTime: Date.now()
      })

      // 在清除流式消息状态之前，先保存已生成的内容
      const { getStreamingMessage } = useMessagesStore.getState()
      const streamingMessage = getStreamingMessage(chatId, messageId)

      if (streamingMessage) {
        // 保存流式消息的内容到实际的消息中
        const { updatePage } = usePagesStore.getState()
        const page = usePagesStore.getState().findPageById(chatId)
        if (page && page.type === 'regular' && page.messages) {
          const updatedMessages = page.messages.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  content: streamingMessage.content || msg.content,
                  reasoning_content: streamingMessage.reasoning_content || msg.reasoning_content,
                  isStreaming: false
                }
              : msg
          )
          updatePage(chatId, { messages: updatedMessages })
        }
      } else {
        // 如果没有流式消息，仅清除isStreaming状态
        const { updatePage } = usePagesStore.getState()
        const page = usePagesStore.getState().findPageById(chatId)
        if (page && page.type === 'regular' && page.messages) {
          const updatedMessages = page.messages.map((msg) =>
            msg.id === messageId ? { ...msg, isStreaming: false } : msg
          )
          updatePage(chatId, { messages: updatedMessages })
        }
      }

      // 最后清除流式消息状态
      clearStreamingMessage(chatId, messageId)
    })
    setActiveAIServices(new Map())
    setIsLoading(false)
  }, [activeAIServices, updateTask, chatId, clearStreamingMessage])

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
