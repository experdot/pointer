import { App, Button, Checkbox, Modal, Select, Divider } from 'antd'
import { DownloadOutlined, CopyOutlined, PictureOutlined } from '@ant-design/icons'
import { useExportStore } from '../../../../stores/exportStore'
import { FORMAT_SUPPORT, type FormatType } from '../../../../features/export/types'

// Preview width options
const PREVIEW_WIDTH_OPTIONS = [
  { label: '600px', value: 600 },
  { label: '800px', value: 800 },
  { label: '1000px', value: 1000 },
  { label: '1200px', value: 1200 },
  { label: '自适应', value: 0 }
]

// Format display configuration
const FORMAT_CONFIG: Record<FormatType, { name: string; extension: string }> = {
  markdown: { name: 'Markdown', extension: '.md' },
  txt: { name: 'Text', extension: '.txt' },
  html: { name: 'HTML', extension: '.html' },
  csv: { name: 'CSV', extension: '.csv' }
}

/**
 * OptionsPanel - Right panel for export options
 *
 * Sections:
 * 1. Format selector
 * 2. Preview width
 * 3. Metadata options (for messages source)
 * 4. Export actions (file and image)
 */
export function OptionsPanel(): React.JSX.Element {
  const { message } = App.useApp()
  const {
    sourceType,
    formatType,
    exportOptions,
    previewOptions,
    previewResult,
    isDirty,
    setFormatType,
    updateExportOptions,
    updatePreviewOptions,
    doExport,
    copyToClipboard,
    downloadImage,
    copyImageToClipboard,
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

  const handleWidthChange = (width: number): void => {
    updatePreviewOptions({ width })
  }

  const handleExport = (): void => {
    doExport()
  }

  const handleCopy = async (): Promise<void> => {
    try {
      await copyToClipboard()
      message.success('已复制到剪贴板')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '复制失败')
    }
  }

  const handleDownloadImage = async (): Promise<void> => {
    try {
      await downloadImage()
      message.success('图片已下载')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '下载图片失败')
    }
  }

  const handleCopyImage = async (): Promise<void> => {
    try {
      await copyImageToClipboard()
      message.success('图片已复制到剪贴板')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '复制图片失败')
    }
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

        {/* Preview width */}
        <div className="options-panel__section">
          <div className="options-panel__section-title">预览宽度</div>
          <Select
            size="small"
            value={previewOptions.width}
            onChange={handleWidthChange}
            options={PREVIEW_WIDTH_OPTIONS}
            style={{ width: '100%' }}
          />
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
      </div>

      {/* Export actions */}
      <div className="options-panel__actions">
        <Divider style={{ margin: '8px 0', fontSize: 12 }}>文件</Divider>
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
          复制内容
        </Button>

        <Divider style={{ margin: '8px 0', fontSize: 12 }}>图片</Divider>
        <Button
          icon={<PictureOutlined />}
          onClick={handleDownloadImage}
          disabled={!canExport}
          block
        >
          下载图片
        </Button>
        <Button icon={<CopyOutlined />} onClick={handleCopyImage} disabled={!canExport} block>
          复制图片
        </Button>
      </div>
    </>
  )
}
