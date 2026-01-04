import React, {
  useRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState
} from 'react'
import { Input, Button, Tooltip } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import { SendOutlined, StopOutlined, CaretRightOutlined, PictureOutlined } from '@ant-design/icons'
import { ModelSelector } from './ModelSelector'
import { ModelConfigSelector } from './ModelConfigSelector'
import { QueueButton } from './QueueButton'
import { AttachmentPreview } from './AttachmentPreview'
import { useChatUIStore } from '../../../stores/chatUIStore'
import { useAttachment } from '../../../hooks/useAttachment'
import type { FileAttachment } from '../../../types/type'

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
  onSend: (content: string, attachments?: FileAttachment[]) => Promise<void>
  onStop: () => Promise<void>
  isStreaming: boolean
  disabled?: boolean
  // 队列相关
  queueCount: number
  isPaused: boolean
  onQueueButtonClick: () => void
  onResumeQueue: () => Promise<void>
}

export const InputArea = forwardRef<InputAreaRef, InputAreaProps>(function InputArea(
  {
    pageId,
    onSend,
    onStop,
    isStreaming,
    disabled,
    queueCount,
    isPaused,
    onQueueButtonClick,
    onResumeQueue
  },
  ref
) {
  const { getState, setInputContent, clearPendingAttachments } = useChatUIStore()
  const content = getState(pageId).inputContent
  const { pendingAttachments, addAttachments, addAttachmentsFromSelector, removeAttachment } =
    useAttachment(pageId)
  const textAreaRef = useRef<TextAreaRef>(null)

  // 拖拽调整高度相关状态
  const [textareaHeight, setTextareaHeight] = useState(LINE_HEIGHT * 2 + PADDING) // 默认 2 行
  const resizing = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  // 拖拽上传状态
  const [isDragOver, setIsDragOver] = useState(false)

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

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      resizing.current = true
      startY.current = e.clientY
      startHeight.current = textareaHeight
    },
    [textareaHeight]
  )

  // 拖拽上传处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const files = e.dataTransfer.files
      if (files.length > 0) {
        await addAttachments(files)
      }
    },
    [addAttachments]
  )

  // 粘贴图片处理
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items
      const imageFiles: File[] = []

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            imageFiles.push(file)
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault()
        await addAttachments(imageFiles)
      }
    },
    [addAttachments]
  )

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
    // 允许仅发送附件（无文本）
    if (!trimmed && pendingAttachments.length === 0) return
    if (disabled) return

    const attachmentsToSend = pendingAttachments.length > 0 ? [...pendingAttachments] : undefined
    setInputContent(pageId, '')
    clearPendingAttachments(pageId)
    await onSend(trimmed, attachmentsToSend)
    focusInput()
  }, [
    content,
    pendingAttachments,
    disabled,
    onSend,
    focusInput,
    pageId,
    setInputContent,
    clearPendingAttachments
  ])

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

  // 按钮状态判断
  const showResumeQueue = !isStreaming && queueCount > 0 && isPaused

  // 渲染主按钮
  const renderMainButton = (): React.JSX.Element => {
    if (isStreaming) {
      // 停止按钮
      return (
        <Button type="default" danger icon={<StopOutlined />} onClick={handleStop}>
          停止
        </Button>
      )
    }

    if (showResumeQueue) {
      // 继续队列按钮
      return (
        <Button type="primary" icon={<CaretRightOutlined />} onClick={onResumeQueue}>
          继续队列
        </Button>
      )
    }

    // 发送按钮
    return (
      <Button
        type="primary"
        icon={<SendOutlined />}
        onClick={handleSend}
        disabled={(!content.trim() && pendingAttachments.length === 0) || disabled}
      >
        发送
      </Button>
    )
  }

  return (
    <div
      className={`chat-editor__input ${isDragOver ? 'chat-editor__input--drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="chat-editor__input-resizer" onMouseDown={handleResizeMouseDown} />

      {/* 待发送附件预览 */}
      {pendingAttachments.length > 0 && (
        <AttachmentPreview attachments={pendingAttachments} onRemove={removeAttachment} />
      )}

      <TextArea
        ref={textAreaRef}
        className="chat-editor__textarea"
        value={content}
        onChange={(e) => setInputContent(pageId, e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder="输入消息..."
        style={{ height: textareaHeight, minHeight: textareaHeight, maxHeight: textareaHeight }}
        disabled={disabled}
        autoFocus
      />
      <div className="chat-editor__input-toolbar">
        <div className="chat-editor__input-toolbar-left">
          <Tooltip title="添加图片">
            <Button
              type="text"
              icon={<PictureOutlined />}
              onClick={addAttachmentsFromSelector}
              disabled={disabled || isStreaming}
            />
          </Tooltip>
          <ModelSelector onSelect={focusInput} />
          <ModelConfigSelector onSelect={focusInput} />
        </div>
        <div className="chat-editor__input-toolbar-right">
          <QueueButton count={queueCount} onClick={onQueueButtonClick} />
          {renderMainButton()}
        </div>
      </div>

      {/* 拖拽提示覆盖层 */}
      {isDragOver && (
        <div className="chat-editor__input-drag-overlay">
          <PictureOutlined />
          <span>释放以添加图片</span>
        </div>
      )}
    </div>
  )
})
