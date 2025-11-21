import { useState, useCallback, useRef, useEffect } from 'react'
import { App } from 'antd'
import { v4 as uuidv4 } from 'uuid'
import { useSettingsStore } from '../../../../stores/settingsStore'
import { useMessagesStore } from '../../../../stores/messagesStore'
import { useAITasksStore } from '../../../../stores/aiTasksStore'
import { usePagesStore } from '../../../../stores/pagesStore'
import { ChatMessage, LLMConfig, AITask } from '../../../../types/type'
import { createAIService } from '../../../../services/aiService'

// 流式更新节流器 - 使用 requestAnimationFrame 限制更新频率
class StreamingThrottler {
  private pendingContent: Map<string, string> = new Map()
  private pendingReasoning: Map<string, string> = new Map()
  private rafId: number | null = null
  private updateContentFn: ((chatId: string, messageId: string, content: string) => void) | null =
    null
  private updateReasoningFn:
    | ((chatId: string, messageId: string, reasoning: string) => void)
    | null = null

  setUpdateFunctions(
    contentFn: (chatId: string, messageId: string, content: string) => void,
    reasoningFn: (chatId: string, messageId: string, reasoning: string) => void
  ) {
    this.updateContentFn = contentFn
    this.updateReasoningFn = reasoningFn
  }

  scheduleContentUpdate(chatId: string, messageId: string, content: string) {
    const key = `${chatId}:${messageId}`
    this.pendingContent.set(key, content)
    this.scheduleFlush()
  }

  scheduleReasoningUpdate(chatId: string, messageId: string, reasoning: string) {
    const key = `${chatId}:${messageId}`
    this.pendingReasoning.set(key, reasoning)
    this.scheduleFlush()
  }

  private scheduleFlush() {
    if (this.rafId !== null) return
    this.rafId = requestAnimationFrame(() => {
      this.flush()
      this.rafId = null
    })
  }

  private flush() {
    // 批量更新所有待处理的内容
    if (this.updateContentFn) {
      this.pendingContent.forEach((content, key) => {
        const [chatId, messageId] = key.split(':')
        this.updateContentFn!(chatId, messageId, content)
      })
    }
    this.pendingContent.clear()

    // 批量更新所有待处理的推理内容
    if (this.updateReasoningFn) {
      this.pendingReasoning.forEach((reasoning, key) => {
        const [chatId, messageId] = key.split(':')
        this.updateReasoningFn!(chatId, messageId, reasoning)
      })
    }
    this.pendingReasoning.clear()
  }

  // 强制立即刷新（用于完成时确保内容同步）
  forceFlush() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.flush()
  }

  cleanup() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.pendingContent.clear()
    this.pendingReasoning.clear()
  }
}

// 全局节流器实例
const streamingThrottler = new StreamingThrottler()

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

  // 初始化节流器的更新函数
  useEffect(() => {
    streamingThrottler.setUpdateFunctions(
      updateStreamingMessageContent,
      updateStreamingMessageReasoning
    )
    return () => {
      streamingThrottler.cleanup()
    }
  }, [updateStreamingMessageContent, updateStreamingMessageReasoning])

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
            // 使用节流器批量更新，避免高频状态更新导致界面卡顿
            streamingThrottler.scheduleContentUpdate(chatId, messageId, streamingContent)
          },
          onReasoning: (reasoning_content: string) => {
            streamingReasoning += reasoning_content
            // 使用节流器批量更新
            streamingThrottler.scheduleReasoningUpdate(chatId, messageId, streamingReasoning)
          },
          onComplete: async (fullResponse: string, reasoning_content?: string) => {
            // 完成前强制刷新，确保所有内容都已更新到 UI
            streamingThrottler.forceFlush()
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
            console.log('[sendAIMessage] 发生错误:', messageId, error.message)

            // 保留消息，但显示错误信息
            const errorMessage = `生成失败：${error.message}\n\n请检查模型配置或网络连接后重试。`

            // 完成消息并设置错误内容
            completeStreamingMessage(chatId, messageId, errorMessage, undefined)

            // 标记消息为错误状态（通过在消息中添加特殊标记）
            const { updatePage } = usePagesStore.getState()
            const page = usePagesStore.getState().findPageById(chatId)
            if (page && page.type === 'regular' && page.messages) {
              const updatedMessages = page.messages.map((msg) =>
                msg.id === messageId
                  ? {
                      ...msg,
                      content: errorMessage,
                      isStreaming: false,
                      hasError: true // 添加错误标记
                    }
                  : msg
              )
              updatePage(chatId, { messages: updatedMessages })
            }

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
