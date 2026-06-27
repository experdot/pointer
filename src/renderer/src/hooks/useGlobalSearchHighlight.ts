import { useEffect, useRef } from 'react'
import { useGlobalSearchStore } from '../stores/globalSearchStore'
import type { ChatMessage } from '../types/type'

interface UseGlobalSearchHighlightOptions {
  containerRef: React.RefObject<HTMLElement | null>
  messages: ChatMessage[]
  pageId: string
}

const MAX_HIGHLIGHT_RETRY_COUNT = 20

/**
 * 全局搜索高亮 Hook
 * 处理从全局搜索跳转后的文本高亮显示
 *
 * 高亮清除时机（VSCode 风格）：
 * - 点击另一个搜索结果 → 替换高亮（由 setHighlightMatch 处理）
 * - 关闭全局搜索面板 → 清除高亮（由 clearSearch/reset 处理）
 * - 切换到其他 tab → 清除高亮（pageId 变化时清除）
 * - 开始新的搜索 → 清除高亮（由 setQuery 时 setHighlightMatch(null) 处理）
 */
export function useGlobalSearchHighlight({
  containerRef,
  messages,
  pageId
}: UseGlobalSearchHighlightOptions): void {
  const highlightMatch = useGlobalSearchStore((state) => state.highlightMatch)
  const rangeRef = useRef<Range | null>(null)

  // 应用高亮
  useEffect(() => {
    // 清除之前的高亮
    if ('highlights' in CSS) {
      CSS.highlights.delete('global-search-highlight')
    }
    rangeRef.current = null

    const container = containerRef.current
    // 如果没有高亮匹配，或者当前页面不是高亮目标页面，则不应用高亮
    if (!container || !highlightMatch || highlightMatch.pageId !== pageId) {
      return
    }

    if (!('highlights' in CSS)) {
      return
    }

    // 按帧重试，消息一渲染出来就立即高亮并滚动
    let retryCount = 0
    let frameId = 0

    const applyHighlight = (): void => {
      const messageEl = container.querySelector(`[data-message-id="${highlightMatch.messageId}"]`)
      if (!messageEl) {
        if (retryCount < MAX_HIGHLIGHT_RETRY_COUNT) {
          retryCount++
          frameId = requestAnimationFrame(applyHighlight)
        }
        return
      }

      const contentEl = messageEl.querySelector('.message-item__body')
      if (!contentEl) {
        if (retryCount < MAX_HIGHLIGHT_RETRY_COUNT) {
          retryCount++
          frameId = requestAnimationFrame(applyHighlight)
        }
        return
      }

      // 获取消息内容
      const messageContent = messages.find((m) => m.id === highlightMatch.messageId)?.content ?? ''
      const matchText = messageContent.slice(highlightMatch.contentStart, highlightMatch.contentEnd)
      if (!matchText) return

      // 收集文本节点
      const textNodes: Text[] = []
      const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT, null)
      let node: Text | null
      while ((node = walker.nextNode() as Text)) {
        if (node.textContent) {
          textNodes.push(node)
        }
      }

      // 拼接所有文本节点的内容
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

      // 找到匹配位置（基于原始内容位置在渲染后的 DOM 中查找）
      // 由于 Markdown 渲染可能改变位置，这里按“该消息中的第 N 个命中”定位
      const idx = findNthMatchIndex(
        fullText,
        matchText,
        highlightMatch.occurrenceIndexInMessage ?? 0
      )
      if (idx === -1) {
        if (retryCount < MAX_HIGHLIGHT_RETRY_COUNT) {
          retryCount++
          frameId = requestAnimationFrame(applyHighlight)
        }
        return
      }

      // 创建 Range
      const range = createRangeFromFullTextOffset(nodeOffsets, idx, idx + matchText.length)
      if (!range) {
        if (retryCount < MAX_HIGHLIGHT_RETRY_COUNT) {
          retryCount++
          frameId = requestAnimationFrame(applyHighlight)
        }
        return
      }

      rangeRef.current = range

      // 应用高亮
      try {
        const highlight = new Highlight(range)
        CSS.highlights.set('global-search-highlight', highlight)

        // 将目标命中滚动到容器可视区域中央，避免只停留在消息首个命中附近
        const rect = range.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        const targetScrollTop =
          container.scrollTop +
          rect.top -
          containerRect.top -
          containerRect.height / 2 +
          rect.height / 2

        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'instant'
        })
      } catch (e) {
        console.warn('Failed to apply global search highlight:', e)
      }
    }

    frameId = requestAnimationFrame(applyHighlight)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [containerRef, highlightMatch, messages, pageId])

  // 组件卸载或 pageId 变化时清除高亮
  useEffect(() => {
    return () => {
      if ('highlights' in CSS) {
        CSS.highlights.delete('global-search-highlight')
      }
    }
  }, [pageId])
}

function findNthMatchIndex(fullText: string, matchText: string, occurrenceIndex: number): number {
  let currentIndex = 0
  let searchStartIndex = 0

  while (true) {
    const idx = fullText.indexOf(matchText, searchStartIndex)
    if (idx === -1) return -1

    if (currentIndex === occurrenceIndex) {
      return idx
    }

    currentIndex++
    searchStartIndex = idx + 1
  }
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
