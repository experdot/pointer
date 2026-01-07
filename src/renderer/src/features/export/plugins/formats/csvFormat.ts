import type { FormatPlugin, ExtractedContent, ExportOptions, ConvertResult } from '../../types'

/**
 * CSV Format Plugin
 *
 * Converts table content to CSV format.
 * Only supports table source type.
 */
export const csvFormatPlugin: FormatPlugin = {
  id: 'csv',
  name: 'CSV',
  extension: 'csv',
  mimeType: 'text/csv',

  async convert(content: ExtractedContent, _options: ExportOptions): Promise<ConvertResult> {
    if (content.contentType !== 'table') {
      throw new Error('CSV format only supports table content')
    }

    const csv = markdownTableToCsv(content.rawContent)

    return {
      content: csv,
      preview: csv,
      isBinary: false,
      extension: 'csv',
      mimeType: 'text/csv'
    }
  }
}

/**
 * Convert markdown table to CSV format
 */
function markdownTableToCsv(markdown: string): string {
  const lines = markdown.trim().split('\n')
  const rows: string[][] = []

  for (const line of lines) {
    // Skip separator lines (e.g., |---|---|)
    if (/^[\s|:-]+$/.test(line)) continue

    // Parse table row
    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0)

    if (cells.length > 0) {
      rows.push(cells)
    }
  }

  // Convert to CSV
  const csvLines = rows.map((row) => {
    return row
      .map((cell) => {
        // Escape quotes and wrap in quotes if necessary
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`
        }
        return cell
      })
      .join(',')
  })

  return csvLines.join('\n')
}
