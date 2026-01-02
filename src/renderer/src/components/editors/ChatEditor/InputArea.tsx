import React, { useRef, useCallback, useEffect, useImperativeHandle, forwardRef, useState } from 'react'
import { Input, Button } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import { SendOutlined, StopOutlined } from '@ant-design/icons'
import { ModelSelector } from './ModelSelector'
import { ModelConfigSelector } from './ModelConfigSelector'
import { useChatUIStore } from '../../../stores/chatUIStore'

const { TextArea } = Input

// 高度常量（基于 Ant Design TextArea 默认样式：line-height 1.5715 * 14px ≈ 22px + padding 8px）
const LINE_HEIGHT = 22
const PADDING = 8
const MIN_ROWS = 1
const MAX_ROWS = 10
const MIN_HEIGHT = LINE_HEIGHT * MIN_ROWS + PADDING
const MAX_HEIGHT = LINE_HEIGHT * MAX_ROWS + PADDING

export interface InputAreaRef {
  appendText: (text: string) => void
}

interface InputAreaProps {
  pageId: string
  onSend: (content: string) => Promise<void>
  onStop: () => Promise<void>
  isStreaming: boolean
  disabled?: boolean
}

export const InputArea = forwardRef<InputAreaRef, InputAreaProps>(function InputArea(
  { pageId, onSend, onStop, isStreaming, disabled },
  ref
) {
  const { getState, setInputContent } = useChatUIStore()
  const content = getState(pageId).inputContent
  const textAreaRef = useRef<TextAreaRef>(null)

  // 拖拽调整高度相关状态
  const [textareaHeight, setTextareaHeight] = useState(LINE_HEIGHT * 2 + PADDING) // 默认 2 行
  const resizing = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  // pageId 变化时自动聚焦
  useEffect(() => {
    textAreaRef.current?.focus()
  }, [pageId])

  // 拖拽事件处理
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!resizing.current) return
      const delta = startY.current - e.clientY
      const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight.current + delta))
      setTextareaHeight(newHeight)
    }

    const handleMouseUp = (): void => {
      resizing.current = false
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizing.current = true
    startY.current = e.clientY
    startHeight.current = textareaHeight
  }, [textareaHeight])

  useImperativeHandle(
    ref,
    () => ({
      appendText: (text: string) => {
        setInputContent(pageId, content + text)
        textAreaRef.current?.focus()
      }
    }),
    [pageId, content, setInputContent]
  )

  const focusInput = useCallback(() => {
    textAreaRef.current?.focus()
  }, [])

  const handleSend = useCallback(async () => {
    const trimmed = content.trim()
    if (!trimmed || isStreaming || disabled) return

    setInputContent(pageId, '')
    await onSend(trimmed)
    focusInput()
  }, [content, isStreaming, disabled, onSend, focusInput, pageId, setInputContent])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Enter 发送，Shift+Enter 换行
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleStop = useCallback(async () => {
    await onStop()
  }, [onStop])

  return (
    <div className="chat-editor__input">
      <div className="chat-editor__input-resizer" onMouseDown={handleResizeMouseDown} />
      <TextArea
        ref={textAreaRef}
        className="chat-editor__textarea"
        value={content}
        onChange={(e) => setInputContent(pageId, e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入消息..."
        style={{ height: textareaHeight, minHeight: textareaHeight, maxHeight: textareaHeight }}
        disabled={disabled}
        autoFocus
      />
      <div className="chat-editor__input-toolbar">
        <div className="chat-editor__input-toolbar-left">
          <ModelSelector onSelect={focusInput} />
          <ModelConfigSelector onSelect={focusInput} />
        </div>
        <div className="chat-editor__input-toolbar-right">
          {isStreaming ? (
            <Button type="default" danger icon={<StopOutlined />} onClick={handleStop}>
              停止
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              disabled={!content.trim() || disabled}
            >
              发送
            </Button>
          )}
        </div>
      </div>
    </div>
  )
})
