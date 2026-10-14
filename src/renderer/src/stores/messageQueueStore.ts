/**
 * 消息队列 Store（镜像 + 命令）
 */

import { create } from 'zustand'
import type { MessageQueue } from '@shared/domain'
import { emptyQueue } from '@shared/domain'
import { command } from '../runtime/client'

interface MessageQueueState {
  cache: Record<string, MessageQueue>
  initialized: boolean
}

interface MessageQueueActions {
  setQueue: (queue: MessageQueue) => void
  getQueue: (pageId: string) => MessageQueue
  evict: (pageId: string) => void
  evictAll: () => void
  addItem: (pageId: string, content: string) => Promise<void>
  updateItem: (pageId: string, itemId: string, content: string) => Promise<void>
  removeItem: (pageId: string, itemId: string) => Promise<void>
  clearQueue: (pageId: string) => Promise<void>
  pause: (pageId: string) => Promise<void>
  resume: (pageId: string) => Promise<void>
  reset: () => void
}

type MessageQueueStore = MessageQueueState & MessageQueueActions

export const useMessageQueueStore = create<MessageQueueStore>((set, get) => ({
  cache: {},
  initialized: false,

  setQueue: (queue) =>
    set((state) => ({
      cache: { ...state.cache, [queue.pageId]: queue },
      initialized: true
    })),

  getQueue: (pageId) => get().cache[pageId] ?? emptyQueue(pageId),

  evict: (pageId) =>
    set((state) => {
      if (!(pageId in state.cache)) return state
      const next = { ...state.cache }
      delete next[pageId]
      return { cache: next }
    }),

  evictAll: () => set({ cache: {} }),

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

  reset: () => set({ cache: {}, initialized: false })
}))
