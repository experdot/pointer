import { AppState, AppAction, SearchResult, ChatMessage, SearchOptions } from '../../types/type'

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
export const searchMessages = (
  pages: any[],
  query: string,
  options: SearchOptions = { matchCase: false, matchWholeWord: false, useRegex: false }
): SearchResult[] => {
  if (!query.trim()) return []

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
    if (!chat.messages || chat.messages.length === 0) return

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
