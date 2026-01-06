import { create } from 'zustand'
import type { GlobalSearchOptions, GlobalSearchResultGroup, GlobalSearchMatch } from '../types/type'

interface GlobalSearchState {
  query: string
  options: GlobalSearchOptions
  results: GlobalSearchResultGroup[]
  totalCount: number
  isSearching: boolean
  /** 当前选中的结果索引 [pageIndex, messageIndex, matchIndex] */
  selectedIndex: [number, number, number] | null
  /** 当前高亮的匹配项（用于在 ChatEditor 中显示高亮） */
  highlightMatch: GlobalSearchMatch | null
  /** 搜索触发器（用于强制立即搜索） */
  searchTrigger: number
}

interface GlobalSearchActions {
  setQuery: (query: string) => void
  setOptions: (options: Partial<GlobalSearchOptions>) => void
  setResults: (results: GlobalSearchResultGroup[], totalCount: number) => void
  setSearching: (isSearching: boolean) => void
  setSelectedIndex: (index: [number, number, number] | null) => void
  toggleGroupExpanded: (pageId: string) => void
  toggleMessageExpanded: (pageId: string, messageId: string) => void
  expandAll: () => void
  collapseAll: () => void
  clearSearch: () => void
  /** 设置当前高亮的匹配项 */
  setHighlightMatch: (match: GlobalSearchMatch | null) => void
  /** 触发立即搜索（绕过防抖） */
  triggerSearch: () => void
  reset: () => void
}

type GlobalSearchStore = GlobalSearchState & GlobalSearchActions

const defaultOptions: GlobalSearchOptions = {
  matchCase: false,
  useRegex: false,
  matchWholeWord: false,
  roleFilter: 'all',
  timeRange: 'all',
  folderIds: undefined
}

const initialState: GlobalSearchState = {
  query: '',
  options: defaultOptions,
  results: [],
  totalCount: 0,
  isSearching: false,
  selectedIndex: null,
  highlightMatch: null,
  searchTrigger: 0
}

export const useGlobalSearchStore = create<GlobalSearchStore>((set) => ({
  ...initialState,

  setQuery: (query) => set({ query, selectedIndex: null, highlightMatch: null }),

  setOptions: (options) =>
    set((state) => ({
      options: { ...state.options, ...options },
      selectedIndex: null
    })),

  setResults: (results, totalCount) => set({ results, totalCount }),

  setSearching: (isSearching) => set({ isSearching }),

  setSelectedIndex: (selectedIndex) => set({ selectedIndex }),

  toggleGroupExpanded: (pageId) =>
    set((state) => ({
      results: state.results.map((g) => (g.pageId === pageId ? { ...g, expanded: !g.expanded } : g))
    })),

  toggleMessageExpanded: (pageId, messageId) =>
    set((state) => ({
      results: state.results.map((g) =>
        g.pageId === pageId
          ? {
              ...g,
              messageGroups: g.messageGroups.map((mg) =>
                mg.messageId === messageId ? { ...mg, expanded: !mg.expanded } : mg
              )
            }
          : g
      )
    })),

  expandAll: () =>
    set((state) => ({
      results: state.results.map((g) => ({
        ...g,
        expanded: true,
        messageGroups: g.messageGroups.map((mg) => ({ ...mg, expanded: true }))
      }))
    })),

  collapseAll: () =>
    set((state) => ({
      results: state.results.map((g) => ({
        ...g,
        expanded: false,
        messageGroups: g.messageGroups.map((mg) => ({ ...mg, expanded: false }))
      }))
    })),

  clearSearch: () =>
    set({
      query: '',
      results: [],
      totalCount: 0,
      selectedIndex: null,
      highlightMatch: null
    }),

  setHighlightMatch: (highlightMatch) => set({ highlightMatch }),

  triggerSearch: () => set((state) => ({ searchTrigger: state.searchTrigger + 1 })),

  reset: () => set(initialState)
}))
