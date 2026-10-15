import { useCallback } from 'react'
import type { AttachmentRef, ChatMessage, OutlineNode, Topic, TopicGroup } from '@shared/domain'
import * as messagesService from '../services/messagesService'
import { useChatCore } from './useChatCore'
import { useChatStreaming, type SendMessageOptions } from './useChatStreaming'
import { useChatTopics, type GenerateOptions } from './useChatTopics'
import { useChatTitles } from './useChatTitles'

export type { GenerateOptions } from './useChatTopics'

interface UseChatOptions {
  pageId: string
}

interface UseChatResult {
  page: ReturnType<typeof useChatCore>['page']
  messages: ChatMessage[]
  currentPath: ChatMessage[]
  isLoading: boolean
  hasLLMConfig: boolean
  hasDefaultLLM: boolean

  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>
  stopStreaming: () => Promise<void>
  retryMessage: (messageId: string, llmId?: string, modelConfigId?: string) => Promise<void>
  continueMessage: (messageId: string) => Promise<void>
  deleteMessage: (messageId: string) => void
  editMessage: (messageId: string, content: string, attachments?: AttachmentRef[]) => Promise<void>
  editAndResend: (
    messageId: string,
    content: string,
    attachments?: AttachmentRef[]
  ) => Promise<void>
  switchBranch: (messageId: string) => void
  getChildMessages: (parentId: string | undefined) => ChatMessage[]

  topics: Topic[]
  topicGroups: TopicGroup[]
  outline: OutlineNode[]

  updateTitle: (messageId: string, title: string) => void
  deleteTitle: (messageId: string) => void
  generateTitle: (messageId: string, options?: GenerateOptions) => Promise<void>
  batchGenerateTitles: (options?: GenerateOptions) => Promise<void>
  batchProgress: { current: number; total: number } | null

  createTopic: (messageId: string, name: string) => Promise<Topic | undefined>
  updateTopic: (topicId: string, updates: Partial<Omit<Topic, 'id'>>) => Promise<void>
  deleteTopic: (topicId: string) => Promise<void>
  toggleTopicCollapse: (topicId: string) => Promise<void>
  generateTopic: (messageId: string, options?: GenerateOptions) => Promise<void>
  findTopicByMessageId: (messageId: string) => Topic | undefined

  smartSegmentation: (options?: GenerateOptions) => Promise<void>
  isSegmenting: boolean
}

export function useChat({ pageId }: UseChatOptions): UseChatResult {
  const core = useChatCore({ pageId })
  const { page, messages, currentPath, isLoading, record, topics, topicGroups, outline, settings } =
    core

  const hasLLMConfig = settings.llmConfigs.items.length > 0
  const hasDefaultLLM = settings.defaultLLMId !== undefined

  const streaming = useChatStreaming({ pageId, record, messages })
  const topicsHook = useChatTopics({ pageId, messages, currentPath, topics })
  const titles = useChatTitles({ pageId, messages, currentPath })

  const deleteMessage = useCallback(
    (messageId: string) => {
      void messagesService.deleteMessage(pageId, messageId)
    },
    [pageId]
  )

  const editMessage = useCallback(
    async (messageId: string, content: string, attachments?: AttachmentRef[]) => {
      await messagesService.updateMessage(pageId, messageId, { content, attachments })
    },
    [pageId]
  )

  const editAndResend = useCallback(
    async (messageId: string, content: string, attachments?: AttachmentRef[]) => {
      const message = messages.find((item) => item.id === messageId)
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
      void messagesService.switchBranch(pageId, messageId)
    },
    [pageId]
  )

  const getChildMessages = useCallback(
    (parentId: string | undefined) => messagesService.getChildMessages(messages, parentId),
    [messages]
  )

  return {
    page,
    messages,
    currentPath,
    isLoading,
    hasLLMConfig,
    hasDefaultLLM,

    sendMessage: streaming.sendMessage,
    stopStreaming: streaming.stopStreaming,
    retryMessage: streaming.retryMessage,
    continueMessage: streaming.continueMessage,

    deleteMessage,
    editMessage,
    editAndResend,
    switchBranch,
    getChildMessages,

    topics,
    topicGroups,
    outline,

    updateTitle: titles.updateTitle,
    deleteTitle: titles.deleteTitle,
    generateTitle: titles.generateTitle,
    batchGenerateTitles: titles.batchGenerateTitles,
    batchProgress: titles.batchProgress,

    createTopic: topicsHook.createTopic,
    updateTopic: topicsHook.updateTopic,
    deleteTopic: topicsHook.deleteTopic,
    toggleTopicCollapse: topicsHook.toggleTopicCollapse,
    generateTopic: topicsHook.generateTopic,
    findTopicByMessageId: topicsHook.findTopicByMessageId,

    smartSegmentation: topicsHook.smartSegmentation,
    isSegmenting: topicsHook.isSegmenting
  }
}
