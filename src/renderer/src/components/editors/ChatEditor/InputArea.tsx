import React, { useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react'
import { Input, Button } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import { SendOutlined, StopOutlined } from '@ant-design/icons'
import { ModelSelector } from './ModelSelector'
import { ModelConfigSelector } from './ModelConfigSelector'
import { useChatUIStore } from '../../../stores/chatUIStore'

const { TextArea } = Input

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

  // pageId 变化时自动聚焦
  useEffect(() => {
    textAreaRef.current?.focus()
  }, [pageId])

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
      <TextArea
        ref={textAreaRef}
        className="chat-editor__textarea"
        value={content}
        onChange={(e) => setInputContent(pageId, e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入消息..."
        autoSize={{ minRows: 2, maxRows: 6 }}
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
