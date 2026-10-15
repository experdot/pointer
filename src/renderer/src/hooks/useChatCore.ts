import { useCallback, useEffect, useMemo } from 'react'
import type { ChatMessage, Conversation, OutlineNode, Topic, TopicGroup } from '@shared/domain'
import { emptyConversation } from '@shared/domain'
import { useMessagesStore } from '../stores/messagesStore'
import { usePagesStore } from '../stores/pagesStore'
import { useSettingsStore } from '../stores/settingsStore'
import * as messagesService from '../services/messagesService'

interface UseChatCoreOptions {
  pageId: string
}

interface ChatConfigs {
  llmId: string
  modelConfigId?: string
}

interface UseChatCoreResult {
  page: ReturnType<typeof usePagesStore.getState>['pages'][number] | undefined
  messages: ChatMessage[]
  currentPath: ChatMessage[]
  isLoading: boolean
  record: Conversation | undefined
  topics: Topic[]
  topicGroups: TopicGroup[]
  outline: OutlineNode[]
  getConfigs: () => ChatConfigs | null
  getConfigsWithOverride: (llmId?: string, modelConfigId?: string) => ChatConfigs | null
  settings: ReturnType<typeof useSettingsStore.getState>['settings']
}

export function useChatCore({ pageId }: UseChatCoreOptions): UseChatCoreResult {
  const pages = usePagesStore((state) => state.pages)
  const cache = useMessagesStore((state) => state.cache)
  const load = useMessagesStore((state) => state.load)
  const settings = useSettingsStore((state) => state.settings)

  const page = useMemo(() => pages.find((item) => item.id === pageId), [pages, pageId])
  const record = cache[pageId]
  const messages = useMemo(() => record?.messages ?? [], [record])
  const isLoading = !record

  useEffect(() => {
    if (!record && pageId) void load(pageId)
  }, [pageId, record, load])

  const currentPath = useMemo(() => {
    if (!record) return []
    return messagesService.getMessagePath(record.messages, record.leafMessageId)
  }, [record])

  const topics = useMemo(() => record?.topics ?? [], [record])

  const topicGroups = useMemo(
    () => messagesService.computeTopicGroups(topics, currentPath),
    [topics, currentPath]
  )

  const outline = useMemo(
    () => messagesService.computeOutline(topicGroups, currentPath),
    [topicGroups, currentPath]
  )

  const getConfigs = useCallback((): ChatConfigs | null => {
    const llmId = settings.defaultLLMId ?? settings.llmConfigs.items[0]?.id
    if (!llmId) return null
    return {
      llmId,
      modelConfigId: settings.defaultModelConfigId ?? settings.modelConfigs.items[0]?.id
    }
  }, [settings])

  const getConfigsWithOverride = useCallback(
    (llmId?: string, modelConfigId?: string): ChatConfigs | null => {
      const targetLlmId = llmId ?? settings.defaultLLMId ?? settings.llmConfigs.items[0]?.id
      if (!targetLlmId) return null
      return {
        llmId: targetLlmId,
        modelConfigId: modelConfigId ?? settings.defaultModelConfigId
      }
    },
    [settings]
  )

  return {
    page,
    messages,
    currentPath,
    isLoading,
    record: record ?? (isLoading ? undefined : emptyConversation(pageId)),
    topics,
    topicGroups,
    outline,
    getConfigs,
    getConfigsWithOverride,
    settings
  }
}
