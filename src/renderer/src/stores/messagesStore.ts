import { create } from 'zustand'
import * as db from '../utils/database'
import type { MessagesRecord } from '../utils/database'
import type { ChatMessage, Topic } from '../types/type'

// ==================== 导航请求类型 ====================

export interface NavigationRequest {
  version: number
  target: { pageId: string; messageId: string; instant?: boolean }
  timestamp: number
}

export interface RelativeNavigationRequest {
  version: number
  direction: 'prev' | 'next'
  pageId: string
  timestamp: number
}

interface MessagesState {
  // 按 pageId 缓存消息
  cache: Record<string, MessagesRecord>
  // 待处理的导航请求
  pendingNavigation: NavigationRequest | null
  pendingRelativeNavigation: RelativeNavigationRequest | null
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
    updates: Partial<Omit<MessagesRecord, 'pageId' | 'messages' | 'topics'>>
  ) => Promise<void>
  // 清除缓存
  clearCache: (pageId: string) => void
  // 删除页面消息（从数据库）
  remove: (pageId: string) => Promise<void>
  // 重置
  reset: () => void
  // ============ Topic 操作 ============
  // 添加 Topic
  addTopic: (pageId: string, topic: Topic) => Promise<void>
  // 更新 Topic
  updateTopic: (pageId: string, topicId: string, updates: Partial<Topic>) => Promise<void>
  // 删除 Topic
  deleteTopic: (pageId: string, topicId: string) => Promise<void>
  // 获取 Topics
  getTopics: (pageId: string) => Topic[]
  // ============ 导航操作 ============
  // 请求导航到消息
  requestNavigation: (request: NavigationRequest) => void
  // 请求相对导航（上一条/下一条）
  requestRelativeNavigation: (request: RelativeNavigationRequest) => void
  // 清除导航请求
  clearNavigation: (version: number) => void
  // 清除相对导航请求
  clearRelativeNavigation: (version: number) => void
}

type MessagesStore = MessagesState & MessagesActions

const initialState: MessagesState = {
  cache: {},
  pendingNavigation: null,
  pendingRelativeNavigation: null
}

const emptyRecord = (pageId: string): MessagesRecord => ({
  pageId,
  messages: [],
  topics: [],
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

  reset: () => set(initialState),

  // ============ Topic 操作 ============
  addTopic: async (pageId, topic) => {
    await get().update(pageId, (record) => ({
      ...record,
      topics: [...(record.topics ?? []), topic]
    }))
  },

  updateTopic: async (pageId, topicId, updates) => {
    await get().update(pageId, (record) => ({
      ...record,
      topics: (record.topics ?? []).map((t) => (t.id === topicId ? { ...t, ...updates } : t))
    }))
  },

  deleteTopic: async (pageId, topicId) => {
    await get().update(pageId, (record) => ({
      ...record,
      topics: (record.topics ?? []).filter((t) => t.id !== topicId)
    }))
  },

  getTopics: (pageId) => get().cache[pageId]?.topics ?? [],

  // ============ 导航操作 ============
  requestNavigation: (request) => {
    set({ pendingNavigation: request })
  },

  requestRelativeNavigation: (request) => {
    set({ pendingRelativeNavigation: request })
  },

  clearNavigation: (version) => {
    set((state) => {
      if (state.pendingNavigation?.version === version) {
        return { pendingNavigation: null }
      }
      return state
    })
  },

  clearRelativeNavigation: (version) => {
    set((state) => {
      if (state.pendingRelativeNavigation?.version === version) {
        return { pendingRelativeNavigation: null }
      }
      return state
    })
  }
}))
