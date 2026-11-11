import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { createContext, createElement, useContext, useState, type ReactNode } from 'react'
import { command } from '../runtime/client'
import { copyToClipboard } from '../utils/clipboard'
import type {
  ExportStore,
  SourceType,
  SourceData,
  FormatType,
  ExportOptions,
  PreviewOptions
} from '../features/export/types'
import {
  DEFAULT_EXPORT_OPTIONS,
  DEFAULT_PREVIEW_OPTIONS,
  FORMAT_SUPPORT
} from '../features/export/types'
import { exportManager } from '../features/export/ExportManager'
import {
  screenshotElement,
  downloadBlob,
  copyImageToClipboard as copyImageToClipboardUtil
} from '../utils/screenshot'

/**
 * Export Store - State management for the export feature
 *
 * Manages:
 * - Source selection and configuration
 * - Format selection and options
 * - Preview generation and display
 * - Edit state tracking
 * - Export execution
 */
export const createExportStore = (): StoreApi<ExportStore> =>
  createStore<ExportStore>((set, get) => {
    let revision = 0
    return {
      // ==================== Initial State ====================

      // Source configuration
      sourceType: null,
      sourceData: null,

      // Export configuration
      formatType: 'markdown',
      exportOptions: { ...DEFAULT_EXPORT_OPTIONS },

      // Preview state
      previewOptions: { ...DEFAULT_PREVIEW_OPTIONS },
      previewResult: null,
      previewContainerElement: null,

      // Edit state
      editedContent: null,
      isDirty: false,
      isEditing: false,

      // Loading state
      isGenerating: false,
      isPreviewStale: true,
      error: null,

      // ==================== Source Actions ====================

      setSourceType: (type: SourceType) => {
        revision++
        const { isDirty, formatType } = get()

        // Check if current format is supported by new source
        const supportedFormats = FORMAT_SUPPORT[type]
        const newFormatType = supportedFormats.includes(formatType)
          ? formatType
          : supportedFormats[0] || 'markdown'

        set({
          sourceType: type,
          sourceData: null,
          formatType: newFormatType,
          exportOptions: { ...get().exportOptions, format: newFormatType },
          isGenerating: false,
          isPreviewStale: true,
          previewResult: null,
          editedContent: isDirty ? get().editedContent : null,
          error: null
        })
      },

      setSourceData: (data: SourceData) => {
        revision++
        set({
          isGenerating: false,
          sourceData: data,
          isPreviewStale: true,
          error: null
        })
      },

      // ==================== Format Actions ====================

      setFormatType: (type: FormatType) => {
        const { sourceType, isDirty } = get()

        // Validate format is supported by current source
        if (sourceType && !FORMAT_SUPPORT[sourceType].includes(type)) {
          console.warn(`Format ${type} is not supported by source ${sourceType}`)
          return
        }
        revision++

        set({
          formatType: type,
          isGenerating: false,
          exportOptions: {
            ...get().exportOptions,
            format: type
          },
          previewResult: null,
          editedContent: isDirty ? get().editedContent : null,
          isPreviewStale: true,
          error: null
        })
      },

      updateExportOptions: (options: Partial<ExportOptions>) => {
        revision++
        set({
          isGenerating: false,
          exportOptions: {
            ...get().exportOptions,
            ...options
          },
          isPreviewStale: true
        })
      },

      // ==================== Preview Actions ====================

      updatePreviewOptions: (options: Partial<PreviewOptions>) => {
        set({
          previewOptions: {
            ...get().previewOptions,
            ...options
          }
        })
      },

      setPreviewContainerElement: (element) => {
        set({ previewContainerElement: element })
      },

      generatePreview: async () => {
        const generation = ++revision
        const { sourceType, sourceData, formatType, exportOptions } = get()

        if (!sourceType || !sourceData) {
          set({ error: 'Please select a source first' })
          return
        }

        set({ isGenerating: true, error: null })

        try {
          const result = await exportManager.generatePreview(
            sourceType,
            sourceData,
            formatType,
            exportOptions
          )
          if (generation !== revision) return

          set({
            previewResult: result,
            editedContent: null,
            isDirty: false,
            isGenerating: false,
            isPreviewStale: false
          })
        } catch (error) {
          if (generation !== revision) return
          set({
            error: error instanceof Error ? error.message : 'Failed to generate preview',
            isGenerating: false
          })
        }
      },

      // ==================== Edit Actions ====================

      setEditedContent: (content: string | Blob) => {
        revision++
        set({
          isGenerating: false,
          editedContent: content,
          isDirty: true
        })
      },

      enterEditMode: () => {
        set({ isEditing: true })
      },

      exitEditMode: () => {
        set({ isEditing: false })
      },

      confirmOverwrite: () => {
        // Clear edited content and regenerate preview
        set({
          editedContent: null,
          isDirty: false
        })
      },

      // ==================== Export Actions ====================

      doExport: async () => {
        const { previewResult, editedContent, isDirty, formatType } = get()

        const contentToExport =
          isDirty && editedContent !== null ? editedContent : previewResult?.content

        if (contentToExport === undefined || contentToExport === null) {
          set({ error: 'No content to export' })
          throw new Error('没有可导出的内容')
        }

        try {
          const format = exportManager.getFormat(formatType)
          if (!format) {
            throw new Error(`Format plugin not found: ${formatType}`)
          }

          // Generate filename
          const timestamp = new Date().toISOString().slice(0, 10)
          const filename = `export-${timestamp}.${format.extension}`

          await command('dialog.saveFile', {
            suggestedName: filename,
            content:
              typeof contentToExport === 'string' ? contentToExport : await contentToExport.text(),
            filters: [{ name: format.name, extensions: [format.extension] }]
          })
          set({ error: null })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to export'
          })
          throw error
        }
      },

      copyToClipboard: async () => {
        const { previewResult, editedContent, isDirty } = get()

        const contentToCopy =
          isDirty && editedContent !== null ? editedContent : previewResult?.content

        if (contentToCopy === undefined || contentToCopy === null) {
          set({ error: 'No content to copy' })
          throw new Error('没有可复制的内容')
        }

        try {
          const text =
            typeof contentToCopy === 'string' ? contentToCopy : await contentToCopy.text()
          if (!(await copyToClipboard(text))) throw new Error('复制失败，请重试')
          set({ error: null })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to copy to clipboard'
          })
          throw error
        }
      },

      downloadImage: async () => {
        const { previewContainerElement } = get()

        if (!previewContainerElement) {
          throw new Error('请先生成预览')
        }

        const blob = await screenshotElement(previewContainerElement)
        const timestamp = new Date().toISOString().slice(0, 10)
        downloadBlob(blob, `export-${timestamp}.png`)
      },

      copyImageToClipboard: async () => {
        const { previewContainerElement } = get()

        if (!previewContainerElement) {
          throw new Error('请先生成预览')
        }

        const blob = await screenshotElement(previewContainerElement)
        await copyImageToClipboardUtil(blob)
      },

      // ==================== Reset ====================

      reset: () => {
        revision++
        set({
          sourceType: null,
          sourceData: null,
          formatType: 'markdown',
          exportOptions: { ...DEFAULT_EXPORT_OPTIONS },
          previewOptions: { ...DEFAULT_PREVIEW_OPTIONS },
          previewResult: null,
          // Note: Don't reset previewContainerElement - it's a UI ref managed by the component
          editedContent: null,
          isDirty: false,
          isEditing: false,
          isGenerating: false,
          isPreviewStale: true,
          error: null
        })
      }
    }
  })

const ExportStoreContext = createContext<ReturnType<typeof createExportStore> | null>(null)

/** 每个已挂载导出页签持有独立状态，关闭页签后释放。 */
export function ExportStoreProvider({ children }: { children: ReactNode }): ReactNode {
  const [store] = useState(createExportStore)
  return createElement(ExportStoreContext.Provider, { value: store }, children)
}

export function useExportStore(): ExportStore {
  const store = useContext(ExportStoreContext)
  if (!store) throw new Error('导出编辑器缺少状态容器')
  return useStore(store)
}
