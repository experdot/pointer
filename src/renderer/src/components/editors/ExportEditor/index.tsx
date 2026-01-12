import { useEffect, useRef } from 'react'
import { useExportStore } from '../../../stores/exportStore'
import type { ExportEditorProps, SourceData } from '../../../features/export/types'
import { Sidebar } from './panels/Sidebar'
import { PreviewPanel } from './panels/PreviewPanel'
import './ExportEditor.css'

/**
 * Check if source data is ready for preview generation
 */
function isSourceDataReady(data: SourceData | null): boolean {
  if (!data) return false

  switch (data.type) {
    case 'messages':
      // Messages source needs selectedMessageIds to be populated
      return data.selectedMessageIds.length > 0
    case 'text-snippet':
      return !!data.text
    case 'code-block':
      return !!data.code
    case 'table-block':
      return !!data.markdown
    default:
      return false
  }
}

/**
 * ExportEditor - Main export editor component
 *
 * Two-column layout:
 * - Left: Sidebar with collapsible sections (source, format, options)
 * - Right: Preview panel (with edit capability and export actions)
 */
export function ExportEditor({ context }: ExportEditorProps): React.JSX.Element {
  const { setSourceType, setSourceData, reset, generatePreview, sourceData } = useExportStore()
  const hasAutoPreviewedRef = useRef(false)

  // Initialize from context
  useEffect(() => {
    // Reset store when mounting
    reset()

    if (!context) return

    // Set source type from context
    if (context.sourceType) {
      setSourceType(context.sourceType)

      // Initialize source data based on type
      switch (context.sourceType) {
        case 'messages':
          if (context.pageId) {
            setSourceData({
              type: 'messages',
              pageId: context.pageId,
              selectionMode: context.messageIds?.length ? 'free-select' : 'current-branch',
              selectedMessageIds: context.messageIds || []
            })
          }
          break

        case 'text-snippet':
          if (context.text) {
            setSourceData({
              type: 'text-snippet',
              text: context.text,
              sourceInfo: {
                pageId: context.pageId
              }
            })
          }
          break

        case 'code-block':
          if (context.code) {
            setSourceData({
              type: 'code-block',
              code: context.code,
              language: context.language || 'text',
              sourceInfo: {
                pageId: context.pageId
              }
            })
          }
          break

        case 'table-block':
          if (context.table) {
            setSourceData({
              type: 'table-block',
              markdown: context.table,
              sourceInfo: {
                pageId: context.pageId
              }
            })
          }
          break
      }
    }
    // Reset auto-preview flag when context changes
    hasAutoPreviewedRef.current = false
  }, [context, setSourceType, setSourceData, reset])

  // Auto-generate preview when source data is ready (from context)
  useEffect(() => {
    // Only auto-preview if:
    // 1. We have context (this is an externally triggered export)
    // 2. Source data is ready
    // 3. We haven't already auto-previewed
    if (context && isSourceDataReady(sourceData) && !hasAutoPreviewedRef.current) {
      hasAutoPreviewedRef.current = true
      generatePreview()
    }
  }, [context, sourceData, generatePreview])

  return (
    <div className="export-editor">
      <div className="export-editor__sidebar">
        <Sidebar pageId={context?.pageId} />
      </div>
      <div className="export-editor__preview">
        <PreviewPanel />
      </div>
    </div>
  )
}
