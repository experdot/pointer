import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { usePagesStore } from '../../../stores/pagesStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { MessageTree } from './messageTree'
import { useAIService, useAutoQuestion, useMessageOperations } from './hooks'

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
  const [selectedModel, setSelectedModel] = useState<string | undefined>(settings.defaultLLMId)
  const [isLoading, setIsLoading] = useState(false)

  const chat = pages.find((c) => c.id === chatId)

  // 创建消息树实例
  const messageTree = useMemo(() => {
    if (!chat) return new MessageTree()
    return new MessageTree(chat.messages)
  }, [chat?.messages])

  // 使用 AI 服务 hook
  const aiService = useAIService(chatId)

  // 创建 ref 来解决循环依赖问题
  const sendMessageRef = useRef<((content: string, customModelId?: string, customParentId?: string) => Promise<void>) | null>(null)

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
  const sendAIMessageWithAutoQuestion = useCallback(async (
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
        // 只在普通聊天任务完成后触发自动提问
        if (autoQuestionEnabled && taskType === 'chat') {
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
  }, [aiService, autoQuestionEnabled, autoQuestion])

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
    setIsLoading
  })

  // 设置 sendMessage 引用，确保自动追问也使用增强的消息发送
  useEffect(() => {
    sendMessageRef.current = messageOperations.handleSendMessage
  }, [messageOperations.handleSendMessage])

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId)
  }

  return children({
    isLoading: isLoading || aiService.isLoading,
    selectedModel,
    onModelChange: handleModelChange,
    onSendMessage: messageOperations.handleSendMessage,
    onStopGeneration: aiService.stopGeneration,
    onRetryMessage: messageOperations.handleRetryMessage,
    onEditMessage: messageOperations.handleEditMessage,
    onEditAndResendMessage: messageOperations.handleEditAndResendMessage,
    onToggleFavorite: messageOperations.handleToggleFavorite,
    onModelChangeForMessage: messageOperations.handleModelChangeForMessage
  })
}
