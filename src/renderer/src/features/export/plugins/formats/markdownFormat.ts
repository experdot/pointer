import type { FormatPlugin, ExtractedContent, ExportOptions, ConvertResult } from '../../types'

/**
 * Markdown Format Plugin
 *
 * Converts extracted content to Markdown format.
 * For messages, generates a structured markdown document.
 * For other content types, passes through as-is.
 */
export const markdownFormatPlugin: FormatPlugin = {
  id: 'markdown',
  name: 'Markdown',
  extension: 'md',
  mimeType: 'text/markdown',

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async convert(content: ExtractedContent, _: ExportOptions): Promise<ConvertResult> {
    let markdown: string

    switch (content.contentType) {
      case 'messages':
        // Use the raw content which is already formatted as markdown
        markdown = content.rawContent
        break

      case 'text':
        // Wrap text content in markdown
        markdown = content.rawContent
        break

      case 'code':
        // Format as code block
        markdown = formatCodeBlock(content.rawContent, content.language)
        break

      case 'table':
        // Table is already in markdown format
        markdown = content.rawContent
        break

      default:
        markdown = content.rawContent
    }

    return {
      content: markdown,
      preview: markdown,
      isBinary: false,
      extension: 'md',
      mimeType: 'text/markdown'
    }
  }
}

/**
 * Format content as a markdown code block
 */
function formatCodeBlock(code: string, language?: string): string {
  const lang = language || ''
  return `\`\`\`${lang}\n${code}\n\`\`\``
}
