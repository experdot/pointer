import { useCallback, useState } from 'react'
import * as messagesService from '../services/messagesService'
import {
  generateTopicTitle,
  generateTopicTitleWithOptions,
  analyzeTopicSegments,
  analyzeTopicSegmentsWithOptions
} from '../services/titleService'
import type { ChatMessage, Topic } from '../types/type'

// 生成选项接口
export interface GenerateOptions {
  extraRequirements?: string
  llmId?: string
  modelConfigId?: string
}

export interface UseChatTopicsOptions {
  pageId: string
  messages: ChatMessage[]
  currentPath: ChatMessage[]
  topics: Topic[]
}

export interface UseChatTopicsResult {
  // Topic CRUD
  createTopic: (messageId: string, name: string, indent?: number) => Promise<Topic | undefined>
  updateTopic: (topicId: string, updates: Partial<Omit<Topic, 'id'>>) => Promise<void>
  deleteTopic: (topicId: string) => Promise<void>
  toggleTopicCollapse: (topicId: string) => Promise<void>
  // Topic 查询
  findTopicByMessageId: (messageId: string) => Topic | undefined
  // AI 生成 Topic
  generateTopic: (messageId: string, options?: GenerateOptions) => Promise<void>
  // 智能分段
  smartSegmentation: (options?: GenerateOptions) => Promise<void>
  isSegmenting: boolean
}

export function useChatTopics({
  pageId,
  messages,
  currentPath,
  topics
}: UseChatTopicsOptions): UseChatTopicsResult {
  const [isSegmenting, setIsSegmenting] = useState(false)

  const createTopic = useCallback(
    async (messageId: string, name: string, indent: number = 0): Promise<Topic | undefined> => {
      try {
        return await messagesService.createTopic(pageId, name, messageId, indent)
      } catch (error) {
        console.error('Failed to create topic:', error)
        return undefined
      }
    },
    [pageId]
  )

  const updateTopic = useCallback(
    async (topicId: string, updates: Partial<Omit<Topic, 'id'>>) => {
      try {
        await messagesService.updateTopic(pageId, topicId, updates)
      } catch (error) {
        console.error('Failed to update topic:', error)
      }
    },
    [pageId]
  )

  const deleteTopic = useCallback(
    async (topicId: string) => {
      try {
        await messagesService.deleteTopic(pageId, topicId)
      } catch (error) {
        console.error('Failed to delete topic:', error)
      }
    },
    [pageId]
  )

  const toggleTopicCollapse = useCallback(
    async (topicId: string) => {
      try {
        await messagesService.toggleTopicCollapse(pageId, topicId)
      } catch (error) {
        console.error('Failed to toggle topic collapse:', error)
      }
    },
    [pageId]
  )

  const findTopicByMessageId = useCallback(
    (messageId: string): Topic | undefined => {
      return messagesService.findTopicByStartMessageId(topics, messageId)
    },
    [topics]
  )

  // 统一的 generateTopic 方法，通过 options 决定是否使用自定义配置
  const generateTopic = useCallback(
    async (messageId: string, options?: GenerateOptions) => {
      const message = messages.find((m) => m.id === messageId)
      if (!message) return

      try {
        const result =
          options?.llmId || options?.extraRequirements || options?.modelConfigId
            ? await generateTopicTitleWithOptions({
                content: message.content,
                extraRequirements: options.extraRequirements,
                llmId: options.llmId,
                modelConfigId: options.modelConfigId
              })
            : await generateTopicTitle(message.content)

        if (result.success && result.title) {
          // 检查是否已存在以该消息为起始的 Topic
          const existingTopic = topics.find((t) => t.startMessageId === messageId)
          if (existingTopic) {
            await messagesService.updateTopic(pageId, existingTopic.id, { name: result.title })
          } else {
            await messagesService.createTopic(pageId, result.title, messageId)
          }
        } else if (result.error) {
          console.error('Failed to generate topic:', result.error)
        }
      } catch (error) {
        console.error('Failed to generate topic:', error)
      }
    },
    [pageId, messages, topics]
  )

  // 统一的智能分段方法
  const smartSegmentation = useCallback(
    async (options?: GenerateOptions) => {
      if (currentPath.length === 0 || isSegmenting) return

      setIsSegmenting(true)
      try {
        const result =
          options?.llmId || options?.extraRequirements || options?.modelConfigId
            ? await analyzeTopicSegmentsWithOptions(currentPath, {
                extraRequirements: options.extraRequirements,
                llmId: options.llmId,
                modelConfigId: options.modelConfigId
              })
            : await analyzeTopicSegments(currentPath)

        if (result.success && result.segments.length > 0) {
          // 为每个分段点创建 Topic
          for (const segment of result.segments) {
            const message = currentPath[segment.index]
            // 检查该消息是否已经有 Topic
            const existingTopic = messagesService.findTopicByStartMessageId(topics, message.id)
            if (message && !existingTopic) {
              await messagesService.createTopic(pageId, segment.topic, message.id)
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
    },
    [currentPath, topics, pageId, isSegmenting]
  )

  return {
    createTopic,
    updateTopic,
    deleteTopic,
    toggleTopicCollapse,
    findTopicByMessageId,
    generateTopic,
    smartSegmentation,
    isSegmenting
  }
}
