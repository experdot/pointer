import { AppState, AppAction, SearchResult, ChatMessage } from '../../types'

export const handleSearchActions = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_SEARCH_QUERY': {
      return {
        ...state,
        searchQuery: action.payload.query
      }
    }

    case 'SET_SEARCH_RESULTS': {
      return {
        ...state,
        searchResults: action.payload.results,
        isSearching: false
      }
    }

    case 'SET_IS_SEARCHING': {
      return {
        ...state,
        isSearching: action.payload.isSearching
      }
    }

    case 'TOGGLE_SEARCH_RESULTS': {
      return {
        ...state,
        showSearchResults: action.payload.show
      }
    }

    case 'CLEAR_SEARCH': {
      return {
        ...state,
        searchQuery: '',
        searchResults: [],
        isSearching: false,
        showSearchResults: false
      }
    }

    default:
      return state
  }
}

// 搜索工具函数
export const searchMessages = (pages: any[], query: string): SearchResult[] => {
  if (!query.trim()) return []

  const results: SearchResult[] = []
  const searchTerm = query.toLowerCase().trim()

  pages.forEach((chat) => {
    if (!chat.messages || chat.messages.length === 0) return

    chat.messages.forEach((message: ChatMessage) => {
      const content = message.content.toLowerCase()
      const reasoningContent = message.reasoning_content?.toLowerCase() || ''

      // 搜索消息内容和推理内容
      const contentMatch = content.includes(searchTerm)
      const reasoningMatch = reasoningContent.includes(searchTerm)

      if (contentMatch || reasoningMatch) {
        // 创建搜索结果片段
        let snippet = ''
        let highlightIndices: number[] = []
        let sourceContent = ''

        if (contentMatch) {
          sourceContent = message.content
          const index = content.indexOf(searchTerm)
          const start = Math.max(0, index - 50)
          const end = Math.min(message.content.length, index + searchTerm.length + 50)
          snippet = message.content.substring(start, end)

          // 计算高亮位置（相对于片段的位置）
          const originalIndex = message.content.toLowerCase().indexOf(searchTerm)
          const snippetStart = message.content.indexOf(snippet)
          const highlightStart = originalIndex - snippetStart

          if (highlightStart >= 0 && highlightStart < snippet.length) {
            highlightIndices = [highlightStart, highlightStart + searchTerm.length]
          }
        } else if (reasoningMatch && message.reasoning_content) {
          sourceContent = message.reasoning_content
          const index = reasoningContent.indexOf(searchTerm)
          const start = Math.max(0, index - 50)
          const end = Math.min(message.reasoning_content.length, index + searchTerm.length + 50)
          snippet = message.reasoning_content.substring(start, end)

          const originalIndex = message.reasoning_content.toLowerCase().indexOf(searchTerm)
          const snippetStart = message.reasoning_content.indexOf(snippet)
          const highlightStart = originalIndex - snippetStart

          if (highlightStart >= 0 && highlightStart < snippet.length) {
            highlightIndices = [highlightStart, highlightStart + searchTerm.length]
          }
        }

        // 如果片段太长，在前面和后面加上省略号
        let displaySnippet = snippet
        if (snippet.length >= 100) {
          if (displaySnippet.startsWith(sourceContent)) {
            // 如果片段从原始内容开始，只在后面加省略号
            displaySnippet = displaySnippet.substring(0, 97) + '...'
          } else if (
            displaySnippet.endsWith(sourceContent.substring(sourceContent.length - snippet.length))
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
}
