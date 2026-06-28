import React, { useState, useEffect, useCallback } from 'react'
import type { FileAttachment } from '../../../types/type'
import { getAttachmentDataUrl } from '../../../hooks/useAttachment'
import { ImagePreviewModal } from '../../common/ImagePreviewModal'
import './MessageAttachments.css'

interface MessageAttachmentsProps {
  attachments: FileAttachment[]
}

export const MessageAttachments: React.FC<MessageAttachmentsProps> = ({ attachments }) => {
  const [previewImage, setPreviewImage] = useState<{
    visible: boolean
    src: string
    name: string
  }>({ visible: false, src: '', name: '' })

  const handleImageClick = useCallback(async (attachment: FileAttachment) => {
    try {
      const dataUrl = await getAttachmentDataUrl(attachment)
      setPreviewImage({
        visible: true,
        src: dataUrl,
        name: attachment.name
      })
    } catch (error) {
      console.error('Failed to load image:', error)
    }
  }, [])

  const handleClosePreview = useCallback(() => {
    setPreviewImage({ visible: false, src: '', name: '' })
  }, [])

  if (!attachments || attachments.length === 0) return null

  // 只显示图片附件
  const imageAttachments = attachments.filter((a) => a.type.startsWith('image/'))
  if (imageAttachments.length === 0) return null

  return (
    <>
      <div className="message-attachments">
        {imageAttachments.map((attachment) => (
          <AttachmentThumbnail
            key={attachment.id}
            attachment={attachment}
            onClick={() => handleImageClick(attachment)}
          />
        ))}
      </div>

      <ImagePreviewModal
        visible={previewImage.visible}
        src={previewImage.src}
        name={previewImage.name}
        onClose={handleClosePreview}
      />
    </>
  )
}

const AttachmentThumbnail: React.FC<{
  attachment: FileAttachment
  onClick: () => void
}> = ({ attachment, onClick }) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadThumbnail = async (): Promise<void> => {
      try {
        const dataUrl = await getAttachmentDataUrl(attachment)
        if (!cancelled) {
          setThumbnail(dataUrl)
        }
      } catch (error) {
        console.error('Failed to load thumbnail:', error)
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
    <div className="message-attachments__item" onClick={onClick} title={attachment.name}>
      {loading ? (
        <div className="message-attachments__placeholder" />
      ) : thumbnail ? (
        <img src={thumbnail} alt={attachment.name} />
      ) : (
        <div className="message-attachments__error">!</div>
      )}
    </div>
  )
}
