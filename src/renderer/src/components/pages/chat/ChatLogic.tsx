import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { usePagesStore } from '../../../stores/pagesStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { MessageTree } from './messageTree'
import { useAIService, useAutoQuestion, useMessageOperations } from './hooks'
import { FileAttachment } from '../../../types/type'

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
    onSendMessage: (
      content: string,
      customModelId?: string,
      customParentId?: string,
      attachments?: FileAttachment[]
    ) => Promise<void>
    onStopGeneration: () => void
    onRetryMessage: (messageId: string) => Promise<void>
    onContinueMessage: (messageId: string) => Promise<void>
    onEditMessage: (messageId: string, newContent: string) => Promise<void>
    onEditAndResendMessage: (messageId: string, newContent: string) => Promise<void>
    onToggleStar: (messageId: string) => void
    onModelChangeForMessage: (messageId: string, newModelId: string) => Promise<void>
    onDeleteMessage: (messageId: string) => Promise<void>
    onTriggerFollowUpQuestion: () => Promise<void>
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
  const [selectedModel, setSelectedModel] = useState<string | undefined>(settings.defaultLLMId)
  const [isLoading, setIsLoading] = useState(false)

  // 使用 ref 来存储最新的 selectedModel，避免闭包陷阱
  const selectedModelRef = useRef<string | undefined>(selectedModel)

  // 同步 selectedModel 到 ref
  useEffect(() => {
    selectedModelRef.current = selectedModel
    console.log('[ChatLogic] selectedModel 更新到 ref:', selectedModel)
  }, [selectedModel])

  // 同步 defaultLLMId 的变化到 selectedModel (仅当 selectedModel 未设置时)
  useEffect(() => {
    if (!selectedModel && settings.defaultLLMId) {
      setSelectedModel(settings.defaultLLMId)
    }
  }, [settings.defaultLLMId, selectedModel])

  const chat = pages.find((c) => c.id === chatId)

  // 创建消息树实例
  const messageTree = useMemo(() => {
    if (!chat) return new MessageTree()
    return new MessageTree(chat.messages)
  }, [chat?.messages])

  // 使用 AI 服务 hook
  const aiService = useAIService(chatId)

  // 创建 ref 来解决循环依赖问题
  const sendMessageRef = useRef<
    | ((
        content: string,
        customModelId?: string,
        customParentId?: string,
        attachments?: FileAttachment[]
      ) => Promise<void>)
    | null
  >(null)

  // 使用自动提问 hook
  const autoQuestion = useAutoQuestion({
    chatId,
    autoQuestionEnabled,
    autoQuestionMode,
    autoQuestionListId,
    onSendMessageRef: sendMessageRef,
    getLLMConfig: () => aiService.getLLMConfig(selectedModel),
    getModelConfigForLLM
  })

  // 创建带有自动提问回调的 AI 消息发送函数
  const sendAIMessageWithAutoQuestion = useCallback(
    async (
      messages: any[],
      llmConfig: any,
      parentId?: string,
      taskType: 'chat' | 'retry' | 'edit_resend' | 'model_change' = 'chat',
      taskContext?: any
    ) => {
      return aiService.sendAIMessage(
        messages,
        llmConfig,
        parentId,
        taskType,
        taskContext,
        async (messageId: string) => {
          if (autoQuestionEnabled) {
            try {
              setTimeout(async () => {
                await autoQuestion.generateAndSendFollowUpQuestion(messageId)
              }, 1000)
            } catch (error) {
              console.error('Auto follow-up question failed:', error)
            }
          }
        }
      )
    },
    [aiService, autoQuestionEnabled, autoQuestion]
  )

  // 重写 aiService 的 sendAIMessage 方法以支持自动提问
  const enhancedAIService = {
    ...aiService,
    sendAIMessage: sendAIMessageWithAutoQuestion
  }

  // 使用增强的 AI 服务创建消息操作 hook
  const messageOperations = useMessageOperations({
    chatId,
    chat,
    aiService: enhancedAIService,
    messageTree,
    isLoading,
    setIsLoading,
    selectedModel,
    selectedModelRef
  })

  // 设置 sendMessage 引用，确保自动追问也使用增强的消息发送
  useEffect(() => {
    sendMessageRef.current = messageOperations.handleSendMessage
  }, [messageOperations.handleSendMessage])

  // 获取最新的AI消息ID
  const getLatestAIMessageId = useCallback(() => {
    if (!chat?.messages) return null

    // 获取当前路径的消息
    const currentPath = chat.currentPath || []
    let messages: any[] = []

    if (currentPath.length > 0) {
      // 使用当前路径
      messages = currentPath
        .map((id: string) => chat.messages.find((msg: any) => msg.id === id))
        .filter(Boolean)
    } else {
      // 使用消息树获取默认路径
      messages = messageTree.getCurrentPathMessages()
    }

    // 从后往前找最新的AI消息
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        return messages[i].id
      }
    }

    return null
  }, [chat, messageTree])

  // 立即触发追问
  const handleTriggerFollowUpQuestion = useCallback(async () => {
    if (!autoQuestionEnabled) {
      console.warn('自动追问功能未开启')
      return
    }

    const latestAIMessageId = getLatestAIMessageId()
    if (!latestAIMessageId) {
      console.warn('未找到AI消息，无法触发追问')
      return
    }

    try {
      await autoQuestion.generateAndSendFollowUpQuestion(latestAIMessageId)
    } catch (error) {
      console.error('立即触发追问失败:', error)
    }
  }, [autoQuestionEnabled, getLatestAIMessageId, autoQuestion])

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId)
  }

  const handleStopGeneration = useCallback(() => {
    // 同时重置两个 loading 状态
    setIsLoading(false)
    aiService.stopGeneration()
  }, [aiService, setIsLoading])

  return children({
    isLoading: isLoading || aiService.isLoading,
    selectedModel,
    onModelChange: handleModelChange,
    onSendMessage: messageOperations.handleSendMessage,
    onStopGeneration: handleStopGeneration,
    onRetryMessage: messageOperations.handleRetryMessage,
    onContinueMessage: messageOperations.handleContinueMessage,
    onEditMessage: messageOperations.handleEditMessage,
    onEditAndResendMessage: messageOperations.handleEditAndResendMessage,
    onToggleStar: messageOperations.handleToggleStar,
    onModelChangeForMessage: messageOperations.handleModelChangeForMessage,
    onDeleteMessage: messageOperations.handleDeleteMessage,
    onTriggerFollowUpQuestion: handleTriggerFollowUpQuestion
  })
}
