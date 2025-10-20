import { useState, useCallback, useMemo } from 'react'
import { ChatMessage } from '../types/type'

interface SearchMatch {
  messageId: string
  matchIndex: number // 在消息内的索引
  startIndex: number
  endIndex: number
  content: string
  globalIndex?: number // 全局唯一索引
}

interface UseMessageSearchResult {
  searchQuery: string
  currentMatchIndex: number
  matches: SearchMatch[]
  totalMatches: number
  isSearchVisible: boolean
  showSearch: () => void
  hideSearch: () => void
  search: (query: string, currentIndex: number, direction: 'next' | 'previous') => void
  getHighlightInfo: (
    text: string,
    messageId: string
  ) => { text: string; highlights: Array<{ start: number; end: number; isCurrentMatch: boolean }> }
  getCurrentMatch: () => SearchMatch | null
}

export const useMessageSearch = (messages: ChatMessage[]): UseMessageSearchResult => {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const [isSearchVisible, setIsSearchVisible] = useState(false)

  // 计算所有匹配项
  const matches = useMemo(() => {
    if (!searchQuery.trim()) return []

    const allMatches: SearchMatch[] = []
    const query = searchQuery.toLowerCase()
    let globalIndex = 0

    // 按消息顺序遍历，保持匹配结果的顺序
    messages.forEach((message, messageIndex) => {
      const content = message.content.toLowerCase()
      let startIndex = 0
      let matchIndexInMessage = 0

      while (true) {
        const index = content.indexOf(query, startIndex)
        if (index === -1) break

        allMatches.push({
          messageId: message.id,
          matchIndex: matchIndexInMessage, // 在消息内的索引
          startIndex: index,
          endIndex: index + query.length,
          content: message.content.slice(index, index + query.length),
          globalIndex: globalIndex++ // 全局唯一索引
        })

        matchIndexInMessage++
        startIndex = index + 1
      }
    })

    return allMatches
  }, [searchQuery, messages])

  const totalMatches = matches.length

  // 显示搜索框
  const showSearch = useCallback(() => {
    setIsSearchVisible(true)
  }, [])

  // 隐藏搜索框
  const hideSearch = useCallback(() => {
    setIsSearchVisible(false)
    setSearchQuery('')
    setCurrentMatchIndex(0)
  }, [])

  // 搜索函数
  const search = useCallback(
    (query: string, currentIndex: number, direction: 'next' | 'previous') => {
      const isNewQuery = query !== searchQuery

      setSearchQuery(query)

      if (!query.trim()) {
        setCurrentMatchIndex(0)
        return
      }

      // 如果是新查询，等待matches更新
      if (isNewQuery) {
        setCurrentMatchIndex(0)
        return
      }

      // 使用已计算的matches进行导航
      if (matches.length === 0) {
        setCurrentMatchIndex(0)
        return
      }

      let newIndex: number

      // 根据方向导航
      if (direction === 'next') {
        newIndex = currentIndex >= matches.length - 1 ? 0 : currentIndex + 1
      } else {
        newIndex = currentIndex <= 0 ? matches.length - 1 : currentIndex - 1
      }

      setCurrentMatchIndex(newIndex)
    },
    [matches, searchQuery]
  )

  // 获取当前匹配项
  const getCurrentMatch = useCallback((): SearchMatch | null => {
    if (matches.length === 0) return null
    return matches[currentMatchIndex] || null
  }, [matches, currentMatchIndex])

  // 高亮文本函数（简化版本，返回文本信息用于外部处理）
  const getHighlightInfo = useCallback(
    (text: string, messageId: string) => {
      if (!searchQuery.trim()) {
        return { text, highlights: [] }
      }

      const query = searchQuery.toLowerCase()
      const lowerText = text.toLowerCase()
      const highlights: Array<{ start: number; end: number; isCurrentMatch: boolean }> = []
      let startIndex = 0

      while (true) {
        const index = lowerText.indexOf(query, startIndex)
        if (index === -1) break

        // 检查是否是当前选中的匹配项
        const currentMatch = getCurrentMatch()
        const isCurrentMatch =
          currentMatch && currentMatch.messageId === messageId && currentMatch.startIndex === index

        highlights.push({
          start: index,
          end: index + query.length,
          isCurrentMatch
        })

        startIndex = index + 1
      }

      return { text, highlights }
    },
    [searchQuery, getCurrentMatch]
  )

  return {
    searchQuery,
    currentMatchIndex,
    matches,
    totalMatches,
    isSearchVisible,
    showSearch,
    hideSearch,
    search,
    getHighlightInfo,
    getCurrentMatch
  }
}
