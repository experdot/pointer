import { useState, useEffect, useRef } from 'react'

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
  const userManuallyChanged = useRef(false) // 跟踪用户是否手动改变了展开状态
  const prevReasoningContent = useRef<string | undefined>('')
  const prevCurrentContent = useRef<string | undefined>('')

  useEffect(() => {
    // 检测是否是推理内容首次出现或正在输出
    const reasoningJustStarted = !prevReasoningContent.current && reasoningContent
    const reasoningIsUpdating = prevReasoningContent.current !== reasoningContent && isStreaming

    // 检测是否从推理阶段转到回答阶段
    const justStartedAnswering = !prevCurrentContent.current && currentContent && reasoningContent

    if (reasoningContent) {
      // 只在自动触发的场景下改变状态（用户没有手动操作过）
      if (!userManuallyChanged.current) {
        if ((reasoningJustStarted || reasoningIsUpdating) && !currentContent) {
          // 思考过程输出时自动展开（还没有最终回答内容）
          setReasoningExpanded(['reasoning_content'])
        } else if (justStartedAnswering) {
          // 开始输出最终回答时自动折叠
          setReasoningExpanded([])
        }
      }
    }

    // 更新引用
    prevReasoningContent.current = reasoningContent
    prevCurrentContent.current = currentContent
  }, [isStreaming, reasoningContent, currentContent])

  // 当流结束时重置用户手动操作标志
  useEffect(() => {
    if (!isStreaming) {
      userManuallyChanged.current = false
    }
  }, [isStreaming])

  const handleReasoningExpandChange = (keys: string | string[]) => {
    // 标记用户手动改变了状态
    userManuallyChanged.current = true
    setReasoningExpanded(Array.isArray(keys) ? keys : [keys].filter(Boolean))
  }

  return {
    reasoningExpanded,
    handleReasoningExpandChange
  }
}
