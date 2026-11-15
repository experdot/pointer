import { t, useI18n } from '@renderer/i18n'
import type { FC } from 'react'
import type {
  SourcePlugin,
  SourceSelectorProps,
  TextSnippetSourceData,
  ExportOptions,
  ExtractedContent
} from '../../types'

/**
 * TextSnippet Source Selector Component
 *
 * Returns null as text snippets are passed via context and don't need UI.
 */
// eslint-disable-next-line react-refresh/only-export-components
const TextSnippetSourceSelector: FC<SourceSelectorProps<TextSnippetSourceData>> = () => {
  useI18n()

  return null
}

/**
 * TextSnippet Source Plugin
 *
 * For exporting text snippets (plain text content).
 */
export const textSnippetSourcePlugin: SourcePlugin<TextSnippetSourceData> = {
  id: 'text-snippet',
  get name(): string {
    return t('export.textSource')
  },
  icon: '📝',
  supportedFormats: ['markdown', 'txt', 'html'],

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async extract(data: TextSnippetSourceData, _: ExportOptions): Promise<ExtractedContent> {
    return {
      contentType: 'text',
      rawContent: data.text,
      metadata: {
        pageId: data.sourceInfo?.pageId
      }
    }
  },

  SelectorComponent: TextSnippetSourceSelector
}
