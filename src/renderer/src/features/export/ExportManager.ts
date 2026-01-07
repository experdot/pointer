import type {
  SourceType,
  FormatType,
  SourcePlugin,
  FormatPlugin,
  PreviewerPlugin,
  EditorPlugin,
  SourceData,
  ExtractedContent,
  ExportOptions,
  ConvertResult
} from './types'

/**
 * ExportManager - Plugin registry center for the export feature
 *
 * Manages registration and retrieval of:
 * - Source plugins (data sources like messages, text snippets, etc.)
 * - Format plugins (output formats like markdown, html, png, etc.)
 * - Previewer plugins (preview components for different formats)
 * - Editor plugins (edit components for different formats)
 */
class ExportManager {
  private sources = new Map<SourceType, SourcePlugin>()
  private formats = new Map<FormatType, FormatPlugin>()
  private previewers: PreviewerPlugin[] = []
  private editors: EditorPlugin[] = []

  // ==================== Registration Methods ====================

  /**
   * Register a source plugin
   */
  registerSource<T extends SourceData>(plugin: SourcePlugin<T>): void {
    this.sources.set(plugin.id, plugin as unknown as SourcePlugin)
  }

  /**
   * Register a format plugin
   */
  registerFormat(plugin: FormatPlugin): void {
    this.formats.set(plugin.id, plugin)
  }

  /**
   * Register a previewer plugin
   */
  registerPreviewer(plugin: PreviewerPlugin): void {
    // Remove existing previewer with same id if exists
    this.previewers = this.previewers.filter((p) => p.id !== plugin.id)
    this.previewers.push(plugin)
  }

  /**
   * Register an editor plugin
   */
  registerEditor(plugin: EditorPlugin): void {
    // Remove existing editor with same id if exists
    this.editors = this.editors.filter((e) => e.id !== plugin.id)
    this.editors.push(plugin)
  }

  // ==================== Query Methods ====================

  /**
   * Get a source plugin by type
   */
  getSource<T extends SourceData>(type: SourceType): SourcePlugin<T> | undefined {
    return this.sources.get(type) as SourcePlugin<T> | undefined
  }

  /**
   * Get all registered source plugins
   */
  getAllSources(): SourcePlugin[] {
    return Array.from(this.sources.values())
  }

  /**
   * Get a format plugin by type
   */
  getFormat(type: FormatType): FormatPlugin | undefined {
    return this.formats.get(type)
  }

  /**
   * Get all registered format plugins
   */
  getAllFormats(): FormatPlugin[] {
    return Array.from(this.formats.values())
  }

  /**
   * Get supported formats for a source type
   */
  getSupportedFormats(sourceType: SourceType): FormatPlugin[] {
    const source = this.sources.get(sourceType)
    if (!source) return []

    return source.supportedFormats
      .map((formatType) => this.formats.get(formatType))
      .filter((format): format is FormatPlugin => format !== undefined)
  }

  /**
   * Get a previewer plugin for a format
   */
  getPreviewerForFormat(format: FormatType): PreviewerPlugin | undefined {
    return this.previewers.find((p) => p.formats.includes(format))
  }

  /**
   * Get an editor plugin for a format
   */
  getEditorForFormat(format: FormatType): EditorPlugin | undefined {
    return this.editors.find((e) => e.formats.includes(format))
  }

  // ==================== Export Flow Methods ====================

  /**
   * Extract content from source data
   */
  async extractContent(
    sourceType: SourceType,
    sourceData: SourceData,
    options: ExportOptions
  ): Promise<ExtractedContent> {
    const source = this.getSource(sourceType)
    if (!source) {
      throw new Error(`Source plugin not found: ${sourceType}`)
    }
    return source.extract(sourceData, options)
  }

  /**
   * Convert extracted content to target format
   */
  async convertContent(
    content: ExtractedContent,
    formatType: FormatType,
    options: ExportOptions
  ): Promise<ConvertResult> {
    const format = this.getFormat(formatType)
    if (!format) {
      throw new Error(`Format plugin not found: ${formatType}`)
    }
    return format.convert(content, options)
  }

  /**
   * Full export flow: extract -> convert
   */
  async generatePreview(
    sourceType: SourceType,
    sourceData: SourceData,
    formatType: FormatType,
    options: ExportOptions
  ): Promise<ConvertResult> {
    const content = await this.extractContent(sourceType, sourceData, options)
    return this.convertContent(content, formatType, options)
  }

  // ==================== Validation Methods ====================

  /**
   * Check if a source type is registered
   */
  hasSource(type: SourceType): boolean {
    return this.sources.has(type)
  }

  /**
   * Check if a format type is registered
   */
  hasFormat(type: FormatType): boolean {
    return this.formats.has(type)
  }

  /**
   * Check if a format is supported by a source
   */
  isFormatSupported(sourceType: SourceType, formatType: FormatType): boolean {
    const source = this.sources.get(sourceType)
    return source?.supportedFormats.includes(formatType) ?? false
  }
}

// Singleton instance
export const exportManager = new ExportManager()

// Re-export types for convenience
export type { SourcePlugin, FormatPlugin, PreviewerPlugin, EditorPlugin }
