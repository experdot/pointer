import { t, useI18n } from '@renderer/i18n'
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
import { useTabsStore } from '../../../stores/tabsStore'
import { useAttachment } from '../../../hooks/useAttachment'
import { openSettings } from '../../../services/settingsService'
import type { AttachmentRef } from '@renderer/types/shared'
import './InputArea.css'

const { TextArea } = Input

export interface InputAreaRef {
  appendText: (text: string) => void
}

interface InputAreaProps {
  pageId: string
  onSend: (content: string, attachments?: AttachmentRef[]) => Promise<void>
  onStop: () => Promise<void>
  isStreaming: boolean
  disabled?: boolean
  hasLLMConfig: boolean
  hasDefaultLLM: boolean
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
    hasLLMConfig,
    hasDefaultLLM,
    queueCount,
    isPaused,
    onQueueButtonClick,
    onResumeQueue
  },
  ref
) {
  useI18n()

  // 只订阅本页的输入内容与需要的 action：在别的页签打字不再重渲染这个输入框
  const content = useChatUIStore((state) => state.getState(pageId).inputContent)
  const setInputContent = useChatUIStore((state) => state.setInputContent)
  const { pendingAttachments, addAttachments, addAttachmentsFromSelector, removeAttachment } =
    useAttachment(pageId)
  const textAreaRef = useRef<TextAreaRef>(null)
  const sending = useRef(false)
  const composing = useRef(false)
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const attachmentAction = useCallback(async (action: () => Promise<void>) => {
    setSendError(null)
    try {
      await action()
    } catch (error) {
      setSendError(error instanceof Error ? error.message : t('attachment.failed'))
    }
  }, [])

  // 获取当前 tab 的活跃状态
  const isTabActive = useTabsStore((state) => {
    const tab = state.tabs.find((t) => t.dataId === pageId)
    return tab ? tab.id === state.activeTabId : false
  })

  // 拖拽上传状态
  const [isDragOver, setIsDragOver] = useState(false)

  // tab 变为活跃时自动聚焦
  useEffect(() => {
    if (!isTabActive) return
    const timer = setTimeout(() => {
      textAreaRef.current?.focus()
    }, 0)
    return () => clearTimeout(timer)
  }, [isTabActive])

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
        await attachmentAction(() => addAttachments(files))
      }
    },
    [addAttachments, attachmentAction]
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
        await attachmentAction(() => addAttachments(imageFiles))
      }
    },
    [addAttachments, attachmentAction]
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

  const blurInput = useCallback(() => {
    textAreaRef.current?.blur()
  }, [])

  const handleSend = useCallback(async () => {
    const trimmed = content.trim()
    // 允许仅发送附件（无文本）
    if (!trimmed && pendingAttachments.length === 0) return
    if (disabled || !hasLLMConfig || !hasDefaultLLM || sending.current) return
    if (isStreaming && pendingAttachments.length) {
      setSendError(t('queue.noAttachments'))
      return
    }

    const attachmentsToSend = pendingAttachments.length > 0 ? [...pendingAttachments] : undefined
    sending.current = true
    setIsSending(true)
    setSendError(null)
    try {
      await onSend(trimmed, attachmentsToSend)
      const store = useChatUIStore.getState()
      // 只确认本次提交的草稿，等待期间的新文字和新附件属于下一条消息。
      if (store.getState(pageId).inputContent === content) setInputContent(pageId, '')
      for (const attachment of attachmentsToSend ?? [])
        store.removePendingAttachment(pageId, attachment.id)
      focusInput()
    } catch (error) {
      setSendError(error instanceof Error ? error.message : String(error))
    } finally {
      sending.current = false
      setIsSending(false)
    }
  }, [
    content,
    pendingAttachments,
    disabled,
    onSend,
    focusInput,
    pageId,
    setInputContent,
    hasLLMConfig,
    hasDefaultLLM,
    isStreaming
  ])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (composing.current || e.nativeEvent.isComposing || e.keyCode === 229) return
      if (e.key === 'Escape') {
        e.preventDefault()
        blurInput()
        return
      }

      // Enter 发送，Shift+Enter 换行
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [blurInput, handleSend]
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
          {t('common.stop')}
        </Button>
      )
    }

    if (showResumeQueue) {
      // 继续队列按钮
      return (
        <Button type="primary" icon={<CaretRightOutlined />} onClick={onResumeQueue}>
          {t('queue.resume')}
        </Button>
      )
    }

    // 发送按钮
    return (
      <Button
        aria-label={t('chat.send')}
        type="primary"
        icon={<SendOutlined />}
        onClick={handleSend}
        loading={isSending}
        disabled={(!content.trim() && pendingAttachments.length === 0) || disabled}
      >
        {t('chat.send')}
      </Button>
    )
  }

  // 输入区域是否禁用（未配置 LLM 或未选择默认模型）
  const isInputDisabled = disabled || !hasLLMConfig || !hasDefaultLLM

  // 覆盖层提示内容
  const renderOverlay = (): React.ReactNode => {
    if (!hasLLMConfig) {
      return (
        <span className="chat-editor__no-config-text">
          {t('ai.notConfigured')}
          <a onClick={() => openSettings('llm')}>{t('ai.configure')}</a>
        </span>
      )
    }
    if (!hasDefaultLLM) {
      return <span className="chat-editor__no-config-text">{t('ai.selectFirst')}</span>
    }
    return null
  }

  const overlayContent = renderOverlay()

  return (
    <div
      className={`chat-editor__input ${isDragOver ? 'chat-editor__input--drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 待发送附件预览 */}
      {pendingAttachments.length > 0 && (
        <AttachmentPreview
          attachments={pendingAttachments}
          onRemove={(id) => void attachmentAction(() => removeAttachment(id))}
        />
      )}

      <div className="chat-editor__textarea-wrapper">
        <TextArea
          aria-label={t('chat.messageContent')}
          ref={textAreaRef}
          className="chat-editor__textarea"
          value={content}
          onChange={(e) => setInputContent(pageId, e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            composing.current = true
          }}
          onCompositionEnd={() => {
            composing.current = false
          }}
          onPaste={handlePaste}
          placeholder={t('chat.inputPlaceholder')}
          autoSize={{ minRows: 2, maxRows: 10 }}
          disabled={isInputDisabled}
          autoFocus
        />
        {/* 提示覆盖层 */}
        {overlayContent && (
          <div className="chat-editor__input-no-config-overlay">{overlayContent}</div>
        )}
      </div>

      {sendError && (
        <div role="alert" className="chat-editor__send-error">
          {sendError}
        </div>
      )}

      <div className="chat-editor__input-toolbar">
        <div className="chat-editor__input-toolbar-left">
          <Tooltip title={t('attachment.addImage')}>
            <Button
              aria-label={t('attachment.addImage')}
              type="text"
              className="chat-editor__attachment-btn"
              icon={<PictureOutlined />}
              onClick={() => void attachmentAction(addAttachmentsFromSelector)}
              disabled={isInputDisabled || isStreaming}
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
          <span>{t('attachment.dropImages')}</span>
        </div>
      )}
    </div>
  )
})
