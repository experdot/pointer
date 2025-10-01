import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { SearchResult, SearchOptions, ChatMessage } from '../types/type'
import { createPersistConfig, handleStoreError } from './persistence/storeConfig'
import { usePagesStore } from './pagesStore'

export interface SearchState {
  searchQuery: string
  searchResults: SearchResult[]
  isSearching: boolean
  showSearchResults: boolean
  searchOptions: SearchOptions
  filterFolderId: string | null
}

export interface SearchActions {
  // 基本搜索操作
  setSearchQuery: (query: string) => void
  setSearchResults: (results: SearchResult[]) => void
  setIsSearching: (isSearching: boolean) => void
  toggleSearchResults: (show: boolean) => void
  clearSearch: () => void

  // 搜索选项
  setSearchOptions: (options: Partial<SearchOptions>) => void
  toggleMatchCase: () => void
  toggleMatchWholeWord: () => void
  toggleUseRegex: () => void

  // 文件夹过滤
  setFilterFolderId: (folderId: string | null) => void

  // 搜索执行
  performSearch: (query?: string) => void
  searchMessages: (pages: any[], query: string, options?: SearchOptions, filterFolderId?: string | null) => SearchResult[]

  // 工具方法
  hasSearchResults: () => boolean
  getSearchResultsCount: () => number
}

const initialState: SearchState = {
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  showSearchResults: false,
  searchOptions: {
    matchCase: false,
    matchWholeWord: false,
    useRegex: false
  },
  filterFolderId: null
}

