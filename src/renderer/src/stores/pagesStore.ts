/**
 * 页面 Store
 * 管理页面列表
 */

import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { persistence } from '../persistence/registry'
import { getCurrentWorkspaceScope, tryGetCurrentWorkspaceScope } from '../persistence/scope'
import { queuePageDelete, queuePagePut } from './persistenceQueue'
import type { PageRecord } from '../persistence/interfaces/userData'
import type { IPageStore, PageCreateDTO } from './interfaces/entities'

interface PagesState {
  pages: PageRecord[]
  initialized: boolean
}

interface PagesActions {
  // IEntityStore 接口方法
  init: () => Promise<void>
  getById: (id: string) => PageRecord | undefined
  getAll: () => PageRecord[]
  create: (data: PageCreateDTO) => Promise<PageRecord>
  createMany: (data: PageCreateDTO[]) => Promise<PageRecord[]>
  update: (id: string, changes: Partial<PageRecord>) => Promise<void>
  updateMany: (updates: Array<{ id: string; changes: Partial<PageRecord> }>) => Promise<void>
  delete: (id: string) => Promise<void>
  deleteMany: (ids: string[]) => Promise<void>
  reset: () => Promise<void>
  // 扩展方法
  findByFolderId: (folderId: string | undefined) => PageRecord[]
}

type PagesStore = PagesState & PagesActions

const initialState: PagesState = {
  pages: [],
  initialized: false
}

export const usePagesStore = create<PagesStore>((set, get) => ({
  ...initialState,

  init: async () => {
    const scope = tryGetCurrentWorkspaceScope()
    if (!scope) {
      set(initialState)
      return
    }

    const pages = await persistence.workspace(scope).pages.getAll()
    set({ pages, initialized: true })
  },

  getById: (id) => get().pages.find((p) => p.id === id),

  getAll: () => get().pages,

  create: async (data) => {
    const createdAt = data.createdAt ?? Date.now()
    const page: PageRecord = {
      type: 'item',
      id: data.id || uuidv4(),
      name: data.name,
      parentFolderId: data.parentFolderId,
      order: data.order ?? 0,
      starred: data.starred,
      createdAt,
      updatedAt: data.updatedAt
    }
    queuePagePut(getCurrentWorkspaceScope(), page)
    set((state) => ({
      pages: state.pages.some((item) => item.id === page.id)
        ? state.pages.map((item) => (item.id === page.id ? page : item))
        : [...state.pages, page]
    }))
    return page
  },

  createMany: async (items) => {
    if (items.length === 0) return []
    const pages: PageRecord[] = items.map((data) => ({
      type: 'item',
      id: data.id || uuidv4(),
      name: data.name,
      parentFolderId: data.parentFolderId,
      order: data.order ?? 0,
      starred: data.starred,
      createdAt: data.createdAt ?? Date.now(),
      updatedAt: data.updatedAt
    }))
    const scope = getCurrentWorkspaceScope()
    pages.forEach((page) => queuePagePut(scope, page))
    set((state) => {
      const pageMap = new Map(state.pages.map((page) => [page.id, page]))
      pages.forEach((page) => pageMap.set(page.id, page))
      return { pages: Array.from(pageMap.values()) }
    })
    return pages
  },

  update: async (id, changes) => {
    const page = get().pages.find((p) => p.id === id)
    if (!page) return

    const updated = { ...page, ...changes, updatedAt: Date.now() }
    queuePagePut(getCurrentWorkspaceScope(), updated)
    set((state) => ({
      pages: state.pages.map((p) => (p.id === id ? updated : p))
    }))
  },

  updateMany: async (updates) => {
    if (updates.length === 0) return
    const pages = get().pages
    const updatedAt = Date.now()
    const updatedPages = pages.map((p) => {
      const update = updates.find((u) => u.id === p.id)
      return update ? { ...p, ...update.changes, updatedAt } : p
    })
    const updatedIds = new Set(updates.map((update) => update.id))
    const scope = getCurrentWorkspaceScope()
    updatedPages.forEach((page) => {
      if (updatedIds.has(page.id)) {
        queuePagePut(scope, page)
      }
    })
    set({ pages: updatedPages })
  },

  delete: async (id) => {
    queuePageDelete(getCurrentWorkspaceScope(), id)
    set((state) => ({ pages: state.pages.filter((p) => p.id !== id) }))
  },

  deleteMany: async (ids) => {
    if (ids.length === 0) return
    const scope = getCurrentWorkspaceScope()
    ids.forEach((id) => queuePageDelete(scope, id))
    const idSet = new Set(ids)
    set((state) => ({ pages: state.pages.filter((p) => !idSet.has(p.id)) }))
  },

  reset: async () => {
    // Only reset memory state, don't clear persistence data
    set(initialState)
  },

  findByFolderId: (folderId) => {
    return get().pages.filter((p) => p.parentFolderId === folderId)
  }
}))

/**
 * 获取页面 Store 的接口实现
 */
export function getPageStoreInterface(): IPageStore {
  const store = usePagesStore
  return {
    get initialized() {
      return store.getState().initialized
    },
    get pages() {
      return store.getState().pages
    },
    init: () => store.getState().init(),
    reset: () => store.getState().reset(),
    getById: (id) => store.getState().getById(id),
    getAll: () => store.getState().getAll(),
    create: (data) => store.getState().create(data),
    createMany: (data) => store.getState().createMany(data),
    update: (id, changes) => store.getState().update(id, changes),
    updateMany: (updates) => store.getState().updateMany(updates),
    delete: (id) => store.getState().delete(id),
    deleteMany: (ids) => store.getState().deleteMany(ids),
    findByFolderId: (folderId) => store.getState().findByFolderId(folderId)
  }
}
