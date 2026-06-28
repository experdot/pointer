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
  return null
}

/**
 * TextSnippet Source Plugin
 *
 * For exporting text snippets (plain text content).
 */
export const textSnippetSourcePlugin: SourcePlugin<TextSnippetSourceData> = {
  id: 'text-snippet',
  name: '文本片段',
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
