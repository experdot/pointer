/**
 * 会话 Store
 *
 * cache 中保存每个页面的会话镜像；流式内容通过 chat.delta 事件追加。
 */

import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { ChatMessage, Conversation, MessageDraft, Topic } from '@shared/domain'
import { emptyConversation } from '@shared/domain'
import type { MessagePatch } from '@shared/contracts'
import { command, query } from '../runtime/client'

interface MessagesState {
  cache: Record<string, Conversation>
  /** messageId -> 是否正在生成 */
  streaming: Record<string, boolean>
}

interface MessagesActions {
  load: (pageId: string) => Promise<Conversation>
  get: (pageId: string) => Conversation | undefined
  has: (pageId: string) => boolean
  setConversation: (conversation: Conversation) => void
  upsertMessage: (pageId: string, message: ChatMessage) => void
  /** 批量追加流式增量（镜像层合并后一次性写入，避免每个分片都触发渲染） */
  applyDeltas: (entries: DeltaBatchEntry[]) => void
  setStreaming: (messageId: string, streaming: boolean) => void
  isStreaming: (messageId: string) => boolean
  evict: (pageId: string) => void
  reset: () => void

  addMessage: (
    pageId: string,
    draft: Omit<MessageDraft, 'id'> & { id?: string }
  ) => Promise<ChatMessage>
  replaceConversation: (pageId: string, conversation: Conversation) => Promise<void>
  updateMessage: (pageId: string, messageId: string, patch: MessagePatch) => Promise<void>
  updateMessages: (pageId: string, messageIds: string[], patch: MessagePatch) => Promise<void>
  deleteMessage: (pageId: string, messageId: string) => Promise<void>
  setLeaf: (pageId: string, messageId?: string) => Promise<void>
  setSelected: (pageId: string, messageId?: string) => Promise<void>

  addTopic: (
    pageId: string,
    input: { id?: string; name: string; startMessageId: string; endMessageId?: string }
  ) => Promise<void>
  updateTopic: (pageId: string, topicId: string, patch: Partial<Topic>) => Promise<void>
  deleteTopic: (pageId: string, topicId: string) => Promise<void>
  getTopics: (pageId: string) => Topic[]
}

type MessagesStore = MessagesState & MessagesActions

interface DeltaBatchEntry {
  pageId: string
  messageId: string
  content: string
  reasoning: string
}

export const useMessagesStore = create<MessagesStore>((set, get) => ({
  cache: {},
  streaming: {},

  load: async (pageId) => {
    const cached = get().cache[pageId]
    if (cached) return cached

    const conversation = await query('conversation.get', { pageId })
    set((state) => ({ cache: { ...state.cache, [pageId]: conversation } }))
    return conversation
  },

  get: (pageId) => get().cache[pageId],

  has: (pageId) => pageId in get().cache,

  setConversation: (conversation) =>
    set((state) => {
      // 会话被权威数据替换时，丢弃已不存在消息的生成标记，避免标记泄漏
      const ids = new Set(conversation.messages.map((message) => message.id))
      const streaming = Object.fromEntries(
        Object.entries(state.streaming).filter(([messageId]) => ids.has(messageId))
      )

      return {
        cache: { ...state.cache, [conversation.pageId]: conversation },
        streaming
      }
    }),

  /**
   * 写入单条消息
   *
   * 只有「空的助手消息」才是生成占位（可能是本端发起，也可能是内核队列触发），
   * 用户消息与已有内容的消息不参与生成标记——标记的清除只由 chat.completed /
   * chat.failed / chat.aborted 驱动。
   */
  upsertMessage: (pageId, message) =>
    set((state) => {
      const current = state.cache[pageId] ?? emptyConversation(pageId)
      const exists = current.messages.some((item) => item.id === message.id)
      const messages = exists
        ? current.messages.map((item) => (item.id === message.id ? message : item))
        : [...current.messages, message]

      const isPlaceholder = message.role === 'assistant' && !message.content && !message.hasError

      return {
        cache: {
          ...state.cache,
          [pageId]: {
            ...current,
            messages,
            leafMessageId: exists ? current.leafMessageId : message.id
          }
        },
        streaming: isPlaceholder ? { ...state.streaming, [message.id]: true } : state.streaming
      }
    }),

  applyDeltas: (entries) =>
    set((state) => {
      const cache = { ...state.cache }
      let changed = false

      for (const entry of entries) {
        const conversation = cache[entry.pageId]
        if (!conversation) continue

        const messages = conversation.messages.map((message) => {
          if (message.id !== entry.messageId) return message
          changed = true
          return {
            ...message,
            content: entry.content ? message.content + entry.content : message.content,
            reasoning: entry.reasoning
              ? `${message.reasoning ?? ''}${entry.reasoning}`
              : message.reasoning
          }
        })

        cache[entry.pageId] = { ...conversation, messages }
      }

      return changed ? { cache } : state
    }),

  setStreaming: (messageId, streaming) =>
    set((state) => {
      if (streaming) return { streaming: { ...state.streaming, [messageId]: true } }
      const next = { ...state.streaming }
      delete next[messageId]
      return { streaming: next }
    }),

  isStreaming: (messageId) => Boolean(get().streaming[messageId]),

  evict: (pageId) =>
    set((state) => {
      const next = { ...state.cache }
      delete next[pageId]
      return { cache: next }
    }),

  reset: () => set({ cache: {}, streaming: {} }),

  addMessage: async (pageId, draft) => {
    const message = await command('conversation.append', {
      pageId,
      draft: { ...draft, id: draft.id ?? uuidv4() }
    })
    get().upsertMessage(pageId, message)
    return message
  },

  replaceConversation: async (pageId, conversation) => {
    await command('conversation.replace', { pageId, conversation: { ...conversation, pageId } })
  },

  updateMessage: async (pageId, messageId, patch) => {
    await command('conversation.updateMessage', { pageId, messageId, patch })
  },

  updateMessages: async (pageId, messageIds, patch) => {
    if (messageIds.length === 0) return
    await command('conversation.updateMessages', { pageId, messageIds, patch })
  },

  deleteMessage: async (pageId, messageId) => {
    await command('conversation.deleteMessage', { pageId, messageId })
  },

  setLeaf: async (pageId, messageId) => {
    await command('conversation.setLeaf', { pageId, messageId })
  },

  setSelected: async (pageId, messageId) => {
    await command('conversation.setSelected', { pageId, messageId })
  },

  addTopic: async (pageId, input) => {
    await command('topic.create', {
      pageId,
      topic: { ...input, id: input.id ?? uuidv4() }
    })
  },

  updateTopic: async (pageId, topicId, patch) => {
    await command('topic.update', {
      pageId,
      topicId,
      patch: {
        name: patch.name,
        endMessageId: patch.endMessageId,
        collapsed: patch.collapsed
      }
    })
  },

  deleteTopic: async (pageId, topicId) => {
    await command('topic.delete', { pageId, topicId })
  },

  getTopics: (pageId) => get().cache[pageId]?.topics ?? []
}))
