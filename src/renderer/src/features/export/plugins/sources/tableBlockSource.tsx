import { t, useI18n } from '@renderer/i18n'
import type { FC } from 'react'
import type {
  SourcePlugin,
  SourceSelectorProps,
  TableBlockSourceData,
  ExportOptions,
  ExtractedContent
} from '../../types'

/**
 * TableBlock Source Selector Component
 *
 * Returns null as table blocks are passed via context and don't need UI.
 */
// eslint-disable-next-line react-refresh/only-export-components
const TableBlockSourceSelector: FC<SourceSelectorProps<TableBlockSourceData>> = () => {
  useI18n()

  return null
}

/**
 * TableBlock Source Plugin
 *
 * For exporting markdown tables.
 */
export const tableBlockSourcePlugin: SourcePlugin<TableBlockSourceData> = {
  id: 'table-block',
  get name(): string {
    return t('common.table')
  },
  icon: '📊',
  supportedFormats: ['markdown', 'txt', 'html', 'csv'],

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async extract(data: TableBlockSourceData, _: ExportOptions): Promise<ExtractedContent> {
    return {
      contentType: 'table',
      rawContent: data.markdown,
      metadata: {
        pageId: data.sourceInfo?.pageId
      }
    }
  },

  SelectorComponent: TableBlockSourceSelector
}
