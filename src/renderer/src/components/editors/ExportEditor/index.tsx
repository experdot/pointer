import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Spin } from 'antd'
import { buildIndex, pathToMessage } from '@shared/domain'
import { ExportStoreProvider, useExportStore } from '../../../stores/exportStore'
import { useMessagesStore } from '../../../stores/messagesStore'
import { errorMessage } from '../../../runtime/client'
import type { ExportEditorContext, ExportEditorProps } from '../../../features/export/types'
import { isSourceDataReady } from '../../../features/export/sourceData'
import { Sidebar } from './panels/Sidebar'
import { PreviewPanel } from './panels/PreviewPanel'
import './ExportEditor.css'

/**
 * ExportEditor - Main export editor component
 *
 * Two-column layout:
 * - Left: Sidebar with collapsible sections (source, format, options)
 * - Right: Preview panel (with edit capability and export actions)
 */
export function ExportEditor({ context }: ExportEditorProps): React.JSX.Element {
  return (
    <ExportStoreProvider>
      <ExportEditorContent context={context} />
    </ExportStoreProvider>
  )
}

function ExportEditorContent({ context }: ExportEditorProps): React.JSX.Element {
  const { setSourceType, setSourceData, reset, generatePreview, sourceData } = useExportStore()
  const hasAutoPreviewedRef = useRef(false)
  const initializedContextRef = useRef<ExportEditorContext | undefined>(undefined)
  const [initializing, setInitializing] = useState(context?.sourceType === 'messages')
  const [initializationError, setInitializationError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  // Initialize from context
  useEffect(() => {
    // Reset store when mounting
    reset()
    hasAutoPreviewedRef.current = false
    initializedContextRef.current = undefined
    setInitializationError(null)
    setInitializing(false)

    if (!context) return undefined

    if (context.sourceType === 'messages' && context.pageId) {
      let cancelled = false
      const pageId = context.pageId
      setInitializing(true)
      // 先确定范围和选区，再挂载选择器，避免它用空数据抢先初始化。
      void useMessagesStore
        .getState()
        .load(pageId)
        .then((record) => {
          if (cancelled) return
          const existingIds = new Set(record.messages.map((message) => message.id))
          const branchMessageIds = (
            context.branchMessageIds ??
            pathToMessage(buildIndex(record.messages), record.leafMessageId).map((m) => m.id)
          ).filter((id) => existingIds.has(id))
          const selectionMode =
            context.selectionMode ?? (context.messageIds?.length ? 'free-select' : 'current-branch')
          const selectedMessageIds =
            selectionMode === 'current-branch'
              ? branchMessageIds
              : selectionMode === 'all-branches'
                ? record.messages.map((message) => message.id)
                : (
                    context.messageIds ?? (selectionMode === 'free-select' ? branchMessageIds : [])
                  ).filter((id) => existingIds.has(id))

          setSourceType('messages')
          setSourceData({
            type: 'messages',
            pageId,
            selectionMode,
            // 旧的单条消息入口只指定 ID，不额外限制它属于哪个分支。
            branchMessageIds:
              context.selectionMode || context.branchMessageIds || !context.messageIds?.length
                ? branchMessageIds
                : undefined,
            selectedMessageIds
          })
          initializedContextRef.current = context
          setInitializing(false)
        })
        .catch((error) => {
          if (cancelled) return
          setInitializationError(errorMessage(error))
          setInitializing(false)
        })
      return () => {
        cancelled = true
      }
    }

    // Set source type from context
    if (context.sourceType) {
      setSourceType(context.sourceType)

      // Initialize source data based on type
      switch (context.sourceType) {
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
    initializedContextRef.current = context
    return undefined
  }, [context, setSourceType, setSourceData, reset, retry])

  // Auto-generate preview when source data is ready (from context)
  useEffect(() => {
    // Only auto-preview if:
    // 1. We have context (this is an externally triggered export)
    // 2. Source data is ready
    // 3. We haven't already auto-previewed
    if (
      context &&
      initializedContextRef.current === context &&
      !initializing &&
      isSourceDataReady(sourceData) &&
      !hasAutoPreviewedRef.current
    ) {
      hasAutoPreviewedRef.current = true
      generatePreview()
    }
  }, [context, sourceData, generatePreview, initializing])

  if (initializing) {
    return (
      <div className="export-editor">
        <Spin tip="正在读取消息">
          <div style={{ padding: 48 }} />
        </Spin>
      </div>
    )
  }

  if (initializationError) {
    return (
      <div className="export-editor">
        <Alert
          type="error"
          message="读取导出消息失败"
          description={initializationError}
          action={<Button onClick={() => setRetry((value) => value + 1)}>重试</Button>}
        />
      </div>
    )
  }

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
