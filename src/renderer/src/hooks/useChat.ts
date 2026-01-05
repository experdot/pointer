import { useCallback, useMemo, useEffect, useState } from 'react'
import { usePagesStore } from '../stores/pagesStore'
import { useMessagesStore } from '../stores/messagesStore'
import { useSettingsStore } from '../stores/settingsStore'
import { createAIService } from '../services/aiService'
import * as messagesService from '../services/messagesService'
import {
  updateMessageTitle,
  setMessageAsTopic,
  removeTopicFromMessage,
  toggleTopicCollapse as toggleTopicCollapseService
} from '../services/messagesService'
import * as pagesService from '../services/pagesService'
import { streamingManager } from '../services/streamingManager'
import { generateMessageTitle, generateTopicTitle, analyzeTopicSegments } from '../services/titleService'
import type {
  ChatMessage,
  LLMConfig,
  ModelConfig,
  FileAttachment,
  TopicGroup,
  OutlineNode
} from '../types/type'
import type { PageRecord } from '../utils/database'

interface UseChatOptions {
  pageId: string
}

interface UseChatResult {
  page: PageRecord | undefined
  messages: ChatMessage[]
  currentPath: ChatMessage[]
  isLoading: boolean
  sendMessage: (
    content: string,
    options?: {
      parentId?: string
      attachments?: FileAttachment[]
      /** 是否创建新分支（使用 parentId 而非 leafMessageId） */
      createBranch?: boolean
    }
  ) => Promise<void>
  stopStreaming: () => Promise<void>
  retryMessage: (messageId: string, llmId?: string) => Promise<void>
  continueMessage: (messageId: string) => Promise<void>
  deleteMessage: (messageId: string) => void
  editMessage: (messageId: string, content: string) => void
  editAndResend: (messageId: string, content: string) => Promise<void>
  switchBranch: (messageId: string) => void
  getChildMessages: (parentId: string | undefined) => ChatMessage[]
  // Title/Topic 相关
  topicGroups: TopicGroup[]
  outline: OutlineNode[]
  updateTitle: (messageId: string, title: string) => void
  generateTitle: (messageId: string) => Promise<void>
  setAsTopic: (messageId: string, topic: string) => void
  removeTopic: (messageId: string) => void
  toggleTopicCollapse: (messageId: string) => void
  generateTopic: (messageId: string) => Promise<void>
  // 批量生成标题
  batchGenerateTitles: () => Promise<void>
  batchProgress: { current: number; total: number } | null
  // 智能分段
  smartSegmentation: () => Promise<void>
  isSegmenting: boolean
}

