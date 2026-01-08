import { Button, Spin, Segmented } from 'antd'
import { EyeOutlined, EditOutlined, ReloadOutlined, FileTextOutlined } from '@ant-design/icons'
import { useExportStore } from '../../../../stores/exportStore'
import { exportManager } from '../../../../features/export'
import type { PreviewMode } from '../../../../features/export/types'

/**
 * PreviewPanel - Middle panel for preview and editing
 *
 * Features:
 * - Preview header with mode toggle (view/edit)
 * - Preview content area
 * - Loading and error states
 */
export function PreviewPanel(): React.JSX.Element {
  const {
    sourceType,
    sourceData,
    formatType,
    previewResult,
    previewOptions,
    editedContent,
    isDirty,
    isGenerating,
    error,
    generatePreview,
    updatePreviewOptions,
    enterEditMode,
    exitEditMode,
    setEditedContent
  } = useExportStore()

  const handleModeChange = (mode: PreviewMode): void => {
    updatePreviewOptions({ mode })
    if (mode === 'edit') {
      enterEditMode()
    } else {
      exitEditMode()
    }
  }

  const handleRefresh = (): void => {
    generatePreview()
  }

  // Get previewer and editor plugins
  const previewerPlugin = exportManager.getPreviewerForFormat(formatType)
  const editorPlugin = exportManager.getEditorForFormat(formatType)
  const PreviewerComponent = previewerPlugin?.Component
  const EditorComponent = editorPlugin?.Component

  // Determine what content to show
  const hasSource = sourceType && sourceData
  const hasPreview = previewResult !== null

  return (
    <>
      {/* Header */}
      <div className="preview-panel__header">
        <div className="preview-panel__header-left">
          <Segmented
            size="small"
            value={previewOptions.mode}
            onChange={(value) => handleModeChange(value as PreviewMode)}
            options={[
              { value: 'view', icon: <EyeOutlined />, label: '预览' },
              { value: 'edit', icon: <EditOutlined />, label: '编辑', disabled: !editorPlugin }
            ]}
          />
          {isDirty && (
            <span style={{ color: 'var(--ant-color-warning)', fontSize: 12 }}>(已修改)</span>
          )}
        </div>
        <div className="preview-panel__header-right">
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            disabled={!hasSource || isGenerating}
          >
            生成预览
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="preview-panel__content">
        {/* Loading state */}
        {isGenerating && (
          <div className="preview-panel__loading">
            <Spin size="large" />
            <span>正在生成预览...</span>
          </div>
        )}

        {/* Error state */}
        {!isGenerating && error && (
          <div className="preview-panel__error">
            <span>生成预览时出错</span>
            <span style={{ fontSize: 14 }}>{error}</span>
            <Button onClick={handleRefresh}>重试</Button>
          </div>
        )}

        {/* Empty state */}
        {!isGenerating && !error && !hasPreview && (
          <div className="preview-panel__empty">
            <FileTextOutlined style={{ fontSize: 48, opacity: 0.3 }} />
            <span>{hasSource ? '点击"生成预览"按钮查看结果' : '请先选择数据源'}</span>
            {hasSource && (
              <Button type="primary" onClick={handleRefresh}>
                生成预览
              </Button>
            )}
          </div>
        )}

        {/* Preview/Edit content */}
        {!isGenerating && !error && hasPreview && (
          <>
            {previewOptions.mode === 'view' && PreviewerComponent && (
              <PreviewerComponent
                result={previewResult}
                options={previewOptions}
                onEditRequest={() => handleModeChange('edit')}
              />
            )}

            {previewOptions.mode === 'edit' && EditorComponent && (
              <EditorComponent
                content={isDirty && editedContent !== null ? editedContent : previewResult.content}
                format={formatType}
                options={previewOptions}
                onChange={setEditedContent}
              />
            )}

            {/* Fallback when no plugin is available */}
            {previewOptions.mode === 'view' && !PreviewerComponent && (
              <div style={{ padding: 16, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                {typeof previewResult.content === 'string'
                  ? previewResult.content
                  : '[Binary content]'}
              </div>
            )}

            {previewOptions.mode === 'edit' && !EditorComponent && (
              <div className="preview-panel__empty">
                <span>该格式暂不支持编辑</span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
