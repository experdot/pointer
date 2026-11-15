import { t, useI18n } from '@renderer/i18n'
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
  useI18n()

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
        message.error(
          t('chat.titleFailed', { v0: String(result.error ?? t('common.unknownReason')) })
        )
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
        message.warning(
          t('chat.titlesFailed', { v0: String(failures.length), v1: String(failures[0]) })
        )
      }
    },
    [currentPath, message, pageId]
  )

  return { updateTitle, deleteTitle, generateTitle, batchGenerateTitles, batchProgress }
}
