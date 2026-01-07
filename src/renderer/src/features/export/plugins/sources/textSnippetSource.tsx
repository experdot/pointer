import type { FC } from 'react'
import { Input } from 'antd'
import type {
  SourcePlugin,
  SourceSelectorProps,
  TextSnippetSourceData,
  ExportOptions,
  ExtractedContent
} from '../../types'

const { TextArea } = Input

/**
 * TextSnippet Source Selector Component
 *
 * Allows editing/viewing the text snippet content.
 */
const TextSnippetSourceSelector: FC<SourceSelectorProps<TextSnippetSourceData>> = ({
  data,
  onChange
}) => {
  const text = data?.text ?? ''

  const handleTextChange = (newText: string): void => {
    onChange({
      type: 'text-snippet',
      text: newText,
      sourceInfo: data?.sourceInfo
    })
  }

  return (
    <div>
      <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 13 }}>文本内容</div>
      <TextArea
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder="输入或粘贴文本内容..."
        autoSize={{ minRows: 8, maxRows: 20 }}
        style={{ fontFamily: 'monospace' }}
      />
      <div
        style={{
          marginTop: 12,
          padding: 12,
          background: 'var(--ant-color-bg-layout)',
          borderRadius: 6,
          fontSize: 13
        }}
      >
        字符数: <strong>{text.length}</strong>
      </div>
    </div>
  )
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

  async extract(data: TextSnippetSourceData, _options: ExportOptions): Promise<ExtractedContent> {
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
