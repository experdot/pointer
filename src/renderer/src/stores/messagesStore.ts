/**
 * 消息 Store
 * 管理消息缓存和 Topic
 */

import { create } from 'zustand'
import { persistence } from '../persistence/registry'
import { tryGetCurrentWorkspaceScope } from '../persistence/scope'
import { queueMessagesDelete, queueMessagesPut } from './persistenceQueue'
import type { MessagesRecord } from '../persistence/interfaces/userData'
import type { ChatMessage, Topic } from '../types/type'
import type { IMessageStore } from './interfaces/entities'

interface MessagesState {
  // 按 pageId 缓存消息
  cache: Record<string, MessagesRecord>
}

interface MessagesActions {
  // 加载页面消息到缓存
  load: (pageId: string) => Promise<MessagesRecord>
  // 获取缓存的消息（不触发加载）
  get: (pageId: string) => MessagesRecord | undefined
  // 检查是否已缓存
  has: (pageId: string) => boolean
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
  // 清除缓存（evict）
  evict: (pageId: string) => void
  // 清除所有缓存
  evictAll: () => void
  // 删除页面消息（从数据库）
  removeRecord: (pageId: string) => Promise<void>
  // 重置
  reset: () => void
  // ============ Topic 操作 ============
  addTopic: (pageId: string, topic: Topic) => Promise<void>
  updateTopic: (pageId: string, topicId: string, updates: Partial<Topic>) => Promise<void>
  deleteTopic: (pageId: string, topicId: string) => Promise<void>
  getTopics: (pageId: string) => Topic[]
}

type MessagesStore = MessagesState & MessagesActions

const initialState: MessagesState = {
  cache: {}
}

const emptyRecord = (pageId: string): MessagesRecord => ({
  pageId,
  messages: [],
  topics: [],
  leafMessageId: undefined,
  selectedMessageId: undefined
})

export const useMessagesStore = create<MessagesStore>((set, get) => ({
  ...initialState,

  load: async (pageId) => {
    const cached = get().cache[pageId]
    if (cached) return cached

    const scope = tryGetCurrentWorkspaceScope()
    if (!scope) {
      return emptyRecord(pageId)
    }

    const record = (await persistence.workspace(scope).messages.get(pageId)) ?? emptyRecord(pageId)
    set((state) => ({
      cache: { ...state.cache, [pageId]: record }
    }))
    return record
  },

  get: (pageId) => get().cache[pageId],

  has: (pageId) => pageId in get().cache,

  update: async (pageId, updater) => {
    const scope = tryGetCurrentWorkspaceScope()
    if (!scope) return

    const current = get().cache[pageId] ?? emptyRecord(pageId)
    const updated = updater(current)
    // 先更新内存状态（UI 立即响应）
    set((state) => ({
      cache: { ...state.cache, [pageId]: updated }
    }))
    // 异步持久化（防抖合并，不阻塞 UI）
    queueMessagesPut(scope, pageId, updated)
  },

  addMessage: async (pageId, message) => {
    await get().update(pageId, (record) => ({
      ...record,
      messages: [...record.messages, message],
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

  evict: (pageId) => {
    set((state) => {
      const { [pageId]: _removed, ...rest } = state.cache
      void _removed // 显式标记为已使用
      return { cache: rest }
    })
  },

  evictAll: () => {
    set({ cache: {} })
  },

  removeRecord: async (pageId) => {
    const scope = tryGetCurrentWorkspaceScope()
    if (!scope) {
      get().evict(pageId)
      return
    }

    queueMessagesDelete(scope, pageId)
    get().evict(pageId)
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

  getTopics: (pageId) => get().cache[pageId]?.topics ?? []
}))

/**
 * 获取消息 Store 的接口实现
 */
export function getMessageStoreInterface(): IMessageStore {
  const store = useMessagesStore
  return {
    load: (key) => store.getState().load(key),
    get: (key) => store.getState().get(key),
    has: (key) => store.getState().has(key),
    evict: (key) => store.getState().evict(key),
    evictAll: () => store.getState().evictAll(),
    reset: () => store.getState().reset(),
    update: (pageId, updater) => store.getState().update(pageId, updater),
    addMessage: (pageId, message) => store.getState().addMessage(pageId, message),
    updateMessage: (pageId, messageId, changes) =>
      store.getState().updateMessage(pageId, messageId, changes),
    deleteMessages: (pageId, messageIds) => store.getState().deleteMessages(pageId, messageIds),
    updateSession: (pageId, changes) => store.getState().updateSession(pageId, changes),
    addTopic: (pageId, topic) => store.getState().addTopic(pageId, topic),
    updateTopic: (pageId, topicId, changes) =>
      store.getState().updateTopic(pageId, topicId, changes),
    deleteTopic: (pageId, topicId) => store.getState().deleteTopic(pageId, topicId),
    getTopics: (pageId) => store.getState().getTopics(pageId),
    removeRecord: (pageId) => store.getState().removeRecord(pageId)
  }
}

// ==================== 兼容性导出（过渡期使用）====================
// 导航功能已移至 navigationStore

export type { NavigationRequest, RelativeNavigationRequest } from './interfaces/navigation'
