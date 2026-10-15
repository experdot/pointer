import { useEffect, useMemo, useRef, useCallback, useState } from 'react'
import type { ChatMessage } from '@renderer/types/shared'
import type { SearchState } from '../stores/chatUIStore'
import {
  SEARCH_DEBOUNCE_MS,
  findAllMatches,
  type SearchMatch,
  type SearchOptions
} from '../utils/searchUtils'
import {
  buildTextIndex,
  createRangeFromFullTextOffset,
  findOccurrenceOffset
} from '../utils/highlightRange'
import { expandTopicsForMessage } from '../services/navigationService'

interface UseSearchHighlightOptions {
  containerRef: React.RefObject<HTMLElement | null>
  messages: ChatMessage[]
  searchState: SearchState
  pageId: string
  onMatchesChange?: (matches: SearchMatch[]) => void
}

interface UseSearchHighlightResult {
  matches: SearchMatch[]
  total: number
  scrollToMatch: (index: number) => void
}

/**
 * 搜索高亮 Hook
 */
export function useSearchHighlight({
  containerRef,
  messages,
  searchState,
  pageId,
  onMatchesChange
}: UseSearchHighlightOptions): UseSearchHighlightResult {
  const rangesRef = useRef<Map<number, Range>>(new Map())

  // 计算搜索选项
  const searchOptions: SearchOptions = useMemo(
    () => ({
      matchCase: searchState.matchCase,
      useRegex: searchState.useRegex,
      matchWholeWord: searchState.matchWholeWord
    }),
    [searchState.matchCase, searchState.useRegex, searchState.matchWholeWord]
  )

  // 防抖后的查询
  const [debouncedQuery, setDebouncedQuery] = useState(searchState.query)

  // 防抖处理
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchState.query)
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [searchState.query])

  // 计算匹配结果（使用防抖后的查询）
  const matches = useMemo(() => {
    if (!searchState.isOpen || !debouncedQuery.trim()) {
      return []
    }
    return findAllMatches(messages, debouncedQuery, searchOptions)
  }, [messages, searchState.isOpen, debouncedQuery, searchOptions])

  // 通知匹配结果变化
  useEffect(() => {
    onMatchesChange?.(matches)
  }, [matches, onMatchesChange])

  // 应用 CSS Custom Highlight - 当 matches 变化时重新创建所有 Range
  useEffect(() => {
    // 清除之前的高亮
    if ('highlights' in CSS) {
      CSS.highlights.delete('search-highlight')
      CSS.highlights.delete('search-current')
    }
    rangesRef.current.clear()

    const container = containerRef.current
    if (!container || matches.length === 0 || !('highlights' in CSS)) {
      return
    }

    // 为每个匹配创建 Range
    for (const match of matches) {
      const range = createRangeForMatch(container, messages, match)
      if (range) {
        rangesRef.current.set(match.globalIndex, range)
      }
    }

    // 应用所有匹配的高亮
    const allRanges = Array.from(rangesRef.current.values())
    if (allRanges.length > 0) {
      try {
        const highlight = new Highlight(...allRanges)
        CSS.highlights.set('search-highlight', highlight)
      } catch (e) {
        console.warn('Failed to apply search highlight:', e)
      }
    }

    return () => {
      if ('highlights' in CSS) {
        CSS.highlights.delete('search-highlight')
        CSS.highlights.delete('search-current')
      }
    }
  }, [containerRef, matches, messages])

  // 单独处理当前匹配项的高亮 - 当 currentIndex 变化时更新
  useEffect(() => {
    if (!('highlights' in CSS) || matches.length === 0) {
      return
    }

    const currentRange = rangesRef.current.get(searchState.currentIndex)
    if (currentRange) {
      try {
        const currentHighlight = new Highlight(currentRange)
        CSS.highlights.set('search-current', currentHighlight)
      } catch (e) {
        console.warn('Failed to apply current highlight:', e)
      }
    } else {
      CSS.highlights.delete('search-current')
    }
  }, [searchState.currentIndex, matches])

  // 滚动到指定匹配项
  const scrollToMatch = useCallback(
    async (index: number) => {
      const container = containerRef.current
      if (!container || matches.length === 0) return

      const match = matches[index]
      if (!match) return

      // 先展开包含目标消息的折叠 Topic
      await expandTopicsForMessage(pageId, match.messageId)

      // 等待 DOM 更新
      await new Promise((resolve) => setTimeout(resolve, 50))

      // 尝试滚动到具体的 Range 位置
      const range = rangesRef.current.get(index)
      if (range) {
        const rect = range.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()

        // 计算需要滚动的位置，使匹配项居中
        const targetScrollTop =
          container.scrollTop +
          rect.top -
          containerRect.top -
          containerRect.height / 2 +
          rect.height / 2

        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth'
        })
      } else {
        // 降级：滚动到消息
        const messageEl = container.querySelector(`[data-message-id="${match.messageId}"]`)
        if (messageEl) {
          messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    },
    [containerRef, matches, pageId]
  )

  return {
    matches,
    total: matches.length,
    scrollToMatch
  }
}

/**
 * 为单个匹配创建 Range
 */
function createRangeForMatch(
  container: HTMLElement,
  messages: ChatMessage[],
  match: SearchMatch
): Range | null {
  const messageEl = container.querySelector(`[data-message-id="${match.messageId}"]`)
  if (!messageEl) return null

  // 查找消息内容区域
  const contentEl = messageEl.querySelector('.message-item__body')
  if (!contentEl) return null

  // 获取要匹配的文本
  const messageContent = messages.find((m) => m.id === match.messageId)?.content ?? ''
  const matchText = messageContent.slice(match.startOffset, match.endOffset)
  if (!matchText) return null

  // Markdown 渲染会改变字符位置，按「该消息中的第 N 个命中」定位
  const { fullText, offsets } = buildTextIndex(contentEl)
  const offset = findOccurrenceOffset(fullText, matchText, countMatchesBefore(messages, match))
  if (offset === -1) return null

  return createRangeFromFullTextOffset(offsets, offset, offset + matchText.length)
}

/**
 * 计算在同一消息中，当前匹配之前有多少个匹配
 */
function countMatchesBefore(messages: ChatMessage[], currentMatch: SearchMatch): number {
  const messageContent = messages.find((m) => m.id === currentMatch.messageId)?.content ?? ''
  const matchText = messageContent.slice(currentMatch.startOffset, currentMatch.endOffset)

  let count = 0
  let searchIndex = 0

  while (searchIndex < currentMatch.startOffset) {
    const idx = messageContent.indexOf(matchText, searchIndex)
    if (idx === -1 || idx >= currentMatch.startOffset) break
    count++
    searchIndex = idx + 1
  }

  return count
}
