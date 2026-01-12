import { create } from 'zustand'
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
export const useExportStore = create<ExportStore>((set, get) => ({
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
      previewResult: null,
      editedContent: isDirty ? get().editedContent : null,
      error: null
    })
  },

  setSourceData: (data: SourceData) => {
    set({
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

    set({
      formatType: type,
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
    set({
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

      set({
        previewResult: result,
        editedContent: null,
        isDirty: false,
        isGenerating: false,
        isPreviewStale: false
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to generate preview',
        isGenerating: false
      })
    }
  },

  // ==================== Edit Actions ====================

  setEditedContent: (content: string | Blob) => {
    set({
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

    if (!contentToExport) {
      set({ error: 'No content to export' })
      return
    }

    try {
      const format = exportManager.getFormat(formatType)
      if (!format) {
        throw new Error(`Format plugin not found: ${formatType}`)
      }

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 10)
      const filename = `export-${timestamp}.${format.extension}`

      // Create blob and trigger download
      const blob =
        contentToExport instanceof Blob
          ? contentToExport
          : new Blob([contentToExport], { type: format.mimeType })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to export'
      })
    }
  },

  copyToClipboard: async () => {
    const { previewResult, editedContent, isDirty } = get()

    const contentToCopy = isDirty && editedContent !== null ? editedContent : previewResult?.content

    if (!contentToCopy) {
      set({ error: 'No content to copy' })
      return
    }

    try {
      if (contentToCopy instanceof Blob) {
        // For binary formats, read as text
        const text = await contentToCopy.text()
        await navigator.clipboard.writeText(text)
      } else {
        await navigator.clipboard.writeText(contentToCopy)
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to copy to clipboard'
      })
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
}))
