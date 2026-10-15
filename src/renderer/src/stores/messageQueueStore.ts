/**
 * 消息队列 Store（镜像 + 命令）
 */

import { create } from 'zustand'
import type { MessageQueue } from '@shared/domain'
import { emptyQueue } from '@shared/domain'
import { command } from '../runtime/client'

interface MessageQueueState {
  cache: Record<string, MessageQueue>
}

interface MessageQueueActions {
  setQueue: (queue: MessageQueue) => void
  getQueue: (pageId: string) => MessageQueue
  evict: (pageId: string) => void
  addItem: (pageId: string, content: string) => Promise<void>
  updateItem: (pageId: string, itemId: string, content: string) => Promise<void>
  removeItem: (pageId: string, itemId: string) => Promise<void>
  clearQueue: (pageId: string) => Promise<void>
  pause: (pageId: string) => Promise<void>
  resume: (pageId: string) => Promise<void>
  reset: () => void
}

type MessageQueueStore = MessageQueueState & MessageQueueActions

export const useMessageQueueStore = create<MessageQueueStore>((set, get) => {
  /**
   * 未命中页面的空队列缓存
   *
   * 每次返回新建的空队列会让下游 `useMemo(..., [queue.items])` 每帧都失效，
   * 因此同一 pageId 始终返回同一实例，随 evict/reset 一起清理。
   */
  const emptyQueues = new Map<string, MessageQueue>()

  return {
    cache: {},

    setQueue: (queue) =>
      set((state) => ({
        cache: { ...state.cache, [queue.pageId]: queue }
      })),

    getQueue: (pageId) => {
      const cached = get().cache[pageId]
      if (cached) return cached

      const existing = emptyQueues.get(pageId)
      if (existing) return existing

      const created = emptyQueue(pageId)
      emptyQueues.set(pageId, created)
      return created
    },

    evict: (pageId) => {
      emptyQueues.delete(pageId)
      set((state) => {
        if (!(pageId in state.cache)) return state
        const next = { ...state.cache }
        delete next[pageId]
        return { cache: next }
      })
    },

    addItem: async (pageId, content) => {
      await command('queue.add', { pageId, content })
    },

    updateItem: async (pageId, itemId, content) => {
      await command('queue.update', { pageId, itemId, content })
    },

    removeItem: async (pageId, itemId) => {
      await command('queue.remove', { pageId, itemId })
    },

    clearQueue: async (pageId) => {
      await command('queue.clear', { pageId })
    },

    pause: async (pageId) => {
      await command('queue.setPaused', { pageId, paused: true })
    },

    resume: async (pageId) => {
      await command('queue.setPaused', { pageId, paused: false })
    },

    reset: () => {
      emptyQueues.clear()
      set({ cache: {} })
    }
  }
})
