import React, { useState, useEffect } from 'react'
import { CloseOutlined, LoadingOutlined } from '@ant-design/icons'
import type { FileAttachment } from '../../../types/type'
import { getAttachmentDataUrl } from '../../../hooks/useAttachment'

interface AttachmentPreviewProps {
  attachments: FileAttachment[]
  onRemove: (attachmentId: string) => void
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ attachments, onRemove }) => {
  if (attachments.length === 0) return null

  return (
    <div className="attachment-preview">
      {attachments.map((attachment) => (
        <AttachmentPreviewItem
          key={attachment.id}
          attachment={attachment}
          onRemove={() => onRemove(attachment.id)}
        />
      ))}
    </div>
  )
}

const AttachmentPreviewItem: React.FC<{
  attachment: FileAttachment
  onRemove: () => void
}> = ({ attachment, onRemove }) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadThumbnail = async () => {
      try {
        const dataUrl = await getAttachmentDataUrl(attachment)
        if (!cancelled) {
          setThumbnail(dataUrl)
          setError(false)
        }
      } catch (err) {
        console.error('Failed to load thumbnail:', err)
        if (!cancelled) {
          setError(true)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadThumbnail()

    return () => {
      cancelled = true
    }
  }, [attachment])

  return (
    <div className="attachment-preview__item">
      {loading ? (
        <div className="attachment-preview__loading">
          <LoadingOutlined />
        </div>
      ) : error ? (
        <div className="attachment-preview__error">!</div>
      ) : (
        <img src={thumbnail!} alt={attachment.name} />
      )}
      <button
        className="attachment-preview__remove"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        title="移除"
      >
        <CloseOutlined />
      </button>
      <div className="attachment-preview__name" title={attachment.name}>
        {attachment.name}
      </div>
    </div>
  )
}
