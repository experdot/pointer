import { useEffect, useMemo, useRef, useCallback } from 'react'
import type { ChatMessage } from '../types/type'
import type { SearchState } from '../stores/chatUIStore'
import { findAllMatches, type SearchMatch, type SearchOptions } from '../utils/searchUtils'

interface UseSearchHighlightOptions {
  containerRef: React.RefObject<HTMLElement | null>
  messages: ChatMessage[]
  searchState: SearchState
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

  // 计算匹配结果
  const matches = useMemo(() => {
    if (!searchState.isOpen || !searchState.query.trim()) {
      return []
    }
    return findAllMatches(messages, searchState.query, searchOptions)
  }, [messages, searchState.isOpen, searchState.query, searchOptions])

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
    (index: number) => {
      const container = containerRef.current
      if (!container || matches.length === 0) return

      const match = matches[index]
      if (!match) return

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
    [containerRef, matches]
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

  // 收集所有文本节点
  const textNodes: Text[] = []
  const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT, null)
  let node: Text | null
  while ((node = walker.nextNode() as Text)) {
    if (node.textContent) {
      textNodes.push(node)
    }
  }

  // 在文本节点中查找所有匹配位置
  // 首先拼接所有文本节点的内容
  let fullText = ''
  const nodeOffsets: { node: Text; start: number; end: number }[] = []
  for (const textNode of textNodes) {
    const text = textNode.textContent ?? ''
    nodeOffsets.push({
      node: textNode,
      start: fullText.length,
      end: fullText.length + text.length
    })
    fullText += text
  }

  // 找到第 N 个匹配（根据 globalIndex 在该消息中的位置）
  // 计算这是该消息中的第几个匹配
  const matchIndexInMessage = countMatchesBefore(messages, match)

  let currentMatchIndex = 0
  let searchStartIndex = 0

  while (true) {
    const idx = fullText.indexOf(matchText, searchStartIndex)
    if (idx === -1) break

    if (currentMatchIndex === matchIndexInMessage) {
      // 找到了目标匹配，创建 Range
      return createRangeFromFullTextOffset(nodeOffsets, idx, idx + matchText.length)
    }

    currentMatchIndex++
    searchStartIndex = idx + 1
  }

  return null
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

/**
 * 根据拼接文本的偏移量创建 Range
 */
function createRangeFromFullTextOffset(
  nodeOffsets: { node: Text; start: number; end: number }[],
  startOffset: number,
  endOffset: number
): Range | null {
  let startNode: Text | null = null
  let startLocalOffset = 0
  let endNode: Text | null = null
  let endLocalOffset = 0

  for (const { node, start, end } of nodeOffsets) {
    // 查找起始节点
    if (!startNode && startOffset >= start && startOffset < end) {
      startNode = node
      startLocalOffset = startOffset - start
    }

    // 查找结束节点
    if (endOffset > start && endOffset <= end) {
      endNode = node
      endLocalOffset = endOffset - start
    }

    if (startNode && endNode) break
  }

  if (!startNode || !endNode) return null

  try {
    const range = document.createRange()
    range.setStart(startNode, startLocalOffset)
    range.setEnd(endNode, endLocalOffset)
    return range
  } catch {
    return null
  }
}
