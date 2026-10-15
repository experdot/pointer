import React, { useState, useRef } from 'react'
import { Markdown } from './Markdown'
import { screenshotElement } from '../../../utils/screenshot'
import { copyToClipboard } from '../../../utils/clipboard'
import { command } from '../../../runtime/client'
import './tableViewModal.scss'

interface TableViewModalProps {
  isOpen: boolean
  onClose: () => void
  tableHtml: string
  tableMarkdown: string
  tableTextMarkdown: string
}

const IMAGE_EXPORT_WIDTH = 600

export default function TableViewModal({
  isOpen,
  onClose,
  tableHtml,
  tableMarkdown,
  tableTextMarkdown
}: TableViewModalProps): React.JSX.Element | null {
  const [viewMode, setViewMode] = useState<'table' | 'text'>('table')
  const [isExportingImage, setIsExportingImage] = useState(false)
  const tableImageRef = useRef<HTMLDivElement>(null)
  const tableTextImageRef = useRef<HTMLDivElement>(null)

  const handleCopyMarkdown = async (): Promise<void> => {
    const contentToCopy = viewMode === 'table' ? tableMarkdown : tableTextMarkdown
    if (contentToCopy) {
      await copyToClipboard(contentToCopy)
    }
  }

  const handleExportCSV = async (): Promise<void> => {
    const csv = convertTableHtmlToCSV(tableHtml)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    try {
      await command('dialog.saveFile', {
        suggestedName: `table-${timestamp}.csv`,
        content: csv,
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

  const handleExportImage = async (): Promise<void> => {
    const targetRef = viewMode === 'table' ? tableImageRef.current : tableTextImageRef.current
    if (!targetRef) return

    setIsExportingImage(true)
    try {
      // 等待隐藏容器完成渲染
      await new Promise((resolve) => setTimeout(resolve, 100))

      const blob = await screenshotElement(targetRef, { scale: 2, backgroundColor: '#ffffff' })
      const buffer = new Uint8Array(await blob.arrayBuffer())
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)

      await command('dialog.saveFile', {
        suggestedName: `table-${timestamp}.png`,
        content: Buffer.from(buffer).toString('base64'),
        encoding: 'base64',
        filters: [
          { name: 'PNG Images', extensions: ['png'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
    } catch (error) {
      console.error('Export image failed:', error)
    } finally {
      setIsExportingImage(false)
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
          width: `${IMAGE_EXPORT_WIDTH}px`
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
          width: `${IMAGE_EXPORT_WIDTH}px`
        }}
      >
        <Markdown content={tableTextMarkdown} />
      </div>
    </>
  )
}
