/**
 * 对话执行 Hook
 *
 * 只负责发起命令与维护请求句柄；流式内容与最终结果由内核事件写入镜像。
 */

import { useCallback, useRef } from 'react'
import { App } from 'antd'
import type { AttachmentRef, ChatMessage, Conversation } from '@shared/domain'
import { command, errorMessage } from '../runtime/client'
import { useMessagesStore } from '../stores/messagesStore'
import { usePagesStore } from '../stores/pagesStore'
import * as pagesService from '../services/pagesService'

const DEFAULT_SESSION_TITLE_PREVIEW_LENGTH = 30

export interface SendMessageOptions {
  parentId?: string
  attachments?: AttachmentRef[]
  createBranch?: boolean
  llmId?: string
  modelConfigId?: string
}

export interface UseChatStreamingOptions {
  pageId: string
  record: Conversation | undefined
  messages: ChatMessage[]
}

export interface UseChatStreamingResult {
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>
  stopStreaming: () => Promise<void>
  retryMessage: (messageId: string, llmId?: string, modelConfigId?: string) => Promise<void>
  continueMessage: (messageId: string) => Promise<void>
}

export function useChatStreaming({
  pageId,
  record,
  messages
}: UseChatStreamingOptions): UseChatStreamingResult {
  /** pageId -> 当前请求 id */
  const requests = useRef(new Map<string, string>())
  const { message: messageApi } = App.useApp()

  const sendMessage = useCallback(
    async (content: string, options?: SendMessageOptions) => {
      const parentMessageId = options?.createBranch ? options.parentId : record?.leafMessageId
      const isFirstMessage = messages.length === 0

      try {
        const currentPage = usePagesStore.getState().getById(pageId)
        const isDefaultName = currentPage ? /^新对话(?: \(\d+\))?$/.test(currentPage.name) : false
        if (isFirstMessage && isDefaultName && content.trim()) {
          const title =
            content.slice(0, DEFAULT_SESSION_TITLE_PREVIEW_LENGTH) +
            (content.length > DEFAULT_SESSION_TITLE_PREVIEW_LENGTH ? '...' : '')
          await pagesService.updatePage(pageId, { name: title })
        }

        const handle = await command('chat.send', {
          pageId,
          content,
          attachments: options?.attachments,
          parentMessageId,
          llmId: options?.llmId,
          modelConfigId: options?.modelConfigId
        })

        requests.current.set(pageId, handle.requestId)
        // 生成标记只打在本次请求的助手消息上
        useMessagesStore.getState().setStreaming(handle.messageId, true)
      } catch (error) {
        console.error('发送消息失败：', error)
        messageApi.error(`发送失败：${errorMessage(error)}`)
      }
    },
    [messageApi, pageId, record?.leafMessageId, messages.length]
  )

  const stopStreaming = useCallback(async () => {
    const requestId = requests.current.get(pageId)
    requests.current.delete(pageId)
    // 同时带上页面：即使这一轮生成由内核（消息队列）发起，也能停下
    await command('chat.stop', { requestId, pageId })
  }, [pageId])

  const retryMessage = useCallback(
    async (messageId: string, llmId?: string, modelConfigId?: string) => {
      try {
        const handle = await command('chat.regenerate', {
          pageId,
          messageId,
          llmId,
          modelConfigId
        })
        requests.current.set(pageId, handle.requestId)
        useMessagesStore.getState().setStreaming(handle.messageId, true)
      } catch (error) {
        console.error('重新生成失败：', error)
        messageApi.error(`重新生成失败：${errorMessage(error)}`)
      }
    },
    [messageApi, pageId]
  )

  const continueMessage = useCallback(
    async (messageId: string) => {
      try {
        const handle = await command('chat.continue', { pageId, messageId })
        requests.current.set(pageId, handle.requestId)
        useMessagesStore.getState().setStreaming(handle.messageId, true)
      } catch (error) {
        console.error('继续生成失败：', error)
        messageApi.error(`继续生成失败：${errorMessage(error)}`)
      }
    },
    [messageApi, pageId]
  )

  return { sendMessage, stopStreaming, retryMessage, continueMessage }
}
