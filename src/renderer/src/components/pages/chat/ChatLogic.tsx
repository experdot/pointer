import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { usePagesStore } from '../../../stores/pagesStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { MessageTree } from './messageTree'
import { useAIService, useMessageOperations } from './hooks'
import { FileAttachment } from '../../../types/type'

interface ChatLogicProps {
  chatId: string
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
    getLLMConfig: (modelId?: string) => any
  }) => React.ReactNode
}

export default function ChatLogic({ chatId, children }: ChatLogicProps) {
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

  // 使用消息操作 hook
  const messageOperations = useMessageOperations({
    chatId,
    chat,
    aiService,
    messageTree,
    isLoading,
    setIsLoading,
    selectedModel,
    selectedModelRef
  })

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
    getLLMConfig: aiService.getLLMConfig
  })
}
