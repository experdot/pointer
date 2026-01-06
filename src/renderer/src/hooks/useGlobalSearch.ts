import { useEffect, useCallback, useRef, useMemo } from 'react'
import { useGlobalSearchStore } from '../stores/globalSearchStore'
import { usePagesStore } from '../stores/pagesStore'
import { useMessagesStore } from '../stores/messagesStore'
import { performGlobalSearch } from '../utils/globalSearchUtils'
import * as navigationService from '../services/navigationService'
import type { GlobalSearchMatch } from '../types/type'

/** 防抖延迟时间 */
const DEBOUNCE_DELAY = 500

interface UseGlobalSearchResult {
  navigateToResult: (match: GlobalSearchMatch) => Promise<void>
  navigateToPrevious: () => void
  navigateToNext: () => void
  flatMatchesCount: number
}

/**
 * 全局搜索 Hook
 */
export function useGlobalSearch(): UseGlobalSearchResult {
  const {
    query,
    options,
    setResults,
    setSearching,
    selectedIndex,
    setSelectedIndex,
    results,
    setHighlightMatch,
    searchTrigger
  } = useGlobalSearchStore()
  const { pages } = usePagesStore()
  const { load } = useMessagesStore()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 加载消息的函数
  const loadMessages = useCallback(
    async (pageId: string) => {
      return load(pageId)
    },
    [load]
  )

  // 执行搜索
  const executeSearch = useCallback(async () => {
    // 取消之前的搜索
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    if (!query.trim()) {
      setResults([], 0)
      setSearching(false)
      return
    }

    setSearching(true)

    try {
      const result = await performGlobalSearch(query, options, pages, loadMessages)
      setResults(result.groups, result.totalCount)
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Global search error:', error)
      }
      setResults([], 0)
    } finally {
      setSearching(false)
    }
  }, [query, options, pages, loadMessages, setResults, setSearching])

  // 防抖搜索
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      executeSearch()
    }, DEBOUNCE_DELAY)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [executeSearch])

  // 立即搜索（由 searchTrigger 触发）
  useEffect(() => {
    if (searchTrigger > 0) {
      // 清除防抖定时器
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      executeSearch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在 searchTrigger 变化时触发
  }, [searchTrigger])

  // 清理
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // 跳转到搜索结果
  const navigateToResult = useCallback(
    async (match: GlobalSearchMatch) => {
      // 使用统一的导航服务（处理页面打开、分支切换、Topic 展开、滚动）
      await navigationService.navigateToMessage({
        pageId: match.pageId,
        messageId: match.messageId,
        openPage: true,
        instant: true
      })

      // 设置高亮匹配，用于在 ChatEditor 中显示高亮
      setHighlightMatch(match)
    },
    [setHighlightMatch]
  )

  // 获取所有匹配项的扁平列表
  const flatMatches = useMemo(() => {
    const matches: { groupIndex: number; matchIndex: number; match: GlobalSearchMatch }[] = []
    results.forEach((group, groupIndex) => {
      group.matches.forEach((match, matchIndex) => {
        matches.push({ groupIndex, matchIndex, match })
      })
    })
    return matches
  }, [results])

  // 导航到上一个/下一个结果
  const navigateToPrevious = useCallback(() => {
    if (flatMatches.length === 0) return

    let currentFlatIndex = -1
    if (selectedIndex) {
      currentFlatIndex = flatMatches.findIndex(
        (m) => m.groupIndex === selectedIndex[0] && m.matchIndex === selectedIndex[1]
      )
    }

    const newFlatIndex = currentFlatIndex <= 0 ? flatMatches.length - 1 : currentFlatIndex - 1
    const newMatch = flatMatches[newFlatIndex]
    setSelectedIndex([newMatch.groupIndex, newMatch.matchIndex])
    navigateToResult(newMatch.match)
  }, [flatMatches, selectedIndex, setSelectedIndex, navigateToResult])

  const navigateToNext = useCallback(() => {
    if (flatMatches.length === 0) return

    let currentFlatIndex = -1
    if (selectedIndex) {
      currentFlatIndex = flatMatches.findIndex(
        (m) => m.groupIndex === selectedIndex[0] && m.matchIndex === selectedIndex[1]
      )
    }

    const newFlatIndex = currentFlatIndex >= flatMatches.length - 1 ? 0 : currentFlatIndex + 1
    const newMatch = flatMatches[newFlatIndex]
    setSelectedIndex([newMatch.groupIndex, newMatch.matchIndex])
    navigateToResult(newMatch.match)
  }, [flatMatches, selectedIndex, setSelectedIndex, navigateToResult])

  return {
    navigateToResult,
    navigateToPrevious,
    navigateToNext,
    flatMatchesCount: flatMatches.length
  }
}
