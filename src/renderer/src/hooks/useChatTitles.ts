import { useCallback, useState } from 'react'
import { App } from 'antd'
import type { ChatMessage } from '@shared/domain'
import { currentGeneration } from '../runtime/generation'
import { updateMessageTitle } from '../services/messagesService'
import { generateMessageTitle } from '../services/titleService'

export interface GenerateOptions {
  extraRequirements?: string
  llmId?: string
  modelConfigId?: string
}

interface UseChatTitlesOptions {
  pageId: string
  messages: ChatMessage[]
  currentPath: ChatMessage[]
}

interface BatchProgress {
  current: number
  total: number
}

interface UseChatTitlesResult {
  updateTitle: (messageId: string, title: string) => void
  deleteTitle: (messageId: string) => void
  generateTitle: (messageId: string, options?: GenerateOptions) => Promise<void>
  batchGenerateTitles: (options?: GenerateOptions) => Promise<void>
  batchProgress: BatchProgress | null
}

export function useChatTitles({ pageId, currentPath }: UseChatTitlesOptions): UseChatTitlesResult {
  const { message } = App.useApp()
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)

  const updateTitle = useCallback(
    (messageId: string, title: string) => {
      void updateMessageTitle(pageId, messageId, title)
    },
    [pageId]
  )

  const deleteTitle = useCallback(
    (messageId: string) => {
      void updateMessageTitle(pageId, messageId, '')
    },
    [pageId]
  )

  const generateTitle = useCallback(
    async (messageId: string, options: GenerateOptions = {}) => {
      const result = await generateMessageTitle(pageId, messageId, options)
      if (!result.success) {
        console.error('生成标题失败：', result.error)
        message.error(`生成标题失败：${result.error ?? '未知原因'}`)
      }
    },
    [message, pageId]
  )

  const batchGenerateTitles = useCallback(
    async (options: GenerateOptions = {}) => {
      const pending = currentPath.filter((message) => !message.title)
      if (pending.length === 0) return

      setBatchProgress({ current: 0, total: pending.length })
      const generation = currentGeneration()
      const failures: string[] = []

      try {
        for (let index = 0; index < pending.length; index++) {
          if (generation !== currentGeneration()) break
          setBatchProgress({ current: index, total: pending.length })
          const result = await generateMessageTitle(pageId, pending[index].id, options)
          if (!result.success) {
            console.error('批量生成标题失败：', result.error)
            if (result.error) failures.push(result.error)
          }
          if (index < pending.length - 1) await new Promise((resolve) => setTimeout(resolve, 300))
        }
      } finally {
        setBatchProgress(null)
      }

      if (failures.length > 0) {
        message.warning(`有 ${failures.length} 条标题生成失败：${failures[0]}`)
      }
    },
    [currentPath, message, pageId]
  )

  return { updateTitle, deleteTitle, generateTitle, batchGenerateTitles, batchProgress }
}
