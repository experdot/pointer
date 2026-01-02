import { create } from 'zustand'
import * as db from '../utils/database'
import type { MessagesRecord } from '../utils/database'
import type { ChatMessage } from '../types/type'

interface MessagesState {
  // 按 pageId 缓存消息
  cache: Record<string, MessagesRecord>
}

interface MessagesActions {
  // 加载页面消息到缓存
  load: (pageId: string) => Promise<MessagesRecord>
  // 获取缓存的消息（不触发加载）
  get: (pageId: string) => MessagesRecord | undefined
  // 更新消息并持久化
  update: (pageId: string, updater: (record: MessagesRecord) => MessagesRecord) => Promise<void>
  // 添加消息
  addMessage: (pageId: string, message: ChatMessage) => Promise<void>
  // 更新单条消息
  updateMessage: (pageId: string, messageId: string, updates: Partial<ChatMessage>) => Promise<void>
  // 删除消息
  deleteMessages: (pageId: string, messageIds: Set<string>) => Promise<void>
  // 更新 session 信息
  updateSession: (
    pageId: string,
    updates: Partial<Omit<MessagesRecord, 'pageId' | 'messages'>>
  ) => Promise<void>
  // 清除缓存
  clearCache: (pageId: string) => void
  // 删除页面消息（从数据库）
  remove: (pageId: string) => Promise<void>
  // 重置
  reset: () => void
}

type MessagesStore = MessagesState & MessagesActions

const initialState: MessagesState = {
  cache: {}
}

const emptyRecord = (pageId: string): MessagesRecord => ({
  pageId,
  messages: [],
  rootMessageId: undefined,
  leafMessageId: undefined,
  selectedMessageId: undefined
})

export const useMessagesStore = create<MessagesStore>((set, get) => ({
  ...initialState,

  load: async (pageId) => {
    const cached = get().cache[pageId]
    if (cached) return cached

    const record = (await db.getMessages(pageId)) ?? emptyRecord(pageId)
    set((state) => ({
      cache: { ...state.cache, [pageId]: record }
    }))
    return record
  },

  get: (pageId) => get().cache[pageId],

  update: async (pageId, updater) => {
    const current = get().cache[pageId] ?? emptyRecord(pageId)
    const updated = updater(current)
    await db.putMessages(updated)
    set((state) => ({
      cache: { ...state.cache, [pageId]: updated }
    }))
  },

  addMessage: async (pageId, message) => {
    await get().update(pageId, (record) => ({
      ...record,
      messages: [...record.messages, message],
      rootMessageId: record.rootMessageId ?? message.id,
      leafMessageId: message.id
    }))
  },

  updateMessage: async (pageId, messageId, updates) => {
    await get().update(pageId, (record) => ({
      ...record,
      messages: record.messages.map((m) =>
        m.id === messageId ? { ...m, ...updates, updatedAt: Date.now() } : m
      )
    }))
  },

  deleteMessages: async (pageId, messageIds) => {
    await get().update(pageId, (record) => ({
      ...record,
      messages: record.messages.filter((m) => !messageIds.has(m.id))
    }))
  },

  updateSession: async (pageId, updates) => {
    await get().update(pageId, (record) => ({
      ...record,
      ...updates
    }))
  },

  clearCache: (pageId) => {
    set((state) => {
      const { [pageId]: _removed, ...rest } = state.cache
      void _removed // 显式标记为已使用
      return { cache: rest }
    })
  },

  remove: async (pageId) => {
    await db.deleteMessages(pageId)
    get().clearCache(pageId)
  },

  reset: () => set(initialState)
}))
