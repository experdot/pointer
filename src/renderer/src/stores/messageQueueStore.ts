import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import * as db from '../utils/database'
import type { QueueItem, MessageQueueRecord } from '../utils/database'

interface MessageQueueState {
  // 按 pageId 缓存队列
  cache: Record<string, MessageQueueRecord>
  // 是否已初始化（加载完成）
  initialized: boolean
}

interface MessageQueueActions {
  // 初始化：加载所有队列
  init: () => Promise<void>
  // 获取指定页面的队列
  getQueue: (pageId: string) => MessageQueueRecord
  // 添加消息到队列
  addItem: (pageId: string, content: string) => Promise<string>
  // 移除队列项
  removeItem: (pageId: string, itemId: string) => Promise<void>
  // 更新队列项内容
  updateItem: (pageId: string, itemId: string, content: string) => Promise<void>
  // 清空队列
  clearQueue: (pageId: string) => Promise<void>
  // 取出队列第一项（FIFO）
  shiftItem: (pageId: string) => Promise<QueueItem | undefined>
  // 暂停队列
  pause: (pageId: string) => Promise<void>
  // 恢复队列
  resume: (pageId: string) => Promise<void>
  // 重置 store
  reset: () => void
}

type MessageQueueStore = MessageQueueState & MessageQueueActions

const initialState: MessageQueueState = {
  cache: {},
  initialized: false
}

const emptyRecord = (pageId: string): MessageQueueRecord => ({
  pageId,
  items: [],
  paused: false
})

export const useMessageQueueStore = create<MessageQueueStore>((set, get) => ({
  ...initialState,

  init: async () => {
    if (get().initialized) return
    const records = await db.getAllMessageQueues()
    const cache: Record<string, MessageQueueRecord> = {}
    for (const record of records) {
      cache[record.pageId] = record
    }
    set({ cache, initialized: true })
  },

  getQueue: (pageId) => {
    return get().cache[pageId] ?? emptyRecord(pageId)
  },

  addItem: async (pageId, content) => {
    const current = get().cache[pageId] ?? emptyRecord(pageId)
    const newItem: QueueItem = {
      id: uuidv4(),
      content,
      order: current.items.length,
      createdAt: Date.now()
    }
    const updated: MessageQueueRecord = {
      ...current,
      pageId,
      items: [...current.items, newItem]
    }
    await db.putMessageQueue(pageId, updated)
    set((state) => ({
      cache: { ...state.cache, [pageId]: updated }
    }))
    return newItem.id
  },

  removeItem: async (pageId, itemId) => {
    const current = get().cache[pageId]
    if (!current) return
    const updated: MessageQueueRecord = {
      ...current,
      items: current.items
        .filter((item) => item.id !== itemId)
        .map((item, index) => ({ ...item, order: index }))
    }
    await db.putMessageQueue(pageId, updated)
    set((state) => ({
      cache: { ...state.cache, [pageId]: updated }
    }))
  },

  updateItem: async (pageId, itemId, content) => {
    const current = get().cache[pageId]
    if (!current) return
    const updated: MessageQueueRecord = {
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, content } : item))
    }
    await db.putMessageQueue(pageId, updated)
    set((state) => ({
      cache: { ...state.cache, [pageId]: updated }
    }))
  },

  clearQueue: async (pageId) => {
    const current = get().cache[pageId]
    if (!current) return
    const updated: MessageQueueRecord = {
      ...current,
      items: []
    }
    await db.putMessageQueue(pageId, updated)
    set((state) => ({
      cache: { ...state.cache, [pageId]: updated }
    }))
  },

  shiftItem: async (pageId) => {
    const current = get().cache[pageId]
    if (!current || current.items.length === 0) return undefined
    const [first, ...rest] = current.items
    const updated: MessageQueueRecord = {
      ...current,
      items: rest.map((item, index) => ({ ...item, order: index }))
    }
    await db.putMessageQueue(pageId, updated)
    set((state) => ({
      cache: { ...state.cache, [pageId]: updated }
    }))
    return first
  },

  pause: async (pageId) => {
    const current = get().cache[pageId] ?? emptyRecord(pageId)
    const updated: MessageQueueRecord = {
      ...current,
      pageId,
      paused: true
    }
    // 先同步更新内存状态，确保 UI 立即响应
    set((state) => ({
      cache: { ...state.cache, [pageId]: updated }
    }))
    // 再异步持久化
    await db.putMessageQueue(pageId, updated)
  },

  resume: async (pageId) => {
    const current = get().cache[pageId] ?? emptyRecord(pageId)
    const updated: MessageQueueRecord = {
      ...current,
      pageId,
      paused: false
    }
    // 先同步更新内存状态，确保 UI 立即响应
    set((state) => ({
      cache: { ...state.cache, [pageId]: updated }
    }))
    // 再异步持久化
    await db.putMessageQueue(pageId, updated)
  },

  reset: () => set(initialState)
}))
