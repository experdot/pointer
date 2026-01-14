import { useMemo, useEffect, useCallback } from 'react'
import { usePagesStore } from '../stores/pagesStore'
import { useMessagesStore } from '../stores/messagesStore'
import { useSettingsStore } from '../stores/settingsStore'
import * as messagesService from '../services/messagesService'
import type {
  ChatMessage,
  Topic,
  LLMConfig,
  ModelConfig,
  TopicGroup,
  OutlineNode
} from '../types/type'
import type { PageRecord } from '../persistence/interfaces/userData'

export interface UseChatCoreOptions {
  pageId: string
}

export interface ChatConfigs {
  llmConfig: LLMConfig
  modelConfig: ModelConfig | undefined
}

export interface UseChatCoreResult {
  // 基础状态
  page: PageRecord | undefined
  messages: ChatMessage[]
  currentPath: ChatMessage[]
  isLoading: boolean
  record: ReturnType<typeof useMessagesStore.getState>['cache'][string] | undefined
  // Topics 相关
  topics: Topic[]
  topicGroups: TopicGroup[]
  outline: OutlineNode[]
  // 配置获取
  getConfigs: () => ChatConfigs | null
  getConfigsWithOverride: (llmId?: string, modelConfigId?: string) => ChatConfigs | null
  // 设置访问
  settings: ReturnType<typeof useSettingsStore.getState>['settings']
}

export function useChatCore({ pageId }: UseChatCoreOptions): UseChatCoreResult {
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

  // Topics
  const topics = useMemo(() => record?.topics ?? [], [record?.topics])

  // Topic 分组和大纲计算
  const topicGroups = useMemo(() => {
    return messagesService.computeTopicGroups(topics, currentPath)
  }, [topics, currentPath])

  const outline = useMemo(() => {
    return messagesService.computeOutline(topicGroups, currentPath)
  }, [topicGroups, currentPath])

  // 获取默认配置
  const getConfigs = useCallback((): ChatConfigs | null => {
    const llmConfig = settings.llmConfigs.items.find((c) => c.id === settings.defaultLLMId)
    if (!llmConfig) return null

    const modelConfig = settings.modelConfigs.items.find(
      (c) => c.id === settings.defaultModelConfigId
    )

    return { llmConfig, modelConfig }
  }, [settings])

  // 获取配置（支持覆盖）
  const getConfigsWithOverride = useCallback(
    (llmId?: string, modelConfigId?: string): ChatConfigs | null => {
      const targetLLMId = llmId ?? settings.defaultLLMId
      const llmConfig = settings.llmConfigs.items.find((c) => c.id === targetLLMId)
      if (!llmConfig) return null

      const targetModelConfigId = modelConfigId ?? settings.defaultModelConfigId
      const modelConfig = settings.modelConfigs.items.find((c) => c.id === targetModelConfigId)

      return { llmConfig, modelConfig }
    },
    [settings]
  )

  return {
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
  }
}
