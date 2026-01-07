import { useEffect } from 'react'
import { useExportStore } from '../../../stores/exportStore'
import type { ExportEditorProps } from '../../../features/export/types'
import { SourcePanel } from './panels/SourcePanel'
import { PreviewPanel } from './panels/PreviewPanel'
import { OptionsPanel } from './panels/OptionsPanel'
import './ExportEditor.css'

/**
 * ExportEditor - Main export editor component
 *
 * Three-column layout:
 * - Left: Source selection panel
 * - Middle: Preview panel (with edit capability)
 * - Right: Options panel (format, metadata, actions)
 */
export function ExportEditor({ context }: ExportEditorProps): React.JSX.Element {
  const { setSourceType, setSourceData, reset } = useExportStore()

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
  }, [context, setSourceType, setSourceData, reset])

  return (
    <div className="export-editor">
      <div className="export-editor__source">
        <SourcePanel pageId={context?.pageId} />
      </div>
      <div className="export-editor__preview">
        <PreviewPanel />
      </div>
      <div className="export-editor__options">
        <OptionsPanel />
      </div>
    </div>
  )
}
