import { useCallback, useState } from 'react'
import { updateMessageTitle } from '../services/messagesService'
import { generateMessageTitle, generateMessageTitleWithOptions } from '../services/titleService'
import type { ChatMessage } from '../types/type'

// 生成选项接口（与 useChatTopics 共享）
export interface GenerateOptions {
  extraRequirements?: string
  llmId?: string
  modelConfigId?: string
}

export interface UseChatTitlesOptions {
  pageId: string
  messages: ChatMessage[]
  currentPath: ChatMessage[]
}

export interface BatchProgress {
  current: number
  total: number
}

export interface UseChatTitlesResult {
  // 基础操作
  updateTitle: (messageId: string, title: string) => void
  deleteTitle: (messageId: string) => void
  // AI 生成标题（统一方法，支持可选的 options）
  generateTitle: (messageId: string, options?: GenerateOptions) => Promise<void>
  // 批量生成标题（统一方法，支持可选的 options）
  batchGenerateTitles: (options?: GenerateOptions) => Promise<void>
  batchProgress: BatchProgress | null
}

export function useChatTitles({
  pageId,
  messages,
  currentPath
}: UseChatTitlesOptions): UseChatTitlesResult {
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)

  const updateTitle = useCallback(
    (messageId: string, title: string) => {
      updateMessageTitle(pageId, messageId, title)
    },
    [pageId]
  )

  const deleteTitle = useCallback(
    (messageId: string) => {
      updateMessageTitle(pageId, messageId, '')
    },
    [pageId]
  )

  // 统一的 generateTitle 方法，通过 options 决定是否使用自定义配置
  const generateTitle = useCallback(
    async (messageId: string, options?: GenerateOptions) => {
      const message = messages.find((m) => m.id === messageId)
      if (!message) return

      try {
        const result =
          options?.llmId || options?.extraRequirements || options?.modelConfigId
            ? await generateMessageTitleWithOptions({
                content: message.content,
                extraRequirements: options.extraRequirements,
                llmId: options.llmId,
                modelConfigId: options.modelConfigId
              })
            : await generateMessageTitle(message.content)

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

  // 统一的批量生成标题方法，消除了原来两个几乎相同的方法
  const batchGenerateTitles = useCallback(
    async (options?: GenerateOptions) => {
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
            const result =
              options?.llmId || options?.extraRequirements || options?.modelConfigId
                ? await generateMessageTitleWithOptions({
                    content: message.content,
                    extraRequirements: options.extraRequirements,
                    llmId: options.llmId,
                    modelConfigId: options.modelConfigId
                  })
                : await generateMessageTitle(message.content)

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
    },
    [currentPath, pageId]
  )

  return {
    updateTitle,
    deleteTitle,
    generateTitle,
    batchGenerateTitles,
    batchProgress
  }
}
