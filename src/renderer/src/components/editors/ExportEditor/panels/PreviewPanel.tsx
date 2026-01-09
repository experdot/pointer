import { useCallback } from 'react'
import { App, Button, Spin, Segmented, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import {
  EyeOutlined,
  EditOutlined,
  ReloadOutlined,
  FileTextOutlined,
  DownloadOutlined,
  CopyOutlined,
  PictureOutlined,
  DownOutlined
} from '@ant-design/icons'
import { useExportStore } from '../../../../stores/exportStore'
import { exportManager } from '../../../../features/export'
import type { PreviewMode } from '../../../../features/export/types'

/**
 * PreviewPanel - Middle panel for preview and editing
 *
 * Features:
 * - Preview header with mode toggle (view/edit)
 * - Export dropdown button in header
 * - Preview content area with configurable width
 * - Loading and error states
 * - Screenshot target container
 */
export function PreviewPanel(): React.JSX.Element {
  const { message } = App.useApp()
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
    setEditedContent,
    setPreviewContainerElement,
    doExport,
    copyToClipboard,
    downloadImage,
    copyImageToClipboard
  } = useExportStore()

  // Callback ref for the preview container
  const containerRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      setPreviewContainerElement(node)
    },
    [setPreviewContainerElement]
  )

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

  // Export action handlers
  const handleExport = async (): Promise<void> => {
    try {
      await doExport()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '导出失败')
    }
  }

  const handleCopy = async (): Promise<void> => {
    try {
      await copyToClipboard()
      message.success('已复制到剪贴板')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '复制失败')
    }
  }

  const handleDownloadImage = async (): Promise<void> => {
    try {
      await downloadImage()
      message.success('图片已下载')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '下载图片失败')
    }
  }

  const handleCopyImage = async (): Promise<void> => {
    try {
      await copyImageToClipboard()
      message.success('图片已复制到剪贴板')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '复制图片失败')
    }
  }

  // Export dropdown menu items
  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'download',
      icon: <DownloadOutlined />,
      label: '下载文件',
      onClick: handleExport
    },
    {
      key: 'copy',
      icon: <CopyOutlined />,
      label: '复制内容',
      onClick: handleCopy
    },
    { type: 'divider' },
    {
      key: 'download-image',
      icon: <PictureOutlined />,
      label: '下载图片',
      onClick: handleDownloadImage
    },
    {
      key: 'copy-image',
      icon: <CopyOutlined />,
      label: '复制图片',
      onClick: handleCopyImage
    }
  ]

  // Get previewer and editor plugins
  const previewerPlugin = exportManager.getPreviewerForFormat(formatType)
  const editorPlugin = exportManager.getEditorForFormat(formatType)
  const PreviewerComponent = previewerPlugin?.Component
  const EditorComponent = editorPlugin?.Component

  // Determine what content to show
  const hasSource = sourceType && sourceData
  const hasPreview = previewResult !== null
  const canExport = hasPreview

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
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            disabled={!hasSource || isGenerating}
          >
            刷新预览
          </Button>
          <Dropdown menu={{ items: exportMenuItems }} disabled={!canExport}>
            <Button type="primary" disabled={!canExport}>
              <DownloadOutlined /> 导出 <DownOutlined />
            </Button>
          </Dropdown>
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

        {/* Error state - only show if no preview available */}
        {!isGenerating && error && !hasPreview && (
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

        {/* Preview/Edit container - always rendered for screenshot ref */}
        <div
          ref={containerRefCallback}
          className="preview-panel__container"
          style={{
            display: !isGenerating && hasPreview ? 'block' : 'none',
            width:
              previewOptions.mode === 'edit'
                ? '100%'
                : previewOptions.width > 0
                  ? previewOptions.width
                  : '100%',
            maxWidth: '100%',
            margin: '0 auto',
            background: '#fff',
            minHeight: 200
          }}
        >
          {hasPreview && (
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
                  content={
                    isDirty && editedContent !== null ? editedContent : previewResult.content
                  }
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
      </div>
    </>
  )
}
