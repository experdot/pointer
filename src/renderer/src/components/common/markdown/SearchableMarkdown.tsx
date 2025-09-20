import React, { useEffect, useRef } from 'react'
import { Markdown } from './Markdown'

interface SearchableMarkdownProps {
  content: string
  searchQuery?: string
  messageId?: string
  getCurrentMatch?: () => { messageId: string; startIndex: number; endIndex: number } | null
  getHighlightInfo?: (text: string, messageId: string) => { text: string; highlights: Array<{ start: number; end: number; isCurrentMatch: boolean }> }
  currentMatchIndex?: number
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
  currentMatchIndex,
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

      // 先计算这个消息中的所有匹配位置
      let globalCharIndex = 0
      const allMatches: Array<{ node: Text; start: number; end: number; globalStart: number }> = []

      textNodes.forEach(textNode => {
        const text = textNode.textContent || ''
        const lowerText = text.toLowerCase()
        let localIndex = 0

        while (true) {
          const index = lowerText.indexOf(query, localIndex)
          if (index === -1) break

          allMatches.push({
            node: textNode,
            start: index,
            end: index + query.length,
            globalStart: globalCharIndex + index
          })

          localIndex = index + 1
        }
        globalCharIndex += text.length
      })

      // 计算这个消息是否包含当前匹配，以及是第几个
      let currentMatchIndexInMessage = -1
      if (currentMatch?.messageId === messageId && allMatches.length > 0) {
        // 这个消息包含当前匹配
        // 使用matchIndex（消息内的索引）来确定高亮哪个
        const targetMatchIndex = currentMatch.matchIndex || 0

        // 确保索引在有效范围内
        if (targetMatchIndex < allMatches.length) {
          currentMatchIndexInMessage = targetMatchIndex
        } else {
          // 如果索引超出范围，高亮第一个
          currentMatchIndexInMessage = 0
        }
      }

      // 处理每个文本节点的高亮
      textNodes.forEach(textNode => {
        const text = textNode.textContent || ''
        const lowerText = text.toLowerCase()
        const nodeMatches = allMatches.filter(m => m.node === textNode)

        if (nodeMatches.length > 0) {
          const fragment = document.createDocumentFragment()
          let lastIndex = 0

          nodeMatches.forEach((match, matchIndex) => {
            // 添加匹配前的文本
            if (match.start > lastIndex) {
              fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.start)))
            }

            // 检查是否是当前匹配项
            const messageMatchIndex = allMatches.indexOf(match)
            const isCurrentMatch = messageMatchIndex === currentMatchIndexInMessage

            // 创建高亮元素
            const mark = document.createElement('mark')
            mark.className = `search-highlight ${isCurrentMatch ? 'current-match' : ''}`
            // 添加data属性以便定位
            mark.setAttribute('data-message-id', messageId || '')
            mark.setAttribute('data-match-index', messageMatchIndex.toString())
            mark.textContent = text.slice(match.start, match.end)
            fragment.appendChild(mark)

            lastIndex = match.end
          })

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
  }, [searchQuery, messageId, getCurrentMatch, content, currentMatchIndex]) // 添加currentMatchIndex作为依赖

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