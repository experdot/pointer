import React, { useState, useRef, useEffect } from 'react'
import { Markdown } from './Markdown'
import { captureElementToCanvas, canvasToDataURL, canvasToBlob, copyBlobToClipboard, dataURLtoBlob } from '../../../utils/exporter'
import { copyToClipboard } from './utils'
import ImagePreviewModal, { ImageExportWidth } from '../../pages/chat/ImagePreviewModal'
import './tableViewModal.scss'

interface TableViewModalProps {
  isOpen: boolean
  onClose: () => void
  tableHtml: string
  tableMarkdown: string
  tableTextMarkdown: string
}

export default function TableViewModal({
  isOpen,
  onClose,
  tableHtml,
  tableMarkdown,
  tableTextMarkdown
}: TableViewModalProps) {
  const [viewMode, setViewMode] = useState<'table' | 'text'>('table')
  const [isExportingImage, setIsExportingImage] = useState(false)
  const [isImagePreviewVisible, setIsImagePreviewVisible] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [currentCanvas, setCurrentCanvas] = useState<HTMLCanvasElement | null>(null)
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false)
  const [imageExportWidth, setImageExportWidth] = useState<ImageExportWidth>('medium')
  const tableImageRef = useRef<HTMLDivElement>(null)
  const tableTextImageRef = useRef<HTMLDivElement>(null)

  const handleCopyMarkdown = async () => {
    const contentToCopy = viewMode === 'table' ? tableMarkdown : tableTextMarkdown
    if (contentToCopy) {
      await copyToClipboard(contentToCopy)
    }
  }

  const handleExportCSV = async () => {
    const csv = convertTableHtmlToCSV(tableHtml)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    try {
      await window.api.saveFile({
        content: csv,
        defaultPath: `table-${timestamp}.csv`,
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
    } catch (error) {
      console.error('Export CSV failed:', error)
    }
  }

  const convertTableHtmlToCSV = (html: string): string => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const table = doc.querySelector('table')

    if (!table) return ''

    const rows: string[][] = []
    const thead = table.querySelector('thead')
    const tbody = table.querySelector('tbody')

    if (thead) {
      const headerRow = thead.querySelector('tr')
      if (headerRow) {
        const headers = Array.from(headerRow.querySelectorAll('th')).map(
          (th) => th.textContent?.trim() || ''
        )
        rows.push(headers)
      }
    }

    if (tbody) {
      const bodyRows = tbody.querySelectorAll('tr')
      bodyRows.forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll('td')).map(
          (td) => td.textContent?.trim() || ''
        )
        rows.push(cells)
      })
    }

    return rows
      .map((row) =>
        row
          .map((cell) => {
            if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
              return `"${cell.replace(/"/g, '""')}"`
            }
            return cell
          })
          .join(',')
      )
      .join('\n')
  }

  const generateImage = async () => {
    const targetRef = viewMode === 'table' ? tableImageRef.current : tableTextImageRef.current
    if (!targetRef) {
      throw new Error('容器未找到')
    }

    await new Promise(resolve => setTimeout(resolve, 100))

    const canvas = await captureElementToCanvas(targetRef, 20, 20)
    const dataUrl = canvasToDataURL(canvas)

    setCurrentCanvas(canvas)
    setPreviewImageUrl(dataUrl)
  }

  const handleExportImage = async () => {
    setIsExportingImage(true)
    try {
      await generateImage()
      setIsImagePreviewVisible(true)
    } catch (error) {
      console.error('Export image failed:', error)
    } finally {
      setIsExportingImage(false)
    }
  }

  const handleWidthChange = async (newWidth: ImageExportWidth) => {
    setImageExportWidth(newWidth)
    setIsRegeneratingImage(true)

    try {
      await new Promise(resolve => setTimeout(resolve, 100))
      await generateImage()
    } catch (error) {
      console.error('Failed to regenerate image:', error)
    } finally {
      setIsRegeneratingImage(false)
    }
  }

  const handleImageEdited = (editedImageUrl: string) => {
    setPreviewImageUrl(editedImageUrl)
  }

  const handleSaveImage = async () => {
    if (previewImageUrl && previewImageUrl.startsWith('data:')) {
      try {
        const blob = dataURLtoBlob(previewImageUrl)
        const now = new Date()
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
        const fileName = `table_${timestamp}.png`

        const arrayBuffer = await blob.arrayBuffer()
        const buffer = new Uint8Array(arrayBuffer)

        await window.api.saveFile({
          content: buffer,
          defaultPath: fileName,
          filters: [
            { name: 'PNG Images', extensions: ['png'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        })
        setIsImagePreviewVisible(false)
      } catch (error) {
        console.error('Save image failed:', error)
      }
      return
    }

    if (!currentCanvas) {
      return
    }

    try {
      const blob = await canvasToBlob(currentCanvas, 'image/png')
      const now = new Date()
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
      const fileName = `table_${timestamp}.png`

      const arrayBuffer = await blob.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)

      await window.api.saveFile({
        content: buffer,
        defaultPath: fileName,
        filters: [
          { name: 'PNG Images', extensions: ['png'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      setIsImagePreviewVisible(false)
    } catch (error) {
      console.error('Save image failed:', error)
    }
  }

  const handleCopyImageToClipboard = async () => {
    if (previewImageUrl && previewImageUrl.startsWith('data:')) {
      try {
        const blob = dataURLtoBlob(previewImageUrl)
        await copyBlobToClipboard(blob)
        return
      } catch (error) {
        console.error('Failed to copy image:', error)
        return
      }
    }

    if (!currentCanvas) {
      return
    }

    try {
      const blob = await canvasToBlob(currentCanvas, 'image/png')
      await copyBlobToClipboard(blob)
    } catch (error) {
      console.error('Failed to copy image:', error)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="table-modal-overlay" onClick={onClose}>
        <div className="table-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="table-modal-header">
            <span className="table-modal-title">表格查看</span>
            <span className="table-modal-close" onClick={onClose} title="关闭">
              ×
            </span>
          </div>
          <div className="table-modal-body">
            <div className="table-view-mode-switch-container">
              <div className="table-view-mode-switch">
                <button
                  className={`mode-switch-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                >
                  表格
                </button>
                <button
                  className={`mode-switch-btn ${viewMode === 'text' ? 'active' : ''}`}
                  onClick={() => setViewMode('text')}
                >
                  文本
                </button>
              </div>
            </div>
            <div className="table-view-content">
              {viewMode === 'table' ? (
                <div dangerouslySetInnerHTML={{ __html: tableHtml }}></div>
              ) : (
                <div className="table-text-view">
                  <Markdown content={tableTextMarkdown} />
                </div>
              )}
            </div>
          </div>
          <div className="table-modal-footer">
            <button className="table-modal-button" onClick={onClose}>
              取消
            </button>
            <button className="table-modal-button" onClick={handleCopyMarkdown}>
              复制Markdown
            </button>
            <button
              className="table-modal-button"
              onClick={handleExportCSV}
              disabled={viewMode === 'text'}
              style={{ opacity: viewMode === 'text' ? 0.5 : 1 }}
            >
              导出CSV
            </button>
            <button
              className="table-modal-button table-modal-button-primary"
              onClick={handleExportImage}
              disabled={isExportingImage}
            >
              {isExportingImage ? '导出中...' : '导出图片'}
            </button>
          </div>
        </div>
      </div>

      {/* 隐藏的表格容器用于导出图片 */}
      <div
        ref={tableImageRef}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          backgroundColor: '#ffffff',
          padding: '20px',
          width: imageExportWidth === 'small' ? '375px' : imageExportWidth === 'medium' ? '600px' : '800px'
        }}
        dangerouslySetInnerHTML={{ __html: tableHtml }}
      />
      <div
        ref={tableTextImageRef}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          backgroundColor: '#ffffff',
          padding: '20px',
          width: imageExportWidth === 'small' ? '375px' : imageExportWidth === 'medium' ? '600px' : '800px'
        }}
      >
        <Markdown content={tableTextMarkdown} />
      </div>

      {/* 图片预览Modal */}
      {isImagePreviewVisible && (
        <ImagePreviewModal
          visible={isImagePreviewVisible}
          onClose={() => setIsImagePreviewVisible(false)}
          imageUrl={previewImageUrl}
          onSave={handleSaveImage}
          onCopy={handleCopyImageToClipboard}
          imageWidth={imageExportWidth}
          onWidthChange={handleWidthChange}
          isRegenerating={isRegeneratingImage}
          onImageEdited={handleImageEdited}
        />
      )}
    </>
  )
}
