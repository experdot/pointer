import type { FC } from 'react'
import { Input, Select } from 'antd'
import type {
  SourcePlugin,
  SourceSelectorProps,
  CodeBlockSourceData,
  ExportOptions,
  ExtractedContent
} from '../../types'

const { TextArea } = Input

// Common programming languages
const LANGUAGES = [
  { value: 'text', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'shell', label: 'Shell' },
  { value: 'bash', label: 'Bash' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
  { value: 'markdown', label: 'Markdown' }
]

/**
 * CodeBlock Source Selector Component
 *
 * Allows editing code content and selecting language.
 */
const CodeBlockSourceSelector: FC<SourceSelectorProps<CodeBlockSourceData>> = ({
  data,
  onChange
}) => {
  const code = data?.code ?? ''
  const language = data?.language ?? 'text'

  const handleCodeChange = (newCode: string): void => {
    onChange({
      type: 'code-block',
      code: newCode,
      language,
      sourceInfo: data?.sourceInfo
    })
  }

  const handleLanguageChange = (newLanguage: string): void => {
    onChange({
      type: 'code-block',
      code,
      language: newLanguage,
      sourceInfo: data?.sourceInfo
    })
  }

  // Count lines
  const lineCount = code.split('\n').length

  return (
    <div>
      <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 13 }}>编程语言</div>
      <Select
        value={language}
        onChange={handleLanguageChange}
        options={LANGUAGES}
        style={{ width: '100%', marginBottom: 16 }}
        showSearch
        filterOption={(input, option) =>
          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
        }
      />

      <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 13 }}>代码内容</div>
      <TextArea
        value={code}
        onChange={(e) => handleCodeChange(e.target.value)}
        placeholder="输入或粘贴代码..."
        autoSize={{ minRows: 10, maxRows: 25 }}
        style={{
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          fontSize: 13,
          lineHeight: 1.5
        }}
      />

      <div
        style={{
          marginTop: 12,
          padding: 12,
          background: 'var(--ant-color-bg-layout)',
          borderRadius: 6,
          fontSize: 13,
          display: 'flex',
          gap: 16
        }}
      >
        <span>
          行数: <strong>{lineCount}</strong>
        </span>
        <span>
          字符: <strong>{code.length}</strong>
        </span>
      </div>
    </div>
  )
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

  async extract(data: CodeBlockSourceData, _options: ExportOptions): Promise<ExtractedContent> {
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
