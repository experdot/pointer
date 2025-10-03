import { useState, useEffect } from 'react'

interface UseReasoningContentProps {
  reasoningContent?: string
  isStreaming: boolean
  currentContent?: string
}

export function useReasoningContent({
  reasoningContent,
  isStreaming,
  currentContent
}: UseReasoningContentProps) {
  const [reasoningExpanded, setReasoningExpanded] = useState<string[]>([])

  useEffect(() => {
    if (reasoningContent) {
      if (isStreaming && !currentContent) {
        // 思考过程输出时自动展开（还没有最终回答内容）
        setReasoningExpanded(['reasoning_content'])
      } else {
        // 思考过程结束时自动折叠（开始输出最终回答或流结束）
        setReasoningExpanded([])
      }
    }
  }, [isStreaming, reasoningContent, currentContent])

  const handleReasoningExpandChange = (keys: string | string[]) => {
    setReasoningExpanded(Array.isArray(keys) ? keys : [keys].filter(Boolean))
  }

  return {
    reasoningExpanded,
    handleReasoningExpandChange
  }
}
