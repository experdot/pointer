import { create } from 'zustand'
import * as db from '../utils/database'
import type { PageRecord } from '../utils/database'

interface PagesState {
  pages: PageRecord[]
  initialized: boolean
}

interface PagesActions {
  init: () => Promise<void>
  addPage: (page: PageRecord) => Promise<void>
  addPages: (pages: PageRecord[]) => Promise<void>
  updatePage: (id: string, updates: Partial<PageRecord>) => Promise<void>
  removePage: (id: string) => Promise<void>
  removePages: (ids: string[]) => Promise<void>
  batchUpdatePages: (updates: Array<{ id: string; updates: Partial<PageRecord> }>) => Promise<void>
  reset: () => Promise<void>
}

type PagesStore = PagesState & PagesActions

const initialState: PagesState = {
  pages: [],
  initialized: false
}

export const usePagesStore = create<PagesStore>((set, get) => ({
  ...initialState,

  init: async () => {
    const pages = await db.getAllPages()
    set({ pages, initialized: true })
  },

  addPage: async (page) => {
    await db.putPage(page)
    set((state) => ({ pages: [...state.pages, page] }))
  },

  addPages: async (pages) => {
    if (pages.length === 0) return
    await db.putPagesBatch(pages)
    set((state) => ({ pages: [...state.pages, ...pages] }))
  },

  updatePage: async (id, updates) => {
    const page = get().pages.find((p) => p.id === id)
    if (!page) return

    const updated = { ...page, ...updates, updatedAt: Date.now() }
    await db.putPage(updated)
    set((state) => ({
      pages: state.pages.map((p) => (p.id === id ? updated : p))
    }))
  },

  removePage: async (id) => {
    await db.deletePage(id)
    set((state) => ({ pages: state.pages.filter((p) => p.id !== id) }))
  },

  removePages: async (ids) => {
    if (ids.length === 0) return
    await db.deletePagesBatch(ids)
    const idSet = new Set(ids)
    set((state) => ({ pages: state.pages.filter((p) => !idSet.has(p.id)) }))
  },

  batchUpdatePages: async (updates) => {
    const pages = get().pages
    const updatedPages = pages.map((p) => {
      const update = updates.find((u) => u.id === p.id)
      return update ? { ...p, ...update.updates, updatedAt: Date.now() } : p
    })
    await Promise.all(
      updates.map((u) => {
        const page = updatedPages.find((p) => p.id === u.id)
        return page ? db.putPage(page) : Promise.resolve()
      })
    )
    set({ pages: updatedPages })
  },

  reset: async () => {
    await db.clearAllPages()
    set(initialState)
  }
}))
