import { useState, useCallback, useRef } from 'react'
import { App } from 'antd'
import { v4 as uuidv4 } from 'uuid'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useMessagesStore } from '../../../../stores/messagesStore'
import { useAITasksStore } from '../../../../stores/aiTasksStore'
import { usePagesStore } from '../../../../stores/pagesStore'
import { ChatMessage, LLMConfig, AITask } from '../../../../types/type'
import { createAIService } from '../../../../services/aiService'

export interface UseAIServiceReturn {
  isLoading: boolean
  activeAIServices: Map<string, any>
  sendAIMessage: (
    messages: ChatMessage[],
    llmConfig: LLMConfig,
    parentId?: string,
    taskType?: 'chat' | 'retry' | 'edit_resend' | 'model_change',
    taskContext?: any,
    onComplete?: (messageId: string) => void
  ) => Promise<string>
  stopGeneration: () => void
  getLLMConfig: (modelId?: string) => LLMConfig | null
}

export function useAIService(chatId: string): UseAIServiceReturn {
  const { settings, getModelConfigForLLM } = useSettingsStore()
  const {
    addMessageToParent,
    removeMessage,
    updateStreamingMessageContent,
    updateStreamingMessageReasoning,
    completeStreamingMessage,
    clearStreamingMessage
  } = useMessagesStore()
  const { addTask, updateTask } = useAITasksStore()
  const [isLoading, setIsLoading] = useState(false)
  const [activeAIServices, setActiveAIServices] = useState<Map<string, any>>(new Map())
  const { message } = App.useApp()

  const getLLMConfig = useCallback(
    (modelId?: string): LLMConfig | null => {
      const targetModelId = modelId || settings.defaultLLMId
      return settings.llmConfigs?.find((config) => config.id === targetModelId) || null
    },
    [settings.defaultLLMId, settings.llmConfigs]
  )

  const sendAIMessage = useCallback(
    async (
      messages: ChatMessage[],
      llmConfig: LLMConfig,
      parentId?: string,
      taskType: 'chat' | 'retry' | 'edit_resend' | 'model_change' = 'chat',
      taskContext?: any,
      onComplete?: (messageId: string) => void
    ): Promise<string> => {
      const modelConfig = getModelConfigForLLM(llmConfig.id)
      if (!modelConfig) {
        console.warn('未找到模型配置', llmConfig.id)
      }
      const aiService = createAIService(llmConfig, modelConfig)
      const messageId = uuidv4()

      // 设置 loading 状态为 true
      setIsLoading(true)

      // 将AI服务实例添加到活跃服务列表中
      setActiveAIServices((prev) => new Map(prev).set(messageId, aiService))

      // 创建AI任务监控
      const task: AITask = {
        id: messageId,
        requestId: aiService.id,
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
            updateStreamingMessageContent(chatId, messageId, streamingContent)
          },
          onReasoning: (reasoning_content: string) => {
            streamingReasoning += reasoning_content
            updateStreamingMessageReasoning(chatId, messageId, streamingReasoning)
          },
          onComplete: async (fullResponse: string, reasoning_content?: string) => {
            const finalContent = fullResponse || streamingContent
            const finalReasoning = reasoning_content || streamingReasoning || undefined
            
            completeStreamingMessage(chatId, messageId, finalContent, finalReasoning)
            
            updateTask(messageId, {
              status: 'completed',
              endTime: Date.now()
            })
            
            // 从活跃服务列表中移除并检查是否需要重置 loading 状态
            setActiveAIServices((prev) => {
              const newMap = new Map(prev)
              newMap.delete(messageId)
              // 如果没有活跃的服务了，重置 loading 状态
              if (newMap.size === 0) {
                setIsLoading(false)
              }
              return newMap
            })

            // 调用完成回调
            onComplete?.(messageId)
            
            resolve(finalContent)
          },
          onError: (error: Error) => {
            removeMessage(chatId, messageId)
            clearStreamingMessage(chatId, messageId)
            
            updateTask(messageId, {
              status: 'failed',
              endTime: Date.now(),
              error: error.message
            })
            
            // 从活跃服务列表中移除并检查是否需要重置 loading 状态
            setActiveAIServices((prev) => {
              const newMap = new Map(prev)
              newMap.delete(messageId)
              // 如果没有活跃的服务了，重置 loading 状态
              if (newMap.size === 0) {
                setIsLoading(false)
              }
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
      updateTask,
      removeMessage,
      updateStreamingMessageContent,
      updateStreamingMessageReasoning,
      completeStreamingMessage,
      clearStreamingMessage,
      getModelConfigForLLM
    ]
  )

  const stopGeneration = useCallback(() => {
    // 如果没有活跃的服务，直接返回
    if (activeAIServices.size === 0) {
      setIsLoading(false)
      return
    }

    // 停止所有活跃的AI服务
    activeAIServices.forEach((aiService, messageId) => {
      aiService.stopStreaming()
      
      updateTask(messageId, {
        status: 'cancelled',
        endTime: Date.now()
      })

      // 保存已生成的内容
      const { getStreamingMessage } = useMessagesStore.getState()
      const streamingMessage = getStreamingMessage(chatId, messageId)

      if (streamingMessage) {
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
        const { updatePage } = usePagesStore.getState()
        const page = usePagesStore.getState().findPageById(chatId)
        if (page && page.type === 'regular' && page.messages) {
          const updatedMessages = page.messages.map((msg) =>
            msg.id === messageId ? { ...msg, isStreaming: false } : msg
          )
          updatePage(chatId, { messages: updatedMessages })
        }
      }

      clearStreamingMessage(chatId, messageId)
    })
    
    // 清空活跃服务并重置 loading 状态
    setActiveAIServices(new Map())
    setIsLoading(false)
  }, [activeAIServices, updateTask, chatId, clearStreamingMessage])

  return {
    isLoading,
    activeAIServices,
    sendAIMessage,
    stopGeneration,
    getLLMConfig
  }
} 