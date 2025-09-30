import React, { useState, useMemo, useRef } from 'react'
import { Modal, Checkbox, Space, Button, App, Divider } from 'antd'
import { FileImageOutlined } from '@ant-design/icons'
import { ChatMessage } from '../../../types/type'
import { formatExactDateTime } from '../../../utils/timeFormatter'
import { captureElementToCanvas, canvasToDataURL, canvasToBlob, copyBlobToClipboard, dataURLtoBlob } from '../../../utils/exporter'
import ImagePreviewModal, { ImageExportWidth } from './ImagePreviewModal'
import { Markdown } from '../../common/markdown/Markdown'

interface ExportModalProps {
  visible: boolean
  onClose: () => void
  chatTitle?: string
  messages: ChatMessage[]
  currentPathMessages: ChatMessage[]
  selectMode: 'all' | 'current-path'
  onExport: (selectedIds: string[], settings: ExportSettings) => void
  llmConfigs?: Array<{ id: string; name: string }>
}

export interface ExportSettings {
  includeModelName: boolean
  includeTimestamp: boolean
  includeReasoningContent: boolean
  includeMetadata: boolean
}

const IMAGE_WIDTH_CONFIG = {
  small: { width: 375 },
  medium: { width: 600 },
  large: { width: 800 }
}

export default function ExportModal({
  visible,
  onClose,
  chatTitle,
  messages,
  currentPathMessages,
  selectMode,
  onExport,
  llmConfigs = []
}: ExportModalProps) {
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([])
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    includeModelName: true,
    includeTimestamp: true,
    includeReasoningContent: false,
    includeMetadata: true
  })
  const [isImagePreviewVisible, setIsImagePreviewVisible] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [currentCanvas, setCurrentCanvas] = useState<HTMLCanvasElement | null>(null)
  const [isExportingImage, setIsExportingImage] = useState(false)
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false)
  const [imageExportWidth, setImageExportWidth] = useState<ImageExportWidth>('medium')
  const exportContentRef = useRef<HTMLDivElement>(null)

  const { message } = App.useApp()

  const getModelDisplayName = (modelId?: string) => {
    if (!modelId) return ''
    const config = llmConfigs.find(config => config.id === modelId)
    return config?.name || modelId
  }

  const availableMessages = useMemo(() => {
    return selectMode === 'all' ? messages : currentPathMessages
  }, [selectMode, messages, currentPathMessages])

  const handleMessageToggle = (messageId: string) => {
    setSelectedMessageIds((prev) =>
      prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId]
    )
  }

  const handleSelectAll = () => {
    setSelectedMessageIds(availableMessages.map((msg) => msg.id))
  }

  const handleSelectNone = () => {
    setSelectedMessageIds([])
  }

  const handleExport = () => {
    if (selectedMessageIds.length === 0) {
      message.warning('请选择要导出的消息')
      return
    }
    onExport(selectedMessageIds, exportSettings)
  }

  const handleCancel = () => {
    setSelectedMessageIds([])
    onClose()
  }

  const generateImage = async () => {
    if (!exportContentRef.current) {
      throw new Error('导出容器未找到')
    }

    const canvas = await captureElementToCanvas(exportContentRef.current, 40, 40)
    const dataUrl = canvasToDataURL(canvas)

    setCurrentCanvas(canvas)
    setPreviewImageUrl(dataUrl)
  }

  const handleExportImage = async () => {
    if (selectedMessageIds.length === 0) {
      message.warning('请选择要导出的消息')
      return
    }

    setIsExportingImage(true)

    try {
      await generateImage()
      setIsImagePreviewVisible(true)
    } catch (error) {
      console.error('Failed to export image:', error)
      message.error('导出图片失败')
    } finally {
      setIsExportingImage(false)
    }
  }

  const handleWidthChange = async (newWidth: ImageExportWidth) => {
    setImageExportWidth(newWidth)
    setIsRegeneratingImage(true)

    try {
      // 等待DOM更新后重新生成图片
      await new Promise(resolve => setTimeout(resolve, 100))
      await generateImage()
    } catch (error) {
      console.error('Failed to regenerate image:', error)
      message.error('重新生成图片失败')
    } finally {
      setIsRegeneratingImage(false)
    }
  }

  const handleImageEdited = (editedImageUrl: string) => {
    setPreviewImageUrl(editedImageUrl)
  }

  const handleSaveImage = async () => {
    // 如果有编辑后的图片，直接从 previewImageUrl 保存
    if (previewImageUrl && previewImageUrl.startsWith('data:')) {
      try {
        const blob = dataURLtoBlob(previewImageUrl)
      const now = new Date()
      const timeString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
      const fileName = `${chatTitle || '聊天记录'}_${timeString}.png`

      // 将 blob 转换为 Uint8Array
      const arrayBuffer = await blob.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)

      // 调用主进程保存文件
      const result = await window.api.saveFile({
        content: buffer,
        defaultPath: fileName,
        filters: [
          { name: 'PNG Images', extensions: ['png'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (result.success) {
        message.success(`图片已保存: ${result.filePath}`)
        setIsImagePreviewVisible(false)
      } else if (!result.cancelled) {
        message.error(`保存失败: ${result.error}`)
      }
        } catch (error) {
          console.error('Failed to save image:', error)
          message.error('保存图片失败')
        }
        return
      }

    // 原有的canvas保存逻辑
    if (!currentCanvas) {
      message.error('没有可保存的图片')
      return
    }

    try {
      const blob = await canvasToBlob(currentCanvas, 'image/png')
      const now = new Date()
      const timeString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
      const fileName = `${chatTitle || '聊天记录'}_${timeString}.png`

      // 将 blob 转换为 Uint8Array
      const arrayBuffer = await blob.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)

      // 调用主进程保存文件
      const result = await window.api.saveFile({
        content: buffer,
        defaultPath: fileName,
        filters: [
          { name: 'PNG Images', extensions: ['png'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (result.success) {
        message.success(`图片已保存: ${result.filePath}`)
        setIsImagePreviewVisible(false)
      } else if (!result.cancelled) {
        message.error(`保存失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to save image:', error)
      message.error('保存图片失败')
    }
  }

  const handleCopyImage = async () => {
    // 如果有编辑后的图片，直接从 previewImageUrl 复制
    if (previewImageUrl && previewImageUrl.startsWith('data:')) {
      try {
        const blob = dataURLtoBlob(previewImageUrl)
        await copyBlobToClipboard(blob)
        message.success('图片已复制到剪贴板')
        return
      } catch (error) {
        console.error('Failed to copy image:', error)
        message.error('复制到剪贴板失败')
        return
      }
    }

    // 原有的canvas复制逻辑
    if (!currentCanvas) {
      message.error('没有可复制的图片')
      return
    }

    try {
      const blob = await canvasToBlob(currentCanvas, 'image/png')
      await copyBlobToClipboard(blob)
      message.success('图片已复制到剪贴板')
    } catch (error) {
      console.error('Failed to copy image:', error)
      message.error('复制到剪贴板失败')
    }
  }

  const getSelectedMessages = () => {
    const selectedMessages = availableMessages.filter((msg) => selectedMessageIds.includes(msg.id))
    selectedMessages.sort((a, b) => a.timestamp - b.timestamp)
    return selectedMessages
  }

  // 根据宽度获取样式配置
  const getExportStyles = () => {
    const baseStyles = {
      small: {
        titleSize: '16px',
        metaSize: '11px',
        roleSize: '13px',
        contentSize: '13px',
        padding: '10px',
        borderRadius: '4px',
        spacing: '16px'
      },
      medium: {
        titleSize: '18px',
        metaSize: '12px',
        roleSize: '14px',
        contentSize: '14px',
        padding: '12px',
        borderRadius: '6px',
        spacing: '20px'
      },
      large: {
        titleSize: '20px',
        metaSize: '13px',
        roleSize: '15px',
        contentSize: '14px',
        padding: '12px',
        borderRadius: '6px',
        spacing: '24px'
      }
    }
    return baseStyles[imageExportWidth]
  }


  return (
    <>
      <Modal
        title="导出聊天记录"
        open={visible}
        onCancel={handleCancel}
        width={800}
        footer={
          <Space>
            <Button onClick={handleCancel}>取消</Button>
            <Button type="default" onClick={handleExport}>
              导出文本
            </Button>
            <Button
              type="primary"
              icon={<FileImageOutlined />}
              onClick={handleExportImage}
              loading={isExportingImage}
            >
              导出图片
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <p>
            {selectMode === 'current-path' && '当前对话路径模式：显示当前选择的对话分支'}
            {selectMode === 'all' && '所有消息模式：显示聊天中的所有消息'}
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 8 }}>导出选项：</h4>
          <Space wrap>
            <Checkbox
              checked={exportSettings.includeMetadata}
              onChange={(e) =>
                setExportSettings((prev) => ({ ...prev, includeMetadata: e.target.checked }))
              }
            >
              包含元数据
            </Checkbox>
            <Checkbox
              checked={exportSettings.includeModelName}
              onChange={(e) =>
                setExportSettings((prev) => ({ ...prev, includeModelName: e.target.checked }))
              }
            >
              包含模型名称
            </Checkbox>
            <Checkbox
              checked={exportSettings.includeTimestamp}
              onChange={(e) =>
                setExportSettings((prev) => ({ ...prev, includeTimestamp: e.target.checked }))
              }
            >
              包含时间戳
            </Checkbox>
            <Checkbox
              checked={exportSettings.includeReasoningContent}
              onChange={(e) =>
                setExportSettings((prev) => ({ ...prev, includeReasoningContent: e.target.checked }))
              }
            >
              包含思考过程
            </Checkbox>
          </Space>
        </div>

        <Divider />

        <div style={{ marginBottom: 16 }}>
          <Space>
            <Button size="small" onClick={handleSelectAll}>
              全选
            </Button>
            <Button size="small" onClick={handleSelectNone}>
              取消全选
            </Button>
            <span>已选择: {selectedMessageIds.length} 条消息</span>
          </Space>
        </div>

        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {availableMessages.map((msg) => {
            const isSelected = selectedMessageIds.includes(msg.id)
            const role = msg.role === 'user' ? '用户' : 'AI助手'
            const timestamp = formatExactDateTime(msg.timestamp)
            const preview = msg.content.slice(0, 100) + (msg.content.length > 100 ? '...' : '')

            return (
              <div key={msg.id} style={{ marginBottom: 8 }}>
                <Checkbox checked={isSelected} onChange={() => handleMessageToggle(msg.id)}>
                  <div>
                    <div>
                      <span>{role}</span>
                      {exportSettings.includeTimestamp && (
                        <span style={{ marginLeft: 8, color: '#666' }}>{timestamp}</span>
                      )}
                      {exportSettings.includeModelName && msg.modelId && (
                        <span style={{ marginLeft: 8, color: '#666' }}>
                          ({getModelDisplayName(msg.modelId)})
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#666', marginTop: 4 }}>{preview}</div>
                  </div>
                </Checkbox>
              </div>
            )
          })}
        </div>

        {/* 隐藏的导出内容容器，用于生成图片 */}
        <div
          ref={exportContentRef}
          style={{
            position: 'absolute',
            left: '-9999px',
            top: '-9999px',
            width: `${IMAGE_WIDTH_CONFIG[imageExportWidth].width}px`,
            backgroundColor: '#ffffff',
            padding: imageExportWidth === 'small' ? '16px' : '20px',
            fontFamily: 'Arial, sans-serif'
          }}
        >
          <h2 style={{ marginBottom: '10px', color: '#000', fontSize: getExportStyles().titleSize }}>
            {chatTitle || '聊天记录'}
          </h2>
          {exportSettings.includeMetadata && (
            <>
              <p style={{ color: '#666', marginBottom: '10px', fontSize: getExportStyles().metaSize }}>
                导出时间: {formatExactDateTime(Date.now())}
              </p>
              <p style={{ color: '#666', marginBottom: '20px', fontSize: getExportStyles().metaSize }}>
                消息数量: {selectedMessageIds.length}
              </p>
            </>
          )}
          <div style={{ borderTop: '2px solid #d9d9d9', marginBottom: '16px' }}></div>

          {getSelectedMessages().map((msg, index) => {
            const role = msg.role === 'user' ? '用户' : 'AI助手'
            const timestamp = exportSettings.includeTimestamp
              ? formatExactDateTime(msg.timestamp)
              : ''
            const model =
              exportSettings.includeModelName && msg.modelId
                ? ` (${getModelDisplayName(msg.modelId)})`
                : ''
            const styles = getExportStyles()

            return (
              <div key={msg.id} style={{ marginBottom: styles.spacing }}>
                <div
                  style={{
                    fontWeight: 'bold',
                    fontSize: styles.roleSize,
                    marginBottom: '6px',
                    color: msg.role === 'user' ? '#1890ff' : '#52c41a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexWrap: 'wrap'
                  }}
                >
                  <span>
                    {index + 1}. {role}
                  </span>
                  {model && (
                    <span style={{ fontSize: styles.metaSize, color: '#666', fontWeight: 'normal' }}>
                      {model}
                    </span>
                  )}
                </div>
                {exportSettings.includeTimestamp && (
                  <div style={{ fontSize: styles.metaSize, color: '#999', marginBottom: '8px' }}>
                    {timestamp}
                  </div>
                )}
                {exportSettings.includeReasoningContent && msg.reasoning_content && (
                  <div
                    style={{
                      backgroundColor: '#fafafa',
                      padding: styles.padding,
                      marginBottom: '10px',
                      borderRadius: styles.borderRadius,
                      border: '1px solid #f0f0f0'
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 'bold',
                        marginBottom: '6px',
                        fontSize: styles.metaSize,
                        color: '#666'
                      }}
                    >
                      💡 思考过程:
                    </div>
                    <div
                      style={{
                        fontSize: styles.contentSize,
                        lineHeight: '1.6',
                        color: '#333'
                      }}
                    >
                      <Markdown content={msg.reasoning_content} fontSize={parseInt(styles.contentSize)} />
                    </div>
                  </div>
                )}
                <div
                  style={{
                    fontSize: styles.contentSize,
                    lineHeight: '1.6',
                    padding: styles.padding,
                    backgroundColor: msg.role === 'user' ? '#e6f7ff' : '#ffffff',
                    borderRadius: styles.borderRadius,
                    border: `1px solid ${msg.role === 'user' ? '#91d5ff' : '#d9d9d9'}`,
                    color: '#000'
                  }}
                >
                  <Markdown content={msg.content} fontSize={parseInt(styles.contentSize)} />
                </div>
                {index < getSelectedMessages().length - 1 && (
                  <div
                    style={{ borderTop: '1px solid #e8e8e8', marginTop: '16px' }}
                  ></div>
                )}
              </div>
            )
          })}
        </div>
      </Modal>

      <ImagePreviewModal
        visible={isImagePreviewVisible}
        onClose={() => setIsImagePreviewVisible(false)}
        imageUrl={previewImageUrl}
        onSave={handleSaveImage}
        onCopy={handleCopyImage}
        imageWidth={imageExportWidth}
        onWidthChange={handleWidthChange}
        isRegenerating={isRegeneratingImage}
        onImageEdited={handleImageEdited}
      />
    </>
  )
}