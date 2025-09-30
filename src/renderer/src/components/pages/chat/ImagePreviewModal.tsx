import React, { useState } from 'react'
import { Modal, Button, Space, Radio } from 'antd'
import {
  DownloadOutlined,
  CopyOutlined,
  MobileOutlined,
  TabletOutlined,
  DesktopOutlined,
  EditOutlined
} from '@ant-design/icons'
import ImageEditor from '../../common/ImageEditor'

export type ImageExportWidth = 'small' | 'medium' | 'large'

const IMAGE_WIDTH_CONFIG = {
  small: { width: 375, label: '小 (手机)', icon: <MobileOutlined /> },
  medium: { width: 600, label: '中 (平板)', icon: <TabletOutlined /> },
  large: { width: 800, label: '大 (电脑)', icon: <DesktopOutlined /> }
}

interface ImagePreviewModalProps {
  visible: boolean
  onClose: () => void
  imageUrl: string | null
  onSave: () => void
  onCopy: () => void
  imageWidth: ImageExportWidth
  onWidthChange: (width: ImageExportWidth) => void
  isRegenerating?: boolean
  onImageEdited?: (editedImageUrl: string) => void
}

export default function ImagePreviewModal({
  visible,
  onClose,
  imageUrl,
  onSave,
  onCopy,
  imageWidth,
  onWidthChange,
  isRegenerating = false,
  onImageEdited
}: ImagePreviewModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null)

  const currentImageUrl = editedImageUrl || imageUrl

  const handleStartEdit = () => {
    setIsEditing(true)
  }

  const handleSaveEdit = (newImageUrl: string) => {
    setEditedImageUrl(newImageUrl)
    setIsEditing(false)
    onImageEdited?.(newImageUrl)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
  }

  const handleWidthChange = (width: ImageExportWidth) => {
    // 切换宽度时清除编辑过的图片，重新生成
    setEditedImageUrl(null)
    onWidthChange(width)
  }

  return (
    <Modal
      title={isEditing ? '编辑图片' : '导出预览'}
      open={visible}
      onCancel={onClose}
      width={isEditing ? 1000 : 900}
      style={{ top: 20 }}
      bodyStyle={isEditing ? { height: 'calc(100vh - 120px)', padding: '20px' } : undefined}
      footer={
        isEditing ? null : (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={handleStartEdit}
              disabled={isRegenerating || !currentImageUrl}
            >
              编辑
            </Button>
            <Button icon={<DownloadOutlined />} onClick={onSave} disabled={isRegenerating}>
              保存为文件
            </Button>
            <Button
              type="primary"
              icon={<CopyOutlined />}
              onClick={onCopy}
              disabled={isRegenerating}
            >
              复制到剪贴板
            </Button>
            <Button onClick={onClose}>关闭</Button>
          </Space>
        )
      }
    >
      {isEditing && currentImageUrl ? (
        <ImageEditor
          imageUrl={currentImageUrl}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />
      ) : (
        <div>
          {/* 宽度选择器 */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Radio.Group
              value={imageWidth}
              onChange={(e) => handleWidthChange(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="small">{IMAGE_WIDTH_CONFIG.small.icon}</Radio.Button>
              <Radio.Button value="medium">{IMAGE_WIDTH_CONFIG.medium.icon}</Radio.Button>
              <Radio.Button value="large">{IMAGE_WIDTH_CONFIG.large.icon}</Radio.Button>
            </Radio.Group>
          </div>

          {/* 图片预览 */}
          <div
            style={{
              maxHeight: '70vh',
              overflowY: 'auto',
              textAlign: 'center',
              position: 'relative'
            }}
          >
            {isRegenerating && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  zIndex: 1
                }}
              >
                <span>正在重新生成图片...</span>
              </div>
            )}
            {currentImageUrl && (
              <img
                src={currentImageUrl}
                alt="导出预览"
                style={{
                  maxWidth: '100%',
                  border: '1px solid #d9d9d9',
                  opacity: isRegenerating ? 0.5 : 1
                }}
              />
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
