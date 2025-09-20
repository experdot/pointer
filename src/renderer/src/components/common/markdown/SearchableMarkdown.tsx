import React, { useEffect, useRef } from 'react'
import { Markdown } from './Markdown'

interface SearchableMarkdownProps {
  content: string
  searchQuery?: string
  messageId?: string
  getCurrentMatch?: () => { messageId: string; startIndex: number; endIndex: number } | null
  getHighlightInfo?: (text: string, messageId: string) => { text: string; highlights: Array<{ start: number; end: number; isCurrentMatch: boolean }> }
  loading?: boolean
  fontSize?: number
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>
  onDoubleClickCapture?: React.MouseEventHandler<HTMLDivElement>
}

const SearchableMarkdown: React.FC<SearchableMarkdownProps> = ({
  content,
  searchQuery,
  messageId,
  getCurrentMatch,
  getHighlightInfo,
  loading,
  fontSize,
  onContextMenu,
  onDoubleClickCapture
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // 使用useEffect在DOM渲染后应用高亮
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current

    // 清除所有高亮
    const removeHighlights = () => {
      const highlights = container.querySelectorAll('.search-highlight')
      highlights.forEach(highlight => {
        const parent = highlight.parentNode
        if (parent) {
          const text = document.createTextNode(highlight.textContent || '')
          parent.replaceChild(text, highlight)
          parent.normalize()
        }
      })
    }

    // 先清除旧高亮
    removeHighlights()

    // 如果没有搜索查询，直接返回
    if (!searchQuery || !searchQuery.trim()) {
      return
    }

    // 应用新高亮
    const applyHighlights = () => {
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null
      )

      const textNodes: Text[] = []
      let node
      while (node = walker.nextNode()) {
        textNodes.push(node as Text)
      }

      const query = searchQuery.toLowerCase()
      const currentMatch = getCurrentMatch?.()
      let globalMatchIndex = 0

      textNodes.forEach(textNode => {
        const text = textNode.textContent || ''
        const lowerText = text.toLowerCase()

        if (lowerText.includes(query)) {
          const fragment = document.createDocumentFragment()
          let lastIndex = 0

          while (true) {
            const index = lowerText.indexOf(query, lastIndex)
            if (index === -1) break

            // 添加匹配前的文本
            if (index > lastIndex) {
              fragment.appendChild(document.createTextNode(text.slice(lastIndex, index)))
            }

            // 创建高亮元素
            const isCurrentMatch = currentMatch?.messageId === messageId && globalMatchIndex === 0
            const mark = document.createElement('mark')
            mark.className = `search-highlight ${isCurrentMatch ? 'current-match' : ''}`
            mark.textContent = text.slice(index, index + query.length)
            fragment.appendChild(mark)

            globalMatchIndex++
            lastIndex = index + query.length
          }

          // 添加剩余文本
          if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex)))
          }

          // 替换原文本节点
          if (textNode.parentNode && fragment.childNodes.length > 0) {
            textNode.parentNode.replaceChild(fragment, textNode)
          }
        }
      })
    }

    // 延迟执行以确保DOM准备就绪
    const timeoutId = setTimeout(applyHighlights, 10)

    return () => {
      clearTimeout(timeoutId)
      removeHighlights()
    }
  }, [searchQuery, messageId, getCurrentMatch, content])

  return (
    <div ref={containerRef}>
      <Markdown
        content={content}
        loading={loading}
        fontSize={fontSize}
        onContextMenu={onContextMenu}
        onDoubleClickCapture={onDoubleClickCapture}
      />
    </div>
  )
}

export default SearchableMarkdown