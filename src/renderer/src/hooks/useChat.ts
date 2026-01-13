import { useCallback } from 'react'
import * as messagesService from '../services/messagesService'
import type { ChatMessage, Topic, TopicGroup, OutlineNode, FileAttachment } from '../types/type'
import type { PageRecord } from '../utils/database'

// 导入拆分的 hooks
import { useChatCore } from './useChatCore'
import { useChatStreaming, type SendMessageOptions } from './useChatStreaming'
import { useChatTopics, type GenerateOptions } from './useChatTopics'
import { useChatTitles } from './useChatTitles'

// 重新导出类型，保持向后兼容
export type { GenerateOptions } from './useChatTopics'

interface UseChatOptions {
  pageId: string
}

interface UseChatResult {
  // 基础状态
  page: PageRecord | undefined
  messages: ChatMessage[]
  currentPath: ChatMessage[]
  isLoading: boolean
  hasLLMConfig: boolean
  hasDefaultLLM: boolean

  // 消息操作
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>
  stopStreaming: () => Promise<void>
  retryMessage: (messageId: string, llmId?: string) => Promise<void>
  continueMessage: (messageId: string) => Promise<void>
  deleteMessage: (messageId: string) => void
  editMessage: (messageId: string, content: string, attachments?: FileAttachment[]) => void
  editAndResend: (
    messageId: string,
    content: string,
    attachments?: FileAttachment[]
  ) => Promise<void>
  switchBranch: (messageId: string) => void
  getChildMessages: (parentId: string | undefined) => ChatMessage[]

  // Title/Topic 相关状态
  topics: Topic[]
  topicGroups: TopicGroup[]
  outline: OutlineNode[]

  // Title 操作
  updateTitle: (messageId: string, title: string) => void
  generateTitle: (messageId: string, options?: GenerateOptions) => Promise<void>
  batchGenerateTitles: (options?: GenerateOptions) => Promise<void>
  batchProgress: { current: number; total: number } | null

  // Topic 操作
  createTopic: (messageId: string, name: string, indent?: number) => Promise<Topic | undefined>
  updateTopic: (topicId: string, updates: Partial<Omit<Topic, 'id'>>) => Promise<void>
  deleteTopic: (topicId: string) => Promise<void>
  toggleTopicCollapse: (topicId: string) => Promise<void>
  generateTopic: (messageId: string, options?: GenerateOptions) => Promise<void>
  findTopicByMessageId: (messageId: string) => Topic | undefined

  // 智能分段
  smartSegmentation: (options?: GenerateOptions) => Promise<void>
  isSegmenting: boolean

  // 向后兼容的别名方法（带 WithOptions 后缀）
  generateTitleWithOptions: (messageId: string, options: GenerateOptions) => Promise<void>
  generateTopicWithOptions: (messageId: string, options: GenerateOptions) => Promise<void>
  batchGenerateTitlesWithOptions: (options: GenerateOptions) => Promise<void>
  smartSegmentationWithOptions: (options: GenerateOptions) => Promise<void>
}

export function useChat({ pageId }: UseChatOptions): UseChatResult {
  // 1. 核心状态
  const core = useChatCore({ pageId })
  const {
    page,
    messages,
    currentPath,
    isLoading,
    record,
    topics,
    topicGroups,
    outline,
    getConfigs,
    getConfigsWithOverride,
    settings
  } = core

  // 检查 LLM 配置状态
  const hasLLMConfig = settings.llmConfigs.items.length > 0
  const hasDefaultLLM = settings.defaultLLMId !== undefined

  // 2. 流式通信
  const streaming = useChatStreaming({
    pageId,
    page,
    messages,
    currentPath,
    record,
    getConfigs,
    getConfigsWithOverride
  })

  // 3. Topic 管理
  const topicsHook = useChatTopics({
    pageId,
    messages,
    currentPath,
    topics
  })

  // 4. 标题生成
  const titles = useChatTitles({
    pageId,
    messages,
    currentPath
  })

  // 5. 消息操作（保留在主 hook 中，因为比较简单）
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

      await streaming.sendMessage(content, {
        parentId: message.parentMessageId,
        attachments,
        createBranch: true
      })
    },
    [messages, streaming]
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
    // 基础状态
    page,
    messages,
    currentPath,
    isLoading,
    hasLLMConfig,
    hasDefaultLLM,

    // 流式通信
    sendMessage: streaming.sendMessage,
    stopStreaming: streaming.stopStreaming,
    retryMessage: streaming.retryMessage,
    continueMessage: streaming.continueMessage,

    // 消息操作
    deleteMessage,
    editMessage,
    editAndResend,
    switchBranch,
    getChildMessages,

    // Topics 状态
    topics,
    topicGroups,
    outline,

    // Title 操作
    updateTitle: titles.updateTitle,
    generateTitle: titles.generateTitle,
    batchGenerateTitles: titles.batchGenerateTitles,
    batchProgress: titles.batchProgress,

    // Topic 操作
    createTopic: topicsHook.createTopic,
    updateTopic: topicsHook.updateTopic,
    deleteTopic: topicsHook.deleteTopic,
    toggleTopicCollapse: topicsHook.toggleTopicCollapse,
    generateTopic: topicsHook.generateTopic,
    findTopicByMessageId: topicsHook.findTopicByMessageId,

    // 智能分段
    smartSegmentation: topicsHook.smartSegmentation,
    isSegmenting: topicsHook.isSegmenting,

    // 向后兼容的别名方法（实际上调用相同的统一方法）
    generateTitleWithOptions: titles.generateTitle,
    generateTopicWithOptions: topicsHook.generateTopic,
    batchGenerateTitlesWithOptions: titles.batchGenerateTitles,
    smartSegmentationWithOptions: topicsHook.smartSegmentation
  }
}
