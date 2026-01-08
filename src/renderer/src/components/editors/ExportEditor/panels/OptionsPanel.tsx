import { Button, Checkbox, Modal } from 'antd'
import { DownloadOutlined, CopyOutlined } from '@ant-design/icons'
import { useExportStore } from '../../../../stores/exportStore'
import { FORMAT_SUPPORT, type FormatType } from '../../../../features/export/types'

// Format display configuration
const FORMAT_CONFIG: Record<FormatType, { name: string; extension: string }> = {
  markdown: { name: 'Markdown', extension: '.md' },
  txt: { name: 'Text', extension: '.txt' },
  html: { name: 'HTML', extension: '.html' },
  png: { name: 'PNG', extension: '.png' },
  csv: { name: 'CSV', extension: '.csv' }
}

/**
 * OptionsPanel - Right panel for export options
 *
 * Sections:
 * 1. Format selector
 * 2. Metadata options (for messages source)
 * 3. Export actions (download, copy)
 */
export function OptionsPanel(): React.JSX.Element {
  const {
    sourceType,
    formatType,
    exportOptions,
    previewResult,
    isDirty,
    setFormatType,
    updateExportOptions,
    doExport,
    copyToClipboard,
    confirmOverwrite,
    generatePreview
  } = useExportStore()

  // Get supported formats for current source
  const supportedFormats = sourceType ? FORMAT_SUPPORT[sourceType] : []

  const handleFormatChange = (format: FormatType): void => {
    if (isDirty) {
      Modal.confirm({
        title: '确认切换格式',
        content: '切换格式将丢失当前的编辑内容，是否继续？',
        okText: '确认',
        cancelText: '取消',
        onOk: () => {
          confirmOverwrite()
          setFormatType(format)
          generatePreview()
        }
      })
    } else {
      setFormatType(format)
    }
  }

  const handleMetadataChange = (key: string, value: boolean): void => {
    updateExportOptions({
      metadata: {
        ...exportOptions.metadata,
        [key]: value
      }
    })
  }

  const handleExport = (): void => {
    doExport()
  }

  const handleCopy = (): void => {
    copyToClipboard()
  }

  // Check if we can export
  const canExport = previewResult !== null

  return (
    <>
      <div className="export-panel__header">
        <span className="export-panel__header-title">导出选项</span>
      </div>

      <div className="export-panel__content">
        {/* Format selector */}
        <div className="options-panel__section">
          <div className="options-panel__section-title">导出格式</div>
          <div className="options-panel__format-selector">
            {Object.entries(FORMAT_CONFIG).map(([format, config]) => {
              const isSupported = supportedFormats.includes(format as FormatType)
              const isActive = formatType === format

              return (
                <div
                  key={format}
                  className={`options-panel__format-item ${
                    isActive ? 'options-panel__format-item--active' : ''
                  } ${!isSupported ? 'options-panel__format-item--disabled' : ''}`}
                  onClick={() => isSupported && handleFormatChange(format as FormatType)}
                >
                  {config.name}
                </div>
              )
            })}
          </div>
        </div>

        {/* Metadata options (only for messages source) */}
        {sourceType === 'messages' && (
          <div className="options-panel__section">
            <div className="options-panel__section-title">元数据选项</div>
            <div className="options-panel__metadata">
              <Checkbox
                checked={exportOptions.metadata.showTimestamp}
                onChange={(e) => handleMetadataChange('showTimestamp', e.target.checked)}
              >
                显示时间戳
              </Checkbox>
              <Checkbox
                checked={exportOptions.metadata.showMessageTitle}
                onChange={(e) => handleMetadataChange('showMessageTitle', e.target.checked)}
              >
                显示消息标题
              </Checkbox>
              <Checkbox
                checked={exportOptions.metadata.showModelName}
                onChange={(e) => handleMetadataChange('showModelName', e.target.checked)}
              >
                显示模型名称
              </Checkbox>
              <Checkbox
                checked={exportOptions.metadata.showModelConfig}
                onChange={(e) => handleMetadataChange('showModelConfig', e.target.checked)}
              >
                显示模型配置
              </Checkbox>
              <Checkbox
                checked={exportOptions.metadata.showTopicsOutline}
                onChange={(e) => handleMetadataChange('showTopicsOutline', e.target.checked)}
              >
                显示 Topics 目录
              </Checkbox>
              <Checkbox
                checked={exportOptions.metadata.showReasoningContent}
                onChange={(e) => handleMetadataChange('showReasoningContent', e.target.checked)}
              >
                显示推理过程
              </Checkbox>
              <Checkbox
                checked={exportOptions.metadata.showAvatar}
                onChange={(e) => handleMetadataChange('showAvatar', e.target.checked)}
              >
                显示头像
              </Checkbox>
            </div>
          </div>
        )}

        {/* Image options (only for PNG format) */}
        {formatType === 'png' && (
          <div className="options-panel__section">
            <div className="options-panel__section-title">图片选项</div>
            {/* TODO: Add image width, quality, theme options */}
            <div style={{ color: 'var(--ant-color-text-secondary)', fontSize: 13 }}>
              图片选项将在后续版本中添加
            </div>
          </div>
        )}
      </div>

      {/* Export actions */}
      <div className="options-panel__actions">
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleExport}
          disabled={!canExport}
          block
        >
          下载文件
        </Button>
        <Button icon={<CopyOutlined />} onClick={handleCopy} disabled={!canExport} block>
          复制到剪贴板
        </Button>
      </div>
    </>
  )
}
