import type { ReactNode, FC } from 'react'
import type { ChatMessage, Topic } from '../../types/type'

// ==================== Source Types ====================

export type SourceType = 'messages' | 'text-snippet' | 'table-block' | 'code-block'

export type MessageSelectionMode =
  | 'all-branches' // All branches (entire tree)
  | 'current-branch' // Current path only
  | 'topic-messages' // Messages within a topic
  | 'free-select' // Manual selection

// Source data structures
export interface MessagesSourceData {
  type: 'messages'
  pageId: string
  selectionMode: MessageSelectionMode
  selectedMessageIds: string[]
  topicId?: string // For topic-messages mode
}

export interface TextSnippetSourceData {
  type: 'text-snippet'
  text: string
  sourceInfo?: {
    pageId?: string
    messageId?: string
  }
}

export interface TableBlockSourceData {
  type: 'table-block'
  markdown: string
  sourceInfo?: {
    pageId?: string
    messageId?: string
  }
}

export interface CodeBlockSourceData {
  type: 'code-block'
  code: string
  language: string
  sourceInfo?: {
    pageId?: string
    messageId?: string
  }
}

export type SourceData =
  | MessagesSourceData
  | TextSnippetSourceData
  | TableBlockSourceData
  | CodeBlockSourceData

// ==================== Format Types ====================

export type FormatType = 'markdown' | 'txt' | 'html' | 'png' | 'csv'

// Source -> Format compatibility matrix
export const FORMAT_SUPPORT: Record<SourceType, FormatType[]> = {
  messages: ['markdown', 'txt', 'html', 'png'],
  'text-snippet': ['markdown', 'txt', 'html', 'png'],
  'table-block': ['markdown', 'csv', 'html', 'png'],
  'code-block': ['markdown', 'txt', 'html', 'png']
}

// ==================== Export Options ====================

export interface MessageMetadataOptions {
  showAvatar: boolean
  showTimestamp: boolean
  showModelName: boolean
  showModelConfig: boolean
  showMessageTitle: boolean
  showTopicsOutline: boolean
  showReasoningContent: boolean
}

export const DEFAULT_METADATA_OPTIONS: MessageMetadataOptions = {
  showAvatar: false,
  showTimestamp: true,
  showModelName: false,
  showModelConfig: false,
  showMessageTitle: true,
  showTopicsOutline: false,
  showReasoningContent: false
}

export interface ImageExportOptions {
  width: number
  quality: number
  theme: 'light' | 'dark'
  backgroundColor: string
}

export const DEFAULT_IMAGE_OPTIONS: ImageExportOptions = {
  width: 800,
  quality: 1,
  theme: 'light',
  backgroundColor: '#ffffff'
}

export interface ExportOptions {
  format: FormatType
  metadata: MessageMetadataOptions
  imageOptions: ImageExportOptions
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'markdown',
  metadata: DEFAULT_METADATA_OPTIONS,
  imageOptions: DEFAULT_IMAGE_OPTIONS
}

// ==================== Preview Options ====================

export type PreviewMode = 'view' | 'edit'

export interface PreviewOptions {
  mode: PreviewMode
  fontSize: number
  wordWrap: boolean
  zoom: number
}

export const DEFAULT_PREVIEW_OPTIONS: PreviewOptions = {
  mode: 'view',
  fontSize: 14,
  wordWrap: true,
  zoom: 1
}

// ==================== Extracted Content ====================

export interface ExtractedContent {
  // Raw content type
  contentType: 'messages' | 'text' | 'table' | 'code'
  // Raw text content
  rawContent: string
  // Structured data (for messages)
  messages?: ChatMessage[]
  topics?: Topic[]
  // Code metadata
  language?: string
  // Additional metadata
  metadata?: {
    title?: string
    createdAt?: number
    pageId?: string
    messageId?: string
  }
}

// ==================== Converted Result ====================

export interface ConvertResult {
  // Converted content (string for text formats, Blob for binary)
  content: string | Blob
  // Preview-specific representation (e.g., HTML for markdown preview)
  preview?: string
  // Whether content is binary
  isBinary: boolean
  // File extension (without dot)
  extension: string
  // MIME type
  mimeType: string
}

// ==================== Plugin Interfaces ====================

export interface SourceSelectorProps<T extends SourceData = SourceData> {
  data: T | null
  onChange: (data: T) => void
  pageId?: string // Context page ID (for messages source)
}

export interface SourcePlugin<T extends SourceData = SourceData> {
  id: SourceType
  name: string
  icon: ReactNode
  supportedFormats: FormatType[]
  // Extract content from source data
  extract: (data: T, options: ExportOptions) => Promise<ExtractedContent>
  // Selector component for choosing source data
  SelectorComponent: FC<SourceSelectorProps<T>>
  // Optional preview component for source panel
  PreviewComponent?: FC<{ data: T }>
}

export interface FormatPlugin {
  id: FormatType
  name: string
  extension: string
  mimeType: string
  // Convert extracted content to target format
  convert: (content: ExtractedContent, options: ExportOptions) => Promise<ConvertResult>
  // Get format-specific preview options schema (optional)
  getPreviewOptionsSchema?: () => PreviewOptionSchema[]
}

export interface PreviewerProps {
  result: ConvertResult
  options: PreviewOptions
  onEditRequest?: () => void
}

export interface PreviewerPlugin {
  id: string
  // Supported format types
  formats: FormatType[]
  // Preview component
  Component: FC<PreviewerProps>
}

export interface EditorProps {
  content: string | Blob
  format: FormatType
  options: PreviewOptions
  onChange: (newContent: string | Blob) => void
}

export interface EditorPlugin {
  id: string
  // Supported format types
  formats: FormatType[]
  // Editor component
  Component: FC<EditorProps>
}

// ==================== Option Schema ====================

export interface PreviewOptionSchema {
  key: string
  label: string
  type: 'boolean' | 'select' | 'number' | 'string'
  defaultValue: unknown
  options?: { label: string; value: unknown }[]
  group?: string
}

// ==================== Export State ====================

export interface ExportState {
  // Source configuration
  sourceType: SourceType | null
  sourceData: SourceData | null

  // Export configuration
  formatType: FormatType
  exportOptions: ExportOptions

  // Preview state
  previewOptions: PreviewOptions
  previewResult: ConvertResult | null

  // Edit state
  editedContent: string | Blob | null
  isDirty: boolean
  isEditing: boolean

  // Loading state
  isGenerating: boolean
  error: string | null
}

export interface ExportActions {
  // Source actions
  setSourceType: (type: SourceType) => void
  setSourceData: (data: SourceData) => void

  // Format actions
  setFormatType: (type: FormatType) => void
  updateExportOptions: (options: Partial<ExportOptions>) => void

  // Preview actions
  updatePreviewOptions: (options: Partial<PreviewOptions>) => void
  generatePreview: () => Promise<void>

  // Edit actions
  setEditedContent: (content: string | Blob) => void
  enterEditMode: () => void
  exitEditMode: () => void
  confirmOverwrite: () => void

  // Export actions
  doExport: () => Promise<void>
  copyToClipboard: () => Promise<void>

  // Reset
  reset: () => void
}

export type ExportStore = ExportState & ExportActions

// ==================== Export Editor Props ====================

export interface ExportEditorContext {
  sourceType?: SourceType
  pageId?: string
  messageIds?: string[]
  text?: string
  code?: string
  language?: string
  table?: string
}

export interface ExportEditorProps {
  context?: ExportEditorContext
}
