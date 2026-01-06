import { useEffect, useRef } from 'react'
import { useGlobalSearchStore } from '../stores/globalSearchStore'
import type { ChatMessage } from '../types/type'

interface UseGlobalSearchHighlightOptions {
  containerRef: React.RefObject<HTMLElement | null>
  messages: ChatMessage[]
  pageId: string
}

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

    // 延迟执行，确保 DOM 已渲染
    const applyHighlight = (): void => {
      const messageEl = container.querySelector(`[data-message-id="${highlightMatch.messageId}"]`)
      if (!messageEl) return

      const contentEl = messageEl.querySelector('.message-item__body')
      if (!contentEl) return

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
      // 由于 Markdown 渲染可能改变位置，我们搜索匹配文本
      const idx = fullText.indexOf(matchText)
      if (idx === -1) return

      // 创建 Range
      const range = createRangeFromFullTextOffset(nodeOffsets, idx, idx + matchText.length)
      if (!range) return

      rangeRef.current = range

      // 应用高亮
      try {
        const highlight = new Highlight(range)
        CSS.highlights.set('global-search-highlight', highlight)
      } catch (e) {
        console.warn('Failed to apply global search highlight:', e)
      }
    }

    // 延迟执行以确保 DOM 渲染完成
    const timerId = setTimeout(applyHighlight, 150)

    return () => {
      clearTimeout(timerId)
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
