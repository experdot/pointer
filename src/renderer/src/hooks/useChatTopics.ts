import { useCallback, useState } from 'react'
import { App } from 'antd'
import type { ChatMessage, Topic } from '@shared/domain'
import { currentGeneration } from '../runtime/generation'
import * as messagesService from '../services/messagesService'
import { analyzeTopicSegments } from '../services/titleService'

export interface GenerateOptions {
  extraRequirements?: string
  llmId?: string
  modelConfigId?: string
}

interface UseChatTopicsOptions {
  pageId: string
  messages: ChatMessage[]
  currentPath: ChatMessage[]
  topics: Topic[]
}

interface UseChatTopicsResult {
  createTopic: (messageId: string, name: string) => Promise<Topic | undefined>
  updateTopic: (topicId: string, updates: Partial<Omit<Topic, 'id'>>) => Promise<void>
  deleteTopic: (topicId: string) => Promise<void>
  toggleTopicCollapse: (topicId: string) => Promise<void>
  findTopicByMessageId: (messageId: string) => Topic | undefined
  generateTopic: (messageId: string, options?: GenerateOptions) => Promise<void>
  smartSegmentation: (options?: GenerateOptions) => Promise<void>
  isSegmenting: boolean
}

export function useChatTopics({
  pageId,
  currentPath,
  topics
}: UseChatTopicsOptions): UseChatTopicsResult {
  const { message } = App.useApp()
  const [isSegmenting, setIsSegmenting] = useState(false)

  const createTopic = useCallback(
    async (messageId: string, name: string): Promise<Topic | undefined> => {
      try {
        return await messagesService.createTopic(pageId, { name, startMessageId: messageId })
      } catch (error) {
        console.error('创建话题失败：', error)
        return undefined
      }
    },
    [pageId]
  )

  const updateTopic = useCallback(
    async (topicId: string, updates: Partial<Omit<Topic, 'id'>>) => {
      await messagesService.updateTopic(pageId, topicId, {
        name: updates.name,
        endMessageId: updates.endMessageId,
        collapsed: updates.collapsed
      })
    },
    [pageId]
  )

  const deleteTopic = useCallback(
    async (topicId: string) => {
      await messagesService.deleteTopic(pageId, topicId)
    },
    [pageId]
  )

  const toggleTopicCollapse = useCallback(
    async (topicId: string) => {
      await messagesService.toggleTopicCollapse(pageId, topicId)
    },
    [pageId]
  )

  const findTopicByMessageId = useCallback(
    (messageId: string): Topic | undefined =>
      messagesService.findTopicByStartMessageId(topics, messageId),
    [topics]
  )

  const generateTopic = useCallback(
    async (messageId: string, options: GenerateOptions = {}) => {
      const generation = currentGeneration()
      try {
        const existing = topics.find((topic) => topic.startMessageId === messageId)
        if (existing) {
          const { generateTopicTitle } = await import('../services/titleService')
          const result = await generateTopicTitle(pageId, existing.id, options)
          if (!result.success) {
            console.error('生成话题名称失败：', result.error)
            message.error(`生成话题名称失败：${result.error ?? '未知原因'}`)
          }
          return
        }

        // 尚无 Topic：先由内核基于消息内容生成名称，再创建
        const { command } = await import('../runtime/client')
        const { TOPIC_TITLE_PROMPT, applyExtraRequirements, buildPrompt, normalizeTitle } =
          await import('@shared/domain')
        const targetMessage = currentPath.find((item) => item.id === messageId)
        if (!targetMessage) return

        const { content } = await command('ai.generateText', {
          prompt: applyExtraRequirements(
            buildPrompt(TOPIC_TITLE_PROMPT, targetMessage.content),
            options.extraRequirements
          ),
          llmId: options.llmId,
          modelConfigId: options.modelConfigId
        })

        const name = normalizeTitle(content, 15)
        if (generation !== currentGeneration()) return
        if (!name) {
          message.error('生成话题名称失败：模型未返回有效内容')
          return
        }
        await messagesService.createTopic(pageId, { name, startMessageId: messageId })
      } catch (error) {
        console.error('生成话题失败：', error)
        message.error(`生成话题失败：${error instanceof Error ? error.message : String(error)}`)
      }
    },
    [currentPath, message, pageId, topics]
  )

  const smartSegmentation = useCallback(
    async (options: GenerateOptions = {}) => {
      if (currentPath.length === 0 || isSegmenting) return
      setIsSegmenting(true)

      try {
        const generation = currentGeneration()
        const result = await analyzeTopicSegments(pageId, currentPath, options)
        if (generation !== currentGeneration()) return
        if (!result.success) {
          console.error('智能分段失败：', result.error)
          message.error(`智能分段失败：${result.error ?? '未知原因'}`)
          return
        }

        for (const segment of result.segments) {
          const message = currentPath[segment.index]
          if (!message) continue
          const existing = messagesService.findTopicByStartMessageId(topics, message.id)
          if (!existing) {
            await messagesService.createTopic(pageId, {
              name: segment.topic,
              startMessageId: message.id
            })
          }
        }
      } catch (error) {
        console.error('智能分段失败：', error)
        message.error(`智能分段失败：${error instanceof Error ? error.message : String(error)}`)
      } finally {
        setIsSegmenting(false)
      }
    },
    [currentPath, isSegmenting, message, pageId, topics]
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
