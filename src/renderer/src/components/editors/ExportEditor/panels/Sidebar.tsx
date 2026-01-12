import { Button, Checkbox, Select, Modal } from 'antd'
import { useExportStore } from '../../../../stores/exportStore'
import { exportManager } from '../../../../features/export'
import { FORMAT_SUPPORT, type SourceType, type FormatType } from '../../../../features/export/types'

interface SidebarProps {
  pageId?: string
}

// Source type options for Select
const SOURCE_TYPE_OPTIONS = [
  { value: 'messages', label: '消息' },
  { value: 'text-snippet', label: '文本' },
  { value: 'table-block', label: '表格' },
  { value: 'code-block', label: '代码' }
]

// Format options for Select
const FORMAT_OPTIONS: { value: FormatType; label: string }[] = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'txt', label: 'Text' },
  { value: 'html', label: 'HTML' },
  { value: 'csv', label: 'CSV' }
]

/**
 * Sidebar - Combined sidebar for export options
 *
 * Sections:
 * 1. Source - type selection + messages options
 * 2. Format - export format selection
 * 3. Metadata - metadata options (messages only)
 */
export function Sidebar({ pageId }: SidebarProps): React.JSX.Element {
  const {
    sourceType,
    sourceData,
    formatType,
    exportOptions,
    isDirty,
    isGenerating,
    isPreviewStale,
    setSourceType,
    setSourceData,
    setFormatType,
    updateExportOptions,
    confirmOverwrite,
    generatePreview
  } = useExportStore()

  // Get supported formats for current source
  const supportedFormats = sourceType ? FORMAT_SUPPORT[sourceType] : []

  // Get the source plugin and render its selector component
  const sourcePlugin = sourceType ? exportManager.getSource(sourceType) : null
  const SelectorComponent = sourcePlugin?.SelectorComponent

  const handleSourceTypeChange = (type: SourceType): void => {
    setSourceType(type)
  }

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

  const handleGeneratePreview = (): void => {
    generatePreview()
  }

  // Button should be disabled when:
  // 1. No source data
  // 2. Preview is generating
  // 3. Preview is not stale (already up to date)
  const isGenerateDisabled = !sourceData || isGenerating || !isPreviewStale

  return (
    <div className="export-sidebar">
      <div className="export-sidebar__header">
        <span className="export-sidebar__header-title">导出选项</span>
      </div>
      <div className="export-sidebar__content">
        {/* Source section */}
        <div className="sidebar__section">
          <div className="sidebar__section-title">数据源</div>
          <div className="sidebar__section-content">
            <Select
              value={sourceType ?? 'messages'}
              onChange={(value) => handleSourceTypeChange(value as SourceType)}
              options={SOURCE_TYPE_OPTIONS}
              style={{ width: '100%' }}
              disabled
            />

            {/* Source-specific selector (only for messages) */}
            {sourceType && SelectorComponent && (
              <div className="sidebar__source-selector">
                <SelectorComponent data={sourceData} onChange={setSourceData} pageId={pageId} />
              </div>
            )}
          </div>
        </div>

        {/* Format section */}
        <div className="sidebar__section">
          <div className="sidebar__section-title">导出格式</div>
          <div className="sidebar__section-content">
            <Select
              value={formatType}
              onChange={(value) => handleFormatChange(value as FormatType)}
              options={FORMAT_OPTIONS.map((opt) => ({
                ...opt,
                disabled: !supportedFormats.includes(opt.value)
              }))}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Metadata section - only for messages source */}
        {sourceType === 'messages' && (
          <div className="sidebar__section">
            <div className="sidebar__section-title">元数据选项</div>
            <div className="sidebar__section-content">
              <div className="sidebar__metadata">
                <Checkbox
                  checked={exportOptions.metadata.showTimestamp}
                  onChange={(e) => handleMetadataChange('showTimestamp', e.target.checked)}
                >
                  显示时间戳
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
                  checked={exportOptions.metadata.showMessageTitle}
                  onChange={(e) => handleMetadataChange('showMessageTitle', e.target.checked)}
                >
                  显示消息标题
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
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="export-sidebar__footer">
        <Button
          type="primary"
          block
          loading={isGenerating}
          disabled={isGenerateDisabled}
          onClick={handleGeneratePreview}
        >
          生成预览
        </Button>
      </div>
    </div>
  )
}
