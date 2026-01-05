import { create } from 'zustand'
import type { FileAttachment } from '../types/type'

interface SearchState {
  isOpen: boolean
  query: string
  currentIndex: number
  matchCase: boolean
  useRegex: boolean
  matchWholeWord: boolean
}

const defaultSearchState: SearchState = {
  isOpen: false,
  query: '',
  currentIndex: 0,
  matchCase: false,
  useRegex: false,
  matchWholeWord: false
}

interface ChatUIState {
  scrollTop: number
  inputContent: string
  pendingAttachments: FileAttachment[]
  search: SearchState
}

interface ChatUIStore {
  states: Map<string, ChatUIState>
  getState: (pageId: string) => ChatUIState
  setScrollTop: (pageId: string, scrollTop: number) => void
  setInputContent: (pageId: string, content: string) => void
  addPendingAttachment: (pageId: string, attachment: FileAttachment) => void
  removePendingAttachment: (pageId: string, attachmentId: string) => void
  clearPendingAttachments: (pageId: string) => void
  clearState: (pageId: string) => void
  // Search actions
  setSearchOpen: (pageId: string, isOpen: boolean) => void
  setSearchQuery: (pageId: string, query: string) => void
  setSearchCurrentIndex: (pageId: string, index: number) => void
  setSearchOptions: (
    pageId: string,
    options: Partial<Pick<SearchState, 'matchCase' | 'useRegex' | 'matchWholeWord'>>
  ) => void
  clearSearch: (pageId: string) => void
}

const defaultState: ChatUIState = {
  scrollTop: -1, // -1 表示滚动到底部
  inputContent: '',
  pendingAttachments: [],
  search: { ...defaultSearchState }
}

export const useChatUIStore = create<ChatUIStore>((set, get) => ({
  states: new Map(),

  getState: (pageId) => {
    return get().states.get(pageId) ?? defaultState
  },

  setScrollTop: (pageId, scrollTop) => {
    set((state) => {
      const newStates = new Map(state.states)
      const current = newStates.get(pageId) ?? { ...defaultState }
      newStates.set(pageId, { ...current, scrollTop })
      return { states: newStates }
    })
  },

  setInputContent: (pageId, content) => {
    set((state) => {
      const newStates = new Map(state.states)
      const current = newStates.get(pageId) ?? { ...defaultState }
      newStates.set(pageId, { ...current, inputContent: content })
      return { states: newStates }
    })
  },

  addPendingAttachment: (pageId, attachment) => {
    set((state) => {
      const newStates = new Map(state.states)
      const current = newStates.get(pageId) ?? { ...defaultState }
      newStates.set(pageId, {
        ...current,
        pendingAttachments: [...current.pendingAttachments, attachment]
      })
      return { states: newStates }
    })
  },

  removePendingAttachment: (pageId, attachmentId) => {
    set((state) => {
      const newStates = new Map(state.states)
      const current = newStates.get(pageId) ?? { ...defaultState }
      newStates.set(pageId, {
        ...current,
        pendingAttachments: current.pendingAttachments.filter((a) => a.id !== attachmentId)
      })
      return { states: newStates }
    })
  },

  clearPendingAttachments: (pageId) => {
    set((state) => {
      const newStates = new Map(state.states)
      const current = newStates.get(pageId) ?? { ...defaultState }
      newStates.set(pageId, { ...current, pendingAttachments: [] })
      return { states: newStates }
    })
  },

  clearState: (pageId) => {
    set((state) => {
      const newStates = new Map(state.states)
      newStates.delete(pageId)
      return { states: newStates }
    })
  },

  // Search actions
  setSearchOpen: (pageId, isOpen) => {
    set((state) => {
      const newStates = new Map(state.states)
      const current = newStates.get(pageId) ?? { ...defaultState }
      newStates.set(pageId, {
        ...current,
        search: {
          ...current.search,
          isOpen,
          // 关闭时重置 currentIndex
          currentIndex: isOpen ? current.search.currentIndex : 0
        }
      })
      return { states: newStates }
    })
  },

  setSearchQuery: (pageId, query) => {
    set((state) => {
      const newStates = new Map(state.states)
      const current = newStates.get(pageId) ?? { ...defaultState }
      newStates.set(pageId, {
        ...current,
        search: {
          ...current.search,
          query,
          // 查询变化时重置 currentIndex
          currentIndex: 0
        }
      })
      return { states: newStates }
    })
  },

  setSearchCurrentIndex: (pageId, index) => {
    set((state) => {
      const newStates = new Map(state.states)
      const current = newStates.get(pageId) ?? { ...defaultState }
      newStates.set(pageId, {
        ...current,
        search: { ...current.search, currentIndex: index }
      })
      return { states: newStates }
    })
  },

  setSearchOptions: (pageId, options) => {
    set((state) => {
      const newStates = new Map(state.states)
      const current = newStates.get(pageId) ?? { ...defaultState }
      newStates.set(pageId, {
        ...current,
        search: {
          ...current.search,
          ...options,
          // 选项变化时重置 currentIndex
          currentIndex: 0
        }
      })
      return { states: newStates }
    })
  },

  clearSearch: (pageId) => {
    set((state) => {
      const newStates = new Map(state.states)
      const current = newStates.get(pageId) ?? { ...defaultState }
      newStates.set(pageId, {
        ...current,
        search: { ...defaultSearchState }
      })
      return { states: newStates }
    })
  }
}))

export type { SearchState }
