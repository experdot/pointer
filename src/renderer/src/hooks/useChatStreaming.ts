import { useCallback } from 'react'
import { createAIService } from '../services/aiService'
import * as messagesService from '../services/messagesService'
import * as pagesService from '../services/pagesService'
import { streamingManager } from '../services/streamingManager'
import type { ChatMessage, LLMConfig, ModelConfig, FileAttachment } from '../types/type'
import type { PageRecord, MessagesRecord } from '../utils/database'
import type { ChatConfigs } from './useChatCore'

export interface UseChatStreamingOptions {
  pageId: string
  page: PageRecord | undefined
  messages: ChatMessage[]
  currentPath: ChatMessage[]
  record: MessagesRecord | undefined
  getConfigs: () => ChatConfigs | null
  getConfigsWithOverride: (llmId?: string, modelConfigId?: string) => ChatConfigs | null
}

export interface SendMessageOptions {
  parentId?: string
  attachments?: FileAttachment[]
  /** 是否创建新分支（使用 parentId 而非 leafMessageId） */
  createBranch?: boolean
}

export interface UseChatStreamingResult {
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>
  stopStreaming: () => Promise<void>
  retryMessage: (messageId: string, llmId?: string, modelConfigId?: string) => Promise<void>
  continueMessage: (messageId: string) => Promise<void>
}

export function useChatStreaming({
  pageId,
  page,
  messages,
  currentPath,
  record,
  getConfigs,
  getConfigsWithOverride
}: UseChatStreamingOptions): UseChatStreamingResult {
  const startStreaming = useCallback(
    async (
      parentMessageId: string,
      pathMessages: ChatMessage[],
      llmConfig: LLMConfig,
      modelConfig: ModelConfig | undefined
    ) => {
      // 1. 创建空的 assistant 消息
      const assistantMessage = await messagesService.addMessage(pageId, {
        role: 'assistant',
        content: '',
        parentMessageId,
        branchIndex: messagesService.getNextBranchIndex(
          messagesService.getMessages(pageId),
          parentMessageId
        ),
        modelId: llmConfig.id,
        modelConfigId: modelConfig?.id
      })

      // 2. 开始 streaming
      const aiService = createAIService(llmConfig, modelConfig)
      streamingManager.start(assistantMessage.id, aiService)

      try {
        await aiService.sendMessage(pathMessages, {
          onChunk: (chunk) => {
            const current = streamingManager.get(assistantMessage.id)
            streamingManager.update(
              assistantMessage.id,
              (current?.content ?? '') + chunk,
              current?.reasoning
            )
          },
          onReasoning: (reasoning) => {
            const current = streamingManager.get(assistantMessage.id)
            streamingManager.update(
              assistantMessage.id,
              current?.content ?? '',
              (current?.reasoning ?? '') + reasoning
            )
          },
          onComplete: async () => {
            const result = streamingManager.finish(assistantMessage.id)
            if (result) {
              await messagesService.updateMessage(pageId, assistantMessage.id, {
                content: result.content,
                reasoning_content: result.reasoning
              })
            }
          },
          onError: async (error) => {
            console.error('AI error:', error)
            const result = streamingManager.finish(assistantMessage.id)
            const errorContent = result?.content
              ? `${result.content}\n\n---\n\n**错误:** ${error.message}`
              : `**错误:** ${error.message}`
            await messagesService.updateMessage(pageId, assistantMessage.id, {
              content: errorContent,
              reasoning_content: result?.reasoning,
              hasError: true
            })
          }
        })
      } catch (error) {
        console.error('Streaming error:', error)
        const result = streamingManager.finish(assistantMessage.id)
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorContent = result?.content
          ? `${result.content}\n\n---\n\n**错误:** ${errorMessage}`
          : `**错误:** ${errorMessage}`
        await messagesService.updateMessage(pageId, assistantMessage.id, {
          content: errorContent,
          reasoning_content: result?.reasoning,
          hasError: true
        })
      }
    },
    [pageId]
  )

  const sendMessage = useCallback(
    async (content: string, options?: SendMessageOptions) => {
      if (!page || !record) return

      const configs = getConfigs()
      if (!configs) {
        console.error('No LLM or Model config found')
        return
      }

      // createBranch=true 时使用 parentId（创建新分支），否则追加到当前分支末尾
      const parentId = options?.createBranch ? options.parentId : record.leafMessageId
      const isFirstMessage = messages.length === 0
      const attachments = options?.attachments

      // 添加用户消息（先使用临时路径）
      const userMessage = await messagesService.addMessage(pageId, {
        role: 'user',
        content,
        attachments,
        parentMessageId: parentId,
        branchIndex: messagesService.getNextBranchIndex(messages, parentId)
      })

      // 如果有附件，移动到正式目录并更新消息
      if (attachments && attachments.length > 0) {
        const movedAttachments = await Promise.all(
          attachments.map(async (attachment) => {
            const result = await window.api.attachment.move({
              fileId: attachment.id,
              fileName: attachment.name,
              fromPath: attachment.localPath,
              pageId,
              messageId: userMessage.id
            })
            if (result.success && result.localPath) {
              return { ...attachment, localPath: result.localPath }
            }
            return attachment
          })
        )
        // 更新消息中的附件路径
        await messagesService.updateMessage(pageId, userMessage.id, {
          attachments: movedAttachments
        })
      }

      // 第一条消息且标题是"新对话"时，自动重命名
      if (isFirstMessage && page.title === '新对话') {
        const newTitle = content.slice(0, 10) + (content.length > 10 ? '...' : '')
        pagesService.updatePage(pageId, { title: newTitle })
      }

      // 获取最新的消息路径
      const pathMessages = messagesService.getCurrentPath(pageId)

      await startStreaming(userMessage.id, pathMessages, configs.llmConfig, configs.modelConfig)
    },
    [page, pageId, record, messages, getConfigs, startStreaming]
  )

  const stopStreaming = useCallback(async () => {
    const streamingMsg = currentPath.find((msg) => streamingManager.isStreaming(msg.id))
    if (!streamingMsg) return

    const result = await streamingManager.stop(streamingMsg.id)

    if (result?.content) {
      await messagesService.updateMessage(pageId, streamingMsg.id, {
        content: result.content,
        reasoning_content: result.reasoning
      })
    } else {
      await messagesService.deleteMessage(pageId, streamingMsg.id)
    }
  }, [pageId, currentPath])

  const retryMessage = useCallback(
    async (messageId: string, llmId?: string, modelConfigId?: string) => {
      const message = messages.find((m) => m.id === messageId)
      if (!message || message.role !== 'assistant') return

      const userMessage = messages.find((m) => m.id === message.parentMessageId)
      if (!userMessage) return

      const configs = getConfigsWithOverride(
        llmId ?? message.modelId,
        modelConfigId ?? message.modelConfigId
      )
      if (!configs) return

      const pathToUser = messagesService.getMessagePath(messages, userMessage.id)
      await startStreaming(userMessage.id, pathToUser, configs.llmConfig, configs.modelConfig)
    },
    [messages, getConfigsWithOverride, startStreaming]
  )

  const continueMessage = useCallback(
    async (messageId: string) => {
      const message = messages.find((m) => m.id === messageId)
      if (!message || message.role !== 'user') return

      const configs = getConfigs()
      if (!configs) return

      const pathToUser = messagesService.getMessagePath(messages, message.id)
      await startStreaming(message.id, pathToUser, configs.llmConfig, configs.modelConfig)
    },
    [messages, getConfigs, startStreaming]
  )

  return {
    sendMessage,
    stopStreaming,
    retryMessage,
    continueMessage
  }
}
