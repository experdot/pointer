import { t, useI18n } from '@renderer/i18n'
import { App, Button, Checkbox, Select } from 'antd'
import { useExportStore } from '../../../../stores/exportStore'
import { exportManager } from '../../../../features/export'
import { isSourceDataReady } from '../../../../features/export/sourceData'
import { FORMAT_SUPPORT, type SourceType, type FormatType } from '../../../../features/export/types'

interface SidebarProps {
  pageId?: string
}

// Source type options for Select
const SOURCE_TYPE_OPTIONS = [
  {
    value: 'messages',
    get label(): string {
      return t('common.messages')
    }
  },
  {
    value: 'text-snippet',
    get label(): string {
      return t('common.text')
    }
  },
  {
    value: 'table-block',
    get label(): string {
      return t('common.table')
    }
  },
  {
    value: 'code-block',
    get label(): string {
      return t('common.code')
    }
  }
]

// Format options for Select
const FORMAT_OPTIONS: { value: FormatType; label: string }[] = [
  { value: 'markdown', label: 'Markdown' },
  {
    value: 'txt',
    get label(): string {
      return t('common.text')
    }
  },
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
  useI18n()
  const { modal } = App.useApp()

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
      modal.confirm({
        title: t('export.confirmFormat'),
        content: t('export.discardEdits'),
        okText: t('common.confirmAction'),
        cancelText: t('common.cancel'),
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
  const isGenerateDisabled = !isSourceDataReady(sourceData) || isGenerating || !isPreviewStale

  return (
    <div className="export-sidebar">
      <div className="export-sidebar__header">
        <span className="export-sidebar__header-title">{t('export.options')}</span>
      </div>
      <div className="export-sidebar__content">
        {/* Source section */}
        <div className="sidebar__section">
          <div className="sidebar__section-title">{t('export.source')}</div>
          <div className="sidebar__section-content">
            <Select
              value={sourceType ?? 'messages'}
              onChange={(value) => handleSourceTypeChange(value as SourceType)}
              options={SOURCE_TYPE_OPTIONS.map((option) => ({ ...option }))}
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
          <div className="sidebar__section-title">{t('export.format')}</div>
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
            <div className="sidebar__section-title">{t('export.metadata')}</div>
            <div className="sidebar__section-content">
              <div className="sidebar__metadata">
                <Checkbox
                  checked={exportOptions.metadata.showTimestamp}
                  onChange={(e) => handleMetadataChange('showTimestamp', e.target.checked)}
                >
                  {t('export.showTime')}
                </Checkbox>
                <Checkbox
                  checked={exportOptions.metadata.showModelName}
                  onChange={(e) => handleMetadataChange('showModelName', e.target.checked)}
                >
                  {t('export.showModel')}
                </Checkbox>
                <Checkbox
                  checked={exportOptions.metadata.showModelConfig}
                  onChange={(e) => handleMetadataChange('showModelConfig', e.target.checked)}
                >
                  {t('export.showConfig')}
                </Checkbox>
                <Checkbox
                  checked={exportOptions.metadata.showMessageTitle}
                  onChange={(e) => handleMetadataChange('showMessageTitle', e.target.checked)}
                >
                  {t('export.showTitles')}
                </Checkbox>
                <Checkbox
                  checked={exportOptions.metadata.showTopicsOutline}
                  onChange={(e) => handleMetadataChange('showTopicsOutline', e.target.checked)}
                >
                  {t('export.showTopics')}
                </Checkbox>
                <Checkbox
                  checked={exportOptions.metadata.showReasoningContent}
                  onChange={(e) => handleMetadataChange('showReasoningContent', e.target.checked)}
                >
                  {t('export.showReasoning')}
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
          {t('export.generatePreview')}
        </Button>
      </div>
    </div>
  )
}
