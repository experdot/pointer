/**
 * 页面 Store
 *
 * 只保存内核回推的镜像数据；所有变更通过命令发往内核，由事件驱动刷新。
 */

import { create } from 'zustand'
import type { Page } from '@shared/domain'
import { command } from '../runtime/client'

interface PagesState {
  pages: Page[]
  initialized: boolean
}

interface PagesActions {
  upsert: (page: Page) => void
  getById: (id: string) => Page | undefined
  getAll: () => Page[]
  findByFolderId: (folderId: string | undefined) => Page[]
  create: (input?: {
    name?: string
    parentFolderId?: string
    afterNodeId?: string
    starred?: boolean
  }) => Promise<Page>
  rename: (id: string, name: string) => Promise<void>
  update: (id: string, patch: { name?: string; starred?: boolean }) => Promise<void>
  move: (id: string, targetFolderId?: string, beforeNodeId?: string) => Promise<void>
  delete: (ids: string | string[]) => Promise<void>
  reset: () => void
}

type PagesStore = PagesState & PagesActions

export const usePagesStore = create<PagesStore>((set, get) => ({
  pages: [],
  initialized: false,

  upsert: (page) =>
    set((state) => ({
      pages: state.pages.some((item) => item.id === page.id)
        ? state.pages.map((item) => (item.id === page.id ? page : item))
        : [...state.pages, page]
    })),

  getById: (id) => get().pages.find((page) => page.id === id),

  getAll: () => get().pages,

  findByFolderId: (folderId) => get().pages.filter((page) => page.parentFolderId === folderId),

  create: (input) =>
    command('page.create', {
      name: input?.name,
      parentFolderId: input?.parentFolderId,
      afterNodeId: input?.afterNodeId,
      starred: input?.starred
    }),

  rename: async (id, name) => {
    await command('page.update', { pageId: id, patch: { name } })
  },

  update: async (id, patch) => {
    await command('page.update', { pageId: id, patch })
  },

  move: async (id, targetFolderId, beforeNodeId) => {
    await command('page.move', { pageId: id, targetFolderId, beforeNodeId })
  },

  delete: async (ids) => {
    const list = Array.isArray(ids) ? ids : [ids]
    if (list.length === 0) return
    await command('page.delete', { pageIds: list })
  },

  reset: () => set({ pages: [], initialized: false })
}))
