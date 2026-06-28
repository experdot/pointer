import type { FC } from 'react'
import type {
  SourcePlugin,
  SourceSelectorProps,
  CodeBlockSourceData,
  ExportOptions,
  ExtractedContent
} from '../../types'

/**
 * CodeBlock Source Selector Component
 *
 * Returns null as code blocks are passed via context and don't need UI.
 */
// eslint-disable-next-line react-refresh/only-export-components
const CodeBlockSourceSelector: FC<SourceSelectorProps<CodeBlockSourceData>> = () => {
  return null
}

/**
 * CodeBlock Source Plugin
 *
 * For exporting code blocks with language information.
 */
export const codeBlockSourcePlugin: SourcePlugin<CodeBlockSourceData> = {
  id: 'code-block',
  name: '代码块',
  icon: '💻',
  supportedFormats: ['markdown', 'txt', 'html'],

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async extract(data: CodeBlockSourceData, _: ExportOptions): Promise<ExtractedContent> {
    return {
      contentType: 'code',
      rawContent: data.code,
      language: data.language,
      metadata: {
        pageId: data.sourceInfo?.pageId
      }
    }
  },

  SelectorComponent: CodeBlockSourceSelector
}