export function useChat({ pageId }: UseChatOptions): UseChatResult {
  const { pages } = usePagesStore()
  const { cache, load } = useMessagesStore()
  const { settings } = useSettingsStore()

  const page = useMemo(() => pages.find((p) => p.id === pageId), [pages, pageId])
  const record = cache[pageId]
  const messages = useMemo(() => record?.messages ?? [], [record?.messages])
  const isLoading = !record

  // 加载消息
  useEffect(() => {
    if (!record && pageId) {
      load(pageId)
    }
  }, [pageId, record, load])

  const currentPath = useMemo(() => {
    if (!record) return []
    return messagesService.getMessagePath(record.messages, record.leafMessageId)
  }, [record])

  // Topic 分组和大纲计算
  const topicGroups = useMemo(() => {
    return messagesService.computeTopicGroups(currentPath)
  }, [currentPath])

  const outline = useMemo(() => {
    return messagesService.computeOutline(currentPath)
  }, [currentPath])

  const getConfigs = useCallback((): {
    llmConfig: LLMConfig
    modelConfig: ModelConfig | undefined
  } | null => {
    const llmConfig = settings.llmConfigs.items.find((c) => c.id === settings.defaultLLMId)
    if (!llmConfig) return null

    const modelConfig = settings.modelConfigs.items.find(
      (c) => c.id === settings.defaultModelConfigId
    )

    return { llmConfig, modelConfig }
  }, [settings])

  const startStreaming = useCallback(
    async (
      parentMessageId: string,
      pathMessages: ChatMessage[],
      llmConfig: LLMConfig,
      modelConfig: ModelConfig | undefined
    ) => {
      // 1. 创建空的 assistant 消息
      const assistantMessage = await messagesService.addMessage(pageId, {
        role: 'assistant',
        content: '',
        parentMessageId,
        branchIndex: messagesService.getNextBranchIndex(
          messagesService.getMessages(pageId),
          parentMessageId
        ),
        modelId: llmConfig.id,
        modelConfigId: modelConfig?.id
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
          onComplete: async () => {
            const result = streamingManager.finish(assistantMessage.id)
            if (result) {
              await messagesService.updateMessage(pageId, assistantMessage.id, {
                content: result.content,
                reasoning_content: result.reasoning
              })
            }
          },
          onError: async (error) => {
            console.error('AI error:', error)
            const result = streamingManager.finish(assistantMessage.id)
            const errorContent = result?.content
              ? `${result.content}\n\n---\n\n**错误:** ${error.message}`
              : `**错误:** ${error.message}`
            await messagesService.updateMessage(pageId, assistantMessage.id, {
              content: errorContent,
              reasoning_content: result?.reasoning,
              hasError: true
            })
          }
        })
      } catch (error) {
        console.error('Streaming error:', error)
        const result = streamingManager.finish(assistantMessage.id)
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorContent = result?.content
          ? `${result.content}\n\n---\n\n**错误:** ${errorMessage}`
          : `**错误:** ${errorMessage}`
        await messagesService.updateMessage(pageId, assistantMessage.id, {
          content: errorContent,
          reasoning_content: result?.reasoning,
          hasError: true
        })
      }
    },
    [pageId]
  )

  const sendMessage = useCallback(
    async (
      content: string,
      options?: {
        parentId?: string
        attachments?: FileAttachment[]
        createBranch?: boolean
      }
    ) => {
      if (!page || !record) return

      const configs = getConfigs()
      if (!configs) {
        console.error('No LLM or Model config found')
        return
      }

      // createBranch=true 时使用 parentId（创建新分支），否则追加到当前分支末尾
      const parentId = options?.createBranch ? options.parentId : record.leafMessageId
      const isFirstMessage = messages.length === 0
      const attachments = options?.attachments

      // 添加用户消息（先使用临时路径）
      const userMessage = await messagesService.addMessage(pageId, {
        role: 'user',
        content,
        attachments,
        parentMessageId: parentId,
        branchIndex: messagesService.getNextBranchIndex(messages, parentId)
      })

      // 如果有附件，移动到正式目录并更新消息
      if (attachments && attachments.length > 0) {
        const movedAttachments = await Promise.all(
          attachments.map(async (attachment) => {
            const result = await window.api.attachment.move({
              fileId: attachment.id,
              fileName: attachment.name,
              fromPath: attachment.localPath,
              pageId,
              messageId: userMessage.id
            })
            if (result.success && result.localPath) {
              return { ...attachment, localPath: result.localPath }
            }
            return attachment
          })
        )
        // 更新消息中的附件路径
        await messagesService.updateMessage(pageId, userMessage.id, {
          attachments: movedAttachments
        })
      }

      // 第一条消息且标题是"新对话"时，自动重命名
      if (isFirstMessage && page.title === '新对话') {
        const newTitle = content.slice(0, 10) + (content.length > 10 ? '...' : '')
        pagesService.updatePage(pageId, { title: newTitle })
      }

      // 获取最新的消息路径
      const pathMessages = messagesService.getCurrentPath(pageId)

      await startStreaming(userMessage.id, pathMessages, configs.llmConfig, configs.modelConfig)
    },
    [page, pageId, record, messages, getConfigs, startStreaming]
  )

  const stopStreaming = useCallback(async () => {
    const streamingMsg = currentPath.find((msg) => streamingManager.isStreaming(msg.id))
    if (!streamingMsg) return

    const result = await streamingManager.stop(streamingMsg.id)

    if (result?.content) {
      await messagesService.updateMessage(pageId, streamingMsg.id, {
        content: result.content,
        reasoning_content: result.reasoning
      })
    } else {
      await messagesService.deleteMessage(pageId, streamingMsg.id)
    }
  }, [pageId, currentPath])

  const retryMessage = useCallback(
    async (messageId: string, llmId?: string, modelConfigId?: string) => {
      const message = messages.find((m) => m.id === messageId)
      if (!message || message.role !== 'assistant') return

      const userMessage = messages.find((m) => m.id === message.parentMessageId)
      if (!userMessage) return

      const targetLLMId = llmId ?? message.modelId ?? settings.defaultLLMId
      const llmConfig = settings.llmConfigs.items.find((c) => c.id === targetLLMId)
      if (!llmConfig) return

      const targetModelConfigId =
        modelConfigId ?? message.modelConfigId ?? settings.defaultModelConfigId
      const modelConfig = settings.modelConfigs.items.find((c) => c.id === targetModelConfigId)

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
    async (messageId: string, content: string, attachments?: FileAttachment[]) => {
      const message = messages.find((m) => m.id === messageId)
      if (!message) return

      // 如果有新增的附件（temp 目录），需要移动到正式目录
      let finalAttachments = attachments
      if (attachments && attachments.length > 0) {
        const needMove = attachments.filter((a) => a.localPath.includes('temp'))
        if (needMove.length > 0) {
          const movedAttachments = await Promise.all(
            attachments.map(async (attachment) => {
              if (attachment.localPath.includes('temp')) {
                const result = await window.api.attachment.move({
                  fileId: attachment.id,
                  fileName: attachment.name,
                  fromPath: attachment.localPath,
                  pageId,
                  messageId
                })
                if (result.success && result.localPath) {
                  return { ...attachment, localPath: result.localPath }
                }
              }
              return attachment
            })
          )
          finalAttachments = movedAttachments
        }
      }

      await messagesService.updateMessage(pageId, messageId, {
        content,
        attachments: finalAttachments
      })
    },
    [pageId, messages]
  )

  const editAndResend = useCallback(
    async (messageId: string, content: string, attachments?: FileAttachment[]) => {
      const message = messages.find((m) => m.id === messageId)
      if (!message || message.role !== 'user') return

      await sendMessage(content, {
        parentId: message.parentMessageId,
        attachments,
        createBranch: true
      })
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

  // ============ Title/Topic 操作方法 ============

  const updateTitle = useCallback(
    (messageId: string, title: string) => {
      updateMessageTitle(pageId, messageId, title)
    },
    [pageId]
  )

  const generateTitle = useCallback(
    async (messageId: string) => {
      const message = messages.find((m) => m.id === messageId)
      if (!message) return

      try {
        const result = await generateMessageTitle(message.content)
        if (result.success && result.title) {
          updateMessageTitle(pageId, messageId, result.title)
        } else if (result.error) {
          console.error('Failed to generate title:', result.error)
        }
      } catch (error) {
        console.error('Failed to generate title:', error)
      }
    },
    [pageId, messages]
  )

  const setAsTopic = useCallback(
    (messageId: string, topic: string) => {
      setMessageAsTopic(pageId, messageId, topic)
    },
    [pageId]
  )

  const removeTopic = useCallback(
    (messageId: string) => {
      removeTopicFromMessage(pageId, messageId)
    },
    [pageId]
  )

  const handleToggleTopicCollapse = useCallback(
    (messageId: string) => {
      toggleTopicCollapseService(pageId, messageId)
    },
    [pageId]
  )

  const generateTopic = useCallback(
    async (messageId: string) => {
      const message = messages.find((m) => m.id === messageId)
      if (!message) return

      try {
        const result = await generateTopicTitle(message.content)
        if (result.success && result.title) {
          setMessageAsTopic(pageId, messageId, result.title)
        } else if (result.error) {
          console.error('Failed to generate topic:', result.error)
        }
      } catch (error) {
        console.error('Failed to generate topic:', error)
      }
    },
    [pageId, messages]
  )

  // ============ 批量生成标题 ============
  const [batchProgress, setBatchProgress] = useState<{
    current: number
    total: number
  } | null>(null)

  const batchGenerateTitles = useCallback(async () => {
    // 筛选出没有标题的消息
    const messagesWithoutTitle = currentPath.filter((m) => !m.title)
    if (messagesWithoutTitle.length === 0) return

    const total = messagesWithoutTitle.length
    setBatchProgress({ current: 0, total })

    try {
      for (let i = 0; i < messagesWithoutTitle.length; i++) {
        const message = messagesWithoutTitle[i]
        setBatchProgress({ current: i, total })

        try {
          const result = await generateMessageTitle(message.content)
          if (result.success && result.title) {
            updateMessageTitle(pageId, message.id, result.title)
          }
        } catch (error) {
          console.error(`Failed to generate title for message ${message.id}:`, error)
        }

        // 添加小延迟避免请求过于频繁
        if (i < messagesWithoutTitle.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300))
        }
      }
    } finally {
      setBatchProgress(null)
    }
  }, [currentPath, pageId])

  // ============ 智能分段 ============
  const [isSegmenting, setIsSegmenting] = useState(false)

  const smartSegmentation = useCallback(async () => {
    if (currentPath.length === 0 || isSegmenting) return

    setIsSegmenting(true)
    try {
      const result = await analyzeTopicSegments(currentPath)
      if (result.success && result.segments.length > 0) {
        // 为每个分段点设置 Topic
        for (const segment of result.segments) {
          const message = currentPath[segment.index]
          if (message && !message.topic) {
            setMessageAsTopic(pageId, message.id, segment.topic)
          }
        }
      } else if (result.error) {
        console.error('Smart segmentation failed:', result.error)
      }
    } catch (error) {
      console.error('Smart segmentation error:', error)
    } finally {
      setIsSegmenting(false)
    }
  }, [currentPath, pageId, isSegmenting])

  return {
    page,
    messages,
    currentPath,
    isLoading,
    sendMessage,
    stopStreaming,
    retryMessage,
    continueMessage,
    deleteMessage,
    editMessage,
    editAndResend,
    switchBranch,
    getChildMessages,
    // Title/Topic 相关
    topicGroups,
    outline,
    updateTitle,
    generateTitle,
    setAsTopic,
    removeTopic,
    toggleTopicCollapse: handleToggleTopicCollapse,
    generateTopic,
    // 批量生成标题
    batchGenerateTitles,
    batchProgress,
    // 智能分段
    smartSegmentation,
    isSegmenting
  }
}
