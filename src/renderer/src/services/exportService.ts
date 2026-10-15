import { v4 as uuidv4 } from 'uuid'
import { useTabsStore } from '../stores/tabsStore'
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
  useTabsStore.getState().openTab({
    id: uuidv4(),
    type: 'export',
    title: '导出',
    closable: true,
    context
  } as Parameters<ReturnType<typeof useTabsStore.getState>['openTab']>[0] & {
    context?: ExportEditorContext
  })
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
