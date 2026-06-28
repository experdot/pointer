import { v4 as uuidv4 } from 'uuid'
import { stores } from '../stores/registry'
import type { ExportEditorContext } from '../features/export/types'

/**
 * Export Service
 *
 * Provides convenient functions to open the export tab
 * with pre-configured context.
 */

/**
 * Open the export tab with optional context
 */
export function openExportTab(context?: ExportEditorContext): void {
  stores.tab.openTab({
    id: uuidv4(),
    type: 'export',
    title: '导出',
    closable: true,
    context
  } as Parameters<typeof stores.tab.openTab>[0] & { context?: ExportEditorContext })
}

/**
 * Export messages from a page
 */
export function exportMessages(pageId: string, messageIds?: string[]): void {
  openExportTab({
    sourceType: 'messages',
    pageId,
    messageIds
  })
}

/**
 * Export a text snippet
 */
export function exportTextSnippet(text: string, pageId?: string): void {
  openExportTab({
    sourceType: 'text-snippet',
    text,
    pageId
  })
}

/**
 * Export a code block
 */
export function exportCodeBlock(code: string, language: string, pageId?: string): void {
  openExportTab({
    sourceType: 'code-block',
    code,
    language,
    pageId
  })
}

/**
 * Export a table block
 */
export function exportTableBlock(table: string, pageId?: string): void {
  openExportTab({
    sourceType: 'table-block',
    table,
    pageId
  })
}

/**
 * Download content as file
 */
export async function downloadFile(
  content: string | Blob,
  filename: string,
  mimeType: string
): Promise<void> {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Copy content to clipboard
 */
export async function copyToClipboard(content: string | Blob): Promise<void> {
  if (content instanceof Blob) {
    // For images, use clipboard API
    await navigator.clipboard.write([
      new ClipboardItem({
        [content.type]: content
      })
    ])
  } else {
    await navigator.clipboard.writeText(content)
  }
}
