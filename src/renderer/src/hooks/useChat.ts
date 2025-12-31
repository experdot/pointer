import { useCallback, useMemo } from 'react'
import { usePagesStore } from '../stores/pagesStore'
import { useSettingsStore } from '../stores/settingsStore'
import { createAIService } from '../services/aiService'
import * as messagesService from '../services/messagesService'
import { streamingManager } from '../services/streamingManager'
import type { ChatMessage, ChatPage, LLMConfig, ModelConfig } from '../types/type'

interface UseChatOptions {
  pageId: string
}

interface UseChatResult {
  page: ChatPage | undefined
  messages: ChatMessage[]
  currentPath: ChatMessage[]
  sendMessage: (content: string, options?: { parentId?: string }) => Promise<void>
  stopStreaming: () => Promise<void>
  retryMessage: (messageId: string, llmId?: string) => Promise<void>
  continueMessage: (messageId: string) => Promise<void>
  deleteMessage: (messageId: string) => void
  editMessage: (messageId: string, content: string) => void
  editAndResend: (messageId: string, content: string) => Promise<void>
  switchBranch: (messageId: string) => void
  getChildMessages: (parentId: string | undefined) => ChatMessage[]
}

export function useChat({ pageId }: UseChatOptions): UseChatResult {
  const { pages } = usePagesStore()
  const { settings } = useSettingsStore()

  const page = useMemo(() => pages.find((p) => p.id === pageId), [pages, pageId])
  const messages = useMemo(() => page?.data?.messages ?? [], [page?.data?.messages])

  const currentPath = useMemo(() => {
    if (!page) return []
    return messagesService.getCurrentPath(page)
  }, [page])

  const getConfigs = useCallback((): { llmConfig: LLMConfig; modelConfig: ModelConfig } | null => {
    const llmConfig = settings.llmConfigs.items.find((c) => c.id === settings.defaultLLMId)
    if (!llmConfig) return null

    const modelConfigId = llmConfig.modelConfigId ?? settings.defaultModelConfigId
    const modelConfig = settings.modelConfigs.items.find((c) => c.id === modelConfigId) ?? {
      id: 'default',
      name: 'Default',
      systemPrompt: '',
      topP: 1,
      temperature: 0.7,
      createdAt: Date.now()
    }

    return { llmConfig, modelConfig }
  }, [settings])

  // 通用的流式请求处理
  const startStreaming = useCallback(
    async (
      parentMessageId: string,
      pathMessages: ChatMessage[],
      llmConfig: LLMConfig,
      modelConfig: ModelConfig
    ) => {
      // 1. 创建空的 assistant 消息
      const assistantMessage = messagesService.addMessage(pageId, {
        role: 'assistant',
        content: '',
        parentMessageId,
        branchIndex: messagesService.getNextBranchIndex(
          messagesService.getMessages(pageId),
          parentMessageId
        ),
        modelId: llmConfig.id
      })

      // 2. 开始 streaming
      const aiService = createAIService(llmConfig, modelConfig)
      streamingManager.start(assistantMessage.id, aiService)

      try {
        await aiService.sendMessage(pathMessages, {
          onChunk: (chunk) => {
            const current = streamingManager.get(assistantMessage.id)
            streamingManager.update(
              assistantMessage.id,
              (current?.content ?? '') + chunk,
              current?.reasoning
            )
          },
          onReasoning: (reasoning) => {
            const current = streamingManager.get(assistantMessage.id)
            streamingManager.update(
              assistantMessage.id,
              current?.content ?? '',
              (current?.reasoning ?? '') + reasoning
            )
          },
          onComplete: () => {
            const result = streamingManager.finish(assistantMessage.id)
            if (result) {
              messagesService.updateMessage(pageId, assistantMessage.id, {
                content: result.content,
                reasoning_content: result.reasoning
              })
            }
          },
          onError: (error) => {
            console.error('AI error:', error)
            streamingManager.abort(assistantMessage.id)
            // 删除空的 assistant 消息
            messagesService.deleteMessage(pageId, assistantMessage.id)
          }
        })
      } catch (error) {
        console.error('Streaming error:', error)
        streamingManager.abort(assistantMessage.id)
        messagesService.deleteMessage(pageId, assistantMessage.id)
      }
    },
    [pageId]
  )

  const sendMessage = useCallback(
    async (content: string, options?: { parentId?: string }) => {
      if (!page) return

      const configs = getConfigs()
      if (!configs) {
        console.error('No LLM or Model config found')
        return
      }

      const parentId = options === undefined ? page.data?.leafMessageId : options.parentId
      const isFirstMessage = messages.length === 0

      // 添加用户消息
      const userMessage = messagesService.addMessage(pageId, {
        role: 'user',
        content,
        parentMessageId: parentId,
        branchIndex: messagesService.getNextBranchIndex(messages, parentId)
      })

      // 第一条消息且标题是"新对话"时，自动重命名
      if (isFirstMessage && page.title === '新对话') {
        const newTitle = content.slice(0, 10) + (content.length > 10 ? '...' : '')
        usePagesStore.getState().updatePage(pageId, { title: newTitle })
      }

      // 获取最新的消息路径
      const pathMessages = messagesService.getCurrentPath(messagesService.getPage(pageId)!)

      await startStreaming(userMessage.id, pathMessages, configs.llmConfig, configs.modelConfig)
    },
    [page, pageId, messages, getConfigs, startStreaming]
  )

  // 停止当前对话中正在 streaming 的消息
  const stopStreaming = useCallback(async () => {
    // 找到当前对话中正在 streaming 的消息
    const streamingMsg = currentPath.find((msg) => streamingManager.isStreaming(msg.id))
    if (!streamingMsg) return

    const result = await streamingManager.stop(streamingMsg.id)

    if (result?.content) {
      // 保存已生成的内容
      messagesService.updateMessage(pageId, streamingMsg.id, {
        content: result.content,
        reasoning_content: result.reasoning
      })
    } else {
      // 没有内容，删除空消息
      messagesService.deleteMessage(pageId, streamingMsg.id)
    }
  }, [pageId, currentPath])

  const retryMessage = useCallback(
    async (messageId: string, llmId?: string) => {
      const message = messages.find((m) => m.id === messageId)
      if (!message || message.role !== 'assistant') return

      const userMessage = messages.find((m) => m.id === message.parentMessageId)
      if (!userMessage) return

      const targetLLMId = llmId ?? settings.defaultLLMId
      const llmConfig = settings.llmConfigs.items.find((c) => c.id === targetLLMId)
      if (!llmConfig) return

      const modelConfigId = llmConfig.modelConfigId ?? settings.defaultModelConfigId
      const modelConfig = settings.modelConfigs.items.find((c) => c.id === modelConfigId) ?? {
        id: 'default',
        name: 'Default',
        systemPrompt: '',
        topP: 1,
        temperature: 0.7,
        createdAt: Date.now()
      }

      const pathToUser = messagesService.getMessagePath(messages, userMessage.id)
      await startStreaming(userMessage.id, pathToUser, llmConfig, modelConfig)
    },
    [messages, settings, startStreaming]
  )

  const continueMessage = useCallback(
    async (messageId: string) => {
      const message = messages.find((m) => m.id === messageId)
      if (!message || message.role !== 'user') return

      const configs = getConfigs()
      if (!configs) return

      const pathToUser = messagesService.getMessagePath(messages, message.id)
      await startStreaming(message.id, pathToUser, configs.llmConfig, configs.modelConfig)
    },
    [messages, getConfigs, startStreaming]
  )

  const deleteMessage = useCallback(
    (messageId: string) => {
      messagesService.deleteMessage(pageId, messageId)
    },
    [pageId]
  )

  const editMessage = useCallback(
    (messageId: string, content: string) => {
      messagesService.updateMessage(pageId, messageId, { content })
    },
    [pageId]
  )

  const editAndResend = useCallback(
    async (messageId: string, content: string) => {
      const message = messages.find((m) => m.id === messageId)
      if (!message || message.role !== 'user') return

      await sendMessage(content, { parentId: message.parentMessageId })
    },
    [messages, sendMessage]
  )

  const switchBranch = useCallback(
    (messageId: string) => {
      messagesService.switchBranch(pageId, messageId)
    },
    [pageId]
  )

  const getChildMessages = useCallback(
    (parentId: string | undefined) => {
      return messagesService.getChildMessages(messages, parentId)
    },
    [messages]
  )

  return {
    page,
    messages,
    currentPath,
    sendMessage,
    stopStreaming,
    retryMessage,
    continueMessage,
    deleteMessage,
    editMessage,
    editAndResend,
    switchBranch,
    getChildMessages
  }
}