export const useSearchStore = create<SearchState & SearchActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // 基本搜索操作
      setSearchQuery: (query) => {
        set((state) => {
          state.searchQuery = query
        })
      },

      setSearchResults: (results) => {
        set((state) => {
          state.searchResults = results
          state.isSearching = false
        })
      },

      setIsSearching: (isSearching) => {
        set((state) => {
          state.isSearching = isSearching
        })
      },

      toggleSearchResults: (show) => {
        set((state) => {
          state.showSearchResults = show
        })
      },

      clearSearch: () => {
        set((state) => {
          state.searchQuery = ''
          state.searchResults = []
          state.isSearching = false
          state.showSearchResults = false
          state.filterFolderId = null
        })
      },

      // 搜索选项
      setSearchOptions: (options) => {
        set((state) => {
          state.searchOptions = { ...state.searchOptions, ...options }
        })
      },

      toggleMatchCase: () => {
        set((state) => {
          state.searchOptions.matchCase = !state.searchOptions.matchCase
        })
      },

      toggleMatchWholeWord: () => {
        set((state) => {
          state.searchOptions.matchWholeWord = !state.searchOptions.matchWholeWord
        })
      },

      toggleUseRegex: () => {
        set((state) => {
          state.searchOptions.useRegex = !state.searchOptions.useRegex
        })
      },

      // 文件夹过滤
      setFilterFolderId: (folderId) => {
        set((state) => {
          state.filterFolderId = folderId
        })
      },

      // 搜索执行
      performSearch: (query) => {
        try {
          const state = get()
          const searchQuery = query || state.searchQuery

          if (!searchQuery.trim()) {
            get().clearSearch()
            return
          }

          // 设置搜索状态
          set((state) => {
            state.isSearching = true
            state.searchQuery = searchQuery
          })

          // 获取所有页面进行搜索
          const pages = usePagesStore.getState().pages
          const results = get().searchMessages(pages, searchQuery, state.searchOptions, state.filterFolderId)

          // 更新搜索结果
          set((state) => {
            state.searchResults = results
            state.isSearching = false
            state.showSearchResults = true
          })
        } catch (error) {
          handleStoreError('searchStore', 'performSearch', error)
          set((state) => {
            state.isSearching = false
          })
        }
      },

      searchMessages: (
        pages,
        query,
        options = { matchCase: false, matchWholeWord: false, useRegex: false },
        filterFolderId = null
      ) => {
        if (!query.trim()) return []

        // 如果需要过滤文件夹，先获取该文件夹及其所有子文件夹的ID集合
        let folderIds: Set<string> | null = null
        if (filterFolderId) {
          const folders = usePagesStore.getState().folders
          folderIds = new Set<string>()
          folderIds.add(filterFolderId)

          // 递归查找所有子文件夹
          const findSubFolders = (parentId: string) => {
            folders.forEach(folder => {
              if (folder.parentId === parentId && !folderIds!.has(folder.id)) {
                folderIds!.add(folder.id)
                findSubFolders(folder.id)
              }
            })
          }
          findSubFolders(filterFolderId)
        }

        const results: SearchResult[] = []

        // 根据选项处理搜索词
        let searchPattern: RegExp
        let searchTerm: string

        try {
          if (options.useRegex) {
            // 使用正则表达式
            const flags = options.matchCase ? 'g' : 'gi'
            searchPattern = new RegExp(query, flags)
            searchTerm = query
          } else {
            // 非正则表达式模式
            let escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

            if (options.matchWholeWord) {
              // 匹配整个单词
              escapedQuery = `\\b${escapedQuery}\\b`
            }

            const flags = options.matchCase ? 'g' : 'gi'
            searchPattern = new RegExp(escapedQuery, flags)
            searchTerm = options.matchCase ? query : query.toLowerCase()
          }
        } catch (error) {
          // 正则表达式错误，返回空结果
          console.error('Invalid regex pattern:', error)
          return []
        }

        pages.forEach((chat) => {
          // 过滤掉设置页面和没有消息的页面
          if (chat.type === 'settings' || !chat.messages || chat.messages.length === 0) return

          // 如果设置了文件夹过滤，检查该聊天是否在目标文件夹或其子文件夹中
          if (folderIds && (!chat.folderId || !folderIds.has(chat.folderId))) {
            return
          }

          chat.messages.forEach((message: ChatMessage) => {
            const content = message.content
            const reasoningContent = message.reasoning_content || ''

            // 搜索消息内容和推理内容
            const contentMatch = searchPattern.test(content)
            const reasoningMatch = reasoningContent && searchPattern.test(reasoningContent)

            if (contentMatch || reasoningMatch) {
              // 创建搜索结果片段
              let snippet = ''
              let highlightIndices: number[] = []
              let sourceContent = ''

              if (contentMatch) {
                sourceContent = message.content

                // 重新创建正则表达式以获得匹配位置
                const matchPattern = new RegExp(searchPattern.source, searchPattern.flags)
                const match = matchPattern.exec(content)

                if (match) {
                  const index = match.index
                  const matchLength = match[0].length
                  const start = Math.max(0, index - 50)
                  const end = Math.min(content.length, index + matchLength + 50)
                  snippet = content.substring(start, end)

                  // 计算高亮位置（相对于片段的位置）
                  const highlightStart = index - start

                  if (highlightStart >= 0 && highlightStart < snippet.length) {
                    highlightIndices = [highlightStart, highlightStart + matchLength]
                  }
                }
              } else if (reasoningMatch && message.reasoning_content) {
                sourceContent = message.reasoning_content

                const matchPattern = new RegExp(searchPattern.source, searchPattern.flags)
                const match = matchPattern.exec(reasoningContent)

                if (match) {
                  const index = match.index
                  const matchLength = match[0].length
                  const start = Math.max(0, index - 50)
                  const end = Math.min(reasoningContent.length, index + matchLength + 50)
                  snippet = reasoningContent.substring(start, end)

                  const highlightStart = index - start

                  if (highlightStart >= 0 && highlightStart < snippet.length) {
                    highlightIndices = [highlightStart, highlightStart + matchLength]
                  }
                }
              }

              // 如果片段太长，在前面和后面加上省略号
              let displaySnippet = snippet
              if (snippet.length >= 100) {
                if (displaySnippet.startsWith(sourceContent)) {
                  // 如果片段从原始内容开始，只在后面加省略号
                  displaySnippet = displaySnippet.substring(0, 97) + '...'
                } else if (
                  displaySnippet.endsWith(
                    sourceContent.substring(sourceContent.length - snippet.length)
                  )
                ) {
                  // 如果片段到原始内容结束，只在前面加省略号
                  displaySnippet = '...' + displaySnippet.substring(3)
                  // 调整高亮位置
                  if (highlightIndices.length === 2) {
                    highlightIndices = [highlightIndices[0] + 3, highlightIndices[1] + 3]
                  }
                } else {
                  // 中间片段，前后都加省略号
                  displaySnippet = '...' + displaySnippet.substring(3, 94) + '...'
                  // 调整高亮位置
                  if (highlightIndices.length === 2) {
                    highlightIndices = [highlightIndices[0] + 3, highlightIndices[1] + 3]
                  }
                }
              }

              results.push({
                id: `${chat.id}-${message.id}`,
                chatId: chat.id,
                chatTitle: chat.title || '未命名聊天',
                messageId: message.id,
                message,
                snippet: displaySnippet,
                highlightIndices
              })
            }
          })
        })

        // 按时间排序，最新的在前面
        return results.sort((a, b) => b.message.timestamp - a.message.timestamp)
      },

      // 工具方法
      hasSearchResults: () => {
        return get().searchResults.length > 0
      },

      getSearchResultsCount: () => {
        return get().searchResults.length
      }
    })),
    createPersistConfig('search-store', 1, (state) => ({
      searchQuery: state.searchQuery,
      searchResults: state.searchResults,
      isSearching: state.isSearching,
      showSearchResults: state.showSearchResults,
      searchOptions: state.searchOptions,
      filterFolderId: state.filterFolderId
    }))
  )
)
