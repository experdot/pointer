import React, { useState, useCallback } from 'react'
import { Button, Tooltip, Input } from 'antd'
import {
  CloseOutlined,
  CheckOutlined,
  SendOutlined,
  PictureOutlined
} from '@ant-design/icons'
import { AttachmentPreview } from '../AttachmentPreview'
import { selectAndSaveAttachments } from '../../../../hooks/useAttachment'
import { fileToBase64, generateFileId, filterImageFiles } from './utils'
import type { MessageEditModeProps } from './types'

const { TextArea } = Input

export const MessageEditMode = React.memo(function MessageEditMode({
  content,
  attachments,
  isUser,
  onContentChange,
  onAttachmentsChange,
  onCancel,
  onSave,
  onSaveAndResend
}: MessageEditModeProps): React.JSX.Element {
  const [isEditDragOver, setIsEditDragOver] = useState(false)

  const handleRemoveAttachment = useCallback(
    (attachmentId: string): void => {
      onAttachmentsChange(attachments.filter((a) => a.id !== attachmentId))
    },
    [attachments, onAttachmentsChange]
  )

  const handleAddAttachments = useCallback(async (): Promise<void> => {
    const newAttachments = await selectAndSaveAttachments()
    if (newAttachments.length > 0) {
      onAttachmentsChange([...attachments, ...newAttachments])
    }
  }, [attachments, onAttachmentsChange])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      setIsEditDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsEditDragOver(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsEditDragOver(false)

      const files = filterImageFiles(e.dataTransfer.files)
      if (files.length === 0) return

      const newAttachments = [...attachments]
      for (const file of files) {
        const base64 = await fileToBase64(file)
        const fileId = generateFileId()
        const result = await window.api.attachment.save({
          fileId,
          fileName: file.name,
          base64Content: base64
        })

        if (result.success && result.localPath) {
          newAttachments.push({
            id: fileId,
            name: file.name,
            type: file.type,
            size: file.size,
            localPath: result.localPath,
            createdAt: Date.now()
          })
        }
      }
      onAttachmentsChange(newAttachments)
    },
    [attachments, onAttachmentsChange]
  )

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items
      const imageFiles: File[] = []

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) imageFiles.push(file)
        }
      }

      if (imageFiles.length === 0) return

      e.preventDefault()

      const newAttachments = [...attachments]
      for (const file of imageFiles) {
        const base64 = await fileToBase64(file)
        const fileId = generateFileId()
        const result = await window.api.attachment.save({
          fileId,
          fileName: file.name,
          base64Content: base64
        })

        if (result.success && result.localPath) {
          newAttachments.push({
            id: fileId,
            name: file.name,
            type: file.type,
            size: file.size,
            localPath: result.localPath,
            createdAt: Date.now()
          })
        }
      }
      onAttachmentsChange(newAttachments)
    },
    [attachments, onAttachmentsChange]
  )

  return (
    <div
      className={`message-item__edit ${isUser && isEditDragOver ? 'message-item__edit--drag-over' : ''}`}
      onDragOver={isUser ? handleDragOver : undefined}
      onDragLeave={isUser ? handleDragLeave : undefined}
      onDrop={isUser ? handleDrop : undefined}
    >
      {/* 用户消息编辑时显示附件预览 */}
      {isUser && attachments.length > 0 && (
        <AttachmentPreview attachments={attachments} onRemove={handleRemoveAttachment} />
      )}
      <TextArea
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        onPaste={isUser ? handlePaste : undefined}
        autoSize={{ minRows: 2, maxRows: 10 }}
        autoFocus
      />
      <div className="message-item__edit-actions">
        {isUser && (
          <Tooltip title="添加图片">
            <Button type="text" icon={<PictureOutlined />} onClick={handleAddAttachments} />
          </Tooltip>
        )}
        <Button icon={<CloseOutlined />} onClick={onCancel}>
          取消
        </Button>
        <Button icon={<CheckOutlined />} onClick={onSave}>
          保存
        </Button>
        {isUser && onSaveAndResend && (
          <Button type="primary" icon={<SendOutlined />} onClick={onSaveAndResend}>
            保存并重发
          </Button>
        )}
      </div>
      {/* 拖拽提示 */}
      {isUser && isEditDragOver && (
        <div className="message-item__edit-drag-overlay">
          <PictureOutlined />
          <span>释放以添加图片</span>
        </div>
      )}
    </div>
  )
})
