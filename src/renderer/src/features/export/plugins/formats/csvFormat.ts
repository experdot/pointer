import { t } from '@renderer/i18n'
import { parseMarkdownTable } from '../../parseMarkdownTable'
import { encodeCsvRows } from '../../csv'
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async convert(content: ExtractedContent, _: ExportOptions): Promise<ConvertResult> {
    if (content.contentType !== 'table') {
      throw new Error(t('export.csvOnlyTable'))
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
  const rows = parseMarkdownTable(markdown)

  return encodeCsvRows(rows)
}
