import React, { useState, useEffect } from 'react'
import { Card, Input, Button, Space, Image, Tooltip } from 'antd'
import { CheckOutlined, CloseOutlined, SendOutlined, FileImageOutlined, PaperClipOutlined } from '@ant-design/icons'
import { FileAttachment } from '../../../../types/type'
import { v4 as uuidv4 } from 'uuid'

const { TextArea } = Input

interface MessageEditFormProps {
  editContent: string
  isUserMessage: boolean
  isLoading: boolean
  onContentChange: (content: string) => void
  onSave: () => void
  onSaveAndResend: () => void
  onCancel: () => void
  containerRef: React.RefObject<HTMLDivElement>
  attachments?: FileAttachment[]
  onAttachmentsChange?: (attachments: FileAttachment[]) => void
}

export const MessageEditForm: React.FC<MessageEditFormProps> = ({
  editContent,
  isUserMessage,
  isLoading,
  onContentChange,
  onSave,
  onSaveAndResend,
  onCancel,
  containerRef,
  attachments = [],
  onAttachmentsChange
}) => {
  const [isSelectingFile, setIsSelectingFile] = useState(false)
  const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(new Map())

  // 加载附件预览
  useEffect(() => {
    const loadPreviews = async () => {
      const newUrls = new Map<string, string>()

      for (const attachment of attachments) {
        if (attachment.type.startsWith('image/')) {
          try {
            const result = await window.api.attachment.read(attachment.localPath)
            if (result.success && result.content) {
              const url = `data:${attachment.type};base64,${result.content}`
              newUrls.set(attachment.id, url)
            }
          } catch (error) {
            console.error('Failed to load attachment preview:', error)
          }
        }
      }

      setPreviewUrls(newUrls)
    }

    if (attachments.length > 0) {
      loadPreviews()
    } else {
      setPreviewUrls(new Map())
    }
  }, [attachments])

  // 处理文件选择
  const handleSelectFiles = async () => {
    try {
      setIsSelectingFile(true)
      const result = await window.api.selectFiles({
        multiple: true,
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (result.success && result.files) {
        const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
        const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp']

        const newAttachments: FileAttachment[] = []
        const errors: string[] = []

        for (const file of result.files) {
          if (file.size > MAX_FILE_SIZE) {
            errors.push(`${file.name}: 文件大小超过 10MB 限制`)
            continue
          }

          const ext = file.name.split('.').pop()?.toLowerCase()
          let mimeType = 'application/octet-stream'

          if (['jpg', 'jpeg'].includes(ext || '')) mimeType = 'image/jpeg'
          else if (ext === 'png') mimeType = 'image/png'
          else if (ext === 'gif') mimeType = 'image/gif'
          else if (ext === 'bmp') mimeType = 'image/bmp'
          else if (ext === 'webp') mimeType = 'image/webp'

          if (!SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
            errors.push(`${file.name}: 不支持的文件类型，仅支持图片格式`)
            continue
          }

          // 保存文件到本地临时目录
          const fileId = uuidv4()
          const saveResult = await window.api.attachment.save({
            fileId,
            fileName: file.name,
            base64Content: file.content
          })

          if (saveResult.success && saveResult.localPath) {
            const attachment: FileAttachment = {
              id: fileId,
              name: file.name,
              type: mimeType,
              size: file.size,
              localPath: saveResult.localPath,
              createdAt: Date.now()
            }
            newAttachments.push(attachment)
          } else {
            errors.push(`${file.name}: 文件保存失败`)
          }
        }

        if (errors.length > 0) {
          const { message } = await import('antd/es')
          errors.forEach(err => message.error(err))
        }

        if (newAttachments.length > 0 && onAttachmentsChange) {
          onAttachmentsChange([...attachments, ...newAttachments])
        }
      }
    } catch (error) {
      console.error('文件选择失败:', error)
      const { message } = await import('antd/es')
      message.error('文件选择失败，请重试')
    } finally {
      setIsSelectingFile(false)
    }
  }

  // 移除附件
  const handleRemoveAttachment = (attachmentId: string) => {
    if (onAttachmentsChange) {
      onAttachmentsChange(attachments.filter(att => att.id !== attachmentId))
    }
  }

  return (
    <Card size="small" className="message-card">
      <div className="message-edit-container" ref={containerRef}>
        {/* 文件附件显示（可编辑） */}
        {attachments && attachments.length > 0 && (
          <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  border: '1px solid #d9d9d9',
                  borderRadius: 4,
                  padding: 4,
                  background: '#fafafa'
                }}
              >
                {attachment.type.startsWith('image/') && previewUrls.get(attachment.id) ? (
                  <div style={{ position: 'relative' }}>
                    <Image
                      src={previewUrls.get(attachment.id)}
                      alt={attachment.name}
                      width={120}
                      height={120}
                      style={{ objectFit: 'cover', borderRadius: 2 }}
                      preview={{
                        mask: <div style={{ fontSize: 12 }}>预览</div>
                      }}
                    />
                    {onAttachmentsChange && (
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<CloseOutlined />}
                        onClick={() => handleRemoveAttachment(attachment.id)}
                        style={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          width: 20,
                          height: 20,
                          minWidth: 20,
                          padding: 0,
                          borderRadius: '50%',
                          background: 'white',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                      />
                    )}
                    <div style={{ fontSize: 11, marginTop: 4, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {attachment.name}
                    </div>
                  </div>
                ) : (
                  <Space>
                    <FileImageOutlined />
                    <span style={{ fontSize: 12 }}>{attachment.name}</span>
                    {onAttachmentsChange && (
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<CloseOutlined />}
                        onClick={() => handleRemoveAttachment(attachment.id)}
                      />
                    )}
                  </Space>
                )}
              </div>
            ))}
          </div>
        )}

        <TextArea
          value={editContent}
          onChange={(e) => onContentChange(e.target.value)}
          autoSize={{ minRows: 2, maxRows: 16 }}
          placeholder="编辑消息内容..."
        />
        <div className="message-edit-actions">
          <Space>
            {/* 文件上传按钮（仅用户消息） */}
            {isUserMessage && onAttachmentsChange && (
              <Tooltip title="添加图片">
                <Button
                  size="small"
                  icon={<PaperClipOutlined />}
                  onClick={handleSelectFiles}
                  loading={isSelectingFile}
                />
              </Tooltip>
            )}

            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={onSave}
              disabled={!editContent.trim()}
            >
              保存
            </Button>
            {isUserMessage && (
              <Button
                type="primary"
                size="small"
                icon={<SendOutlined />}
                onClick={onSaveAndResend}
                disabled={!editContent.trim() || isLoading}
                ghost
              >
                保存并重发
              </Button>
            )}
            <Button size="small" icon={<CloseOutlined />} onClick={onCancel}>
              取消
            </Button>
          </Space>
        </div>
      </div>
    </Card>
  )
}
