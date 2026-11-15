import { t, useI18n } from '@renderer/i18n'
import React, { useState, useRef } from 'react'
import { Markdown } from './Markdown'
import { screenshotElement } from '../../../utils/screenshot'
import { copyToClipboard } from '../../../utils/clipboard'
import { command } from '../../../runtime/client'
import { encodeCsvRows } from '../../../features/export/csv'
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
  useI18n()

  const [viewMode, setViewMode] = useState<'table' | 'text'>('table')
  const [isExportingImage, setIsExportingImage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tableImageRef = useRef<HTMLDivElement>(null)
  const tableTextImageRef = useRef<HTMLDivElement>(null)

  const handleCopyMarkdown = async (): Promise<void> => {
    const contentToCopy = viewMode === 'table' ? tableMarkdown : tableTextMarkdown
    setError(null)
    if (contentToCopy) {
      if (!(await copyToClipboard(contentToCopy))) setError(t('common.copyRetry'))
    }
  }

  const handleExportCSV = async (): Promise<void> => {
    setError(null)
    const csv = convertTableHtmlToCSV(tableHtml)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    try {
      await command('dialog.saveFile', {
        suggestedName: `table-${timestamp}.csv`,
        content: csv,
        filters: [
          { name: t('files.type', { type: 'CSV' }), extensions: ['csv'] },
          { name: t('files.all'), extensions: ['*'] }
        ]
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : t('table.csvFailed'))
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

    return encodeCsvRows(rows)
  }

  const handleExportImage = async (): Promise<void> => {
    const targetRef = viewMode === 'table' ? tableImageRef.current : tableTextImageRef.current
    if (!targetRef) return

    setIsExportingImage(true)
    setError(null)
    try {
      // 等待隐藏容器完成渲染
      await new Promise((resolve) => setTimeout(resolve, 100))

      const blob = await screenshotElement(targetRef, { scale: 2, backgroundColor: '#ffffff' })
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
        reader.onerror = () => reject(reader.error ?? new Error(t('image.readFailed')))
        reader.readAsDataURL(blob)
      })
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)

      await command('dialog.saveFile', {
        suggestedName: `table-${timestamp}.png`,
        content: dataBase64,
        encoding: 'base64',
        filters: [
          { name: t('files.png'), extensions: ['png'] },
          { name: t('files.all'), extensions: ['*'] }
        ]
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : t('image.exportFailed'))
    } finally {
      setIsExportingImage(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="table-modal-overlay"
        role="dialog"
        aria-label={t('table.viewer')}
        data-shortcut-blocking-overlay="true"
        onClick={onClose}
      >
        <div className="table-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="table-modal-header">
            <span className="table-modal-title">{t('table.viewer')}</span>
            <span className="table-modal-close" onClick={onClose} title={t('common.close')}>
              ×
            </span>
          </div>
          <div className="table-modal-body">
            {error && <div role="alert">{error}</div>}
            <div className="table-view-mode-switch-container">
              <div className="table-view-mode-switch">
                <button
                  className={`mode-switch-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                >
                  {t('common.table')}
                </button>
                <button
                  className={`mode-switch-btn ${viewMode === 'text' ? 'active' : ''}`}
                  onClick={() => setViewMode('text')}
                >
                  {t('common.text')}
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
              {t('common.cancel')}
            </button>
            <button className="table-modal-button" onClick={handleCopyMarkdown}>
              {t('table.copyMarkdown')}
            </button>
            <button
              className="table-modal-button"
              onClick={handleExportCSV}
              disabled={viewMode === 'text'}
              style={{ opacity: viewMode === 'text' ? 0.5 : 1 }}
            >
              {t('table.exportCsv')}
            </button>
            <button
              className="table-modal-button table-modal-button-primary"
              onClick={handleExportImage}
              disabled={isExportingImage}
            >
              {isExportingImage ? t('common.exporting') : t('image.export')}
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
