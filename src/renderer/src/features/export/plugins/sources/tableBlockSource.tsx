import type { FC } from 'react'
import { Input, Table } from 'antd'
import { useMemo } from 'react'
import type {
  SourcePlugin,
  SourceSelectorProps,
  TableBlockSourceData,
  ExportOptions,
  ExtractedContent
} from '../../types'

const { TextArea } = Input

/**
 * Parse markdown table into structured data
 */
function parseMarkdownTable(markdown: string): { headers: string[]; rows: string[][] } {
  const lines = markdown.trim().split('\n')
  const headers: string[] = []
  const rows: string[][] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Skip empty lines
    if (!line) continue

    // Skip separator line (|----|-----|)
    if (/^\|?[\s-:|]+\|?$/.test(line)) continue

    // Parse table row
    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell !== '')

    if (headers.length === 0) {
      headers.push(...cells)
    } else {
      rows.push(cells)
    }
  }

  return { headers, rows }
}

/**
 * TableBlock Source Selector Component
 *
 * Shows table preview and allows editing markdown.
 */
const TableBlockSourceSelector: FC<SourceSelectorProps<TableBlockSourceData>> = ({
  data,
  onChange
}) => {
  const markdown = data?.markdown ?? ''

  const handleMarkdownChange = (newMarkdown: string): void => {
    onChange({
      type: 'table-block',
      markdown: newMarkdown,
      sourceInfo: data?.sourceInfo
    })
  }

  // Parse table for preview
  const { headers, rows } = useMemo(() => parseMarkdownTable(markdown), [markdown])

  // Build Ant Design Table columns and data
  const columns = headers.map((header, index) => ({
    title: header,
    dataIndex: `col${index}`,
    key: `col${index}`
  }))

  const tableData = rows.map((row, rowIndex) => {
    const record: Record<string, string> = { key: String(rowIndex) }
    row.forEach((cell, colIndex) => {
      record[`col${colIndex}`] = cell
    })
    return record
  })

  return (
    <div>
      <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 13 }}>表格预览</div>
      {headers.length > 0 ? (
        <Table
          columns={columns}
          dataSource={tableData}
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
          style={{ marginBottom: 16 }}
        />
      ) : (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            color: 'var(--ant-color-text-secondary)',
            background: 'var(--ant-color-bg-layout)',
            borderRadius: 6,
            marginBottom: 16
          }}
        >
          无法解析表格内容
        </div>
      )}

      <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 13 }}>Markdown 源码</div>
      <TextArea
        value={markdown}
        onChange={(e) => handleMarkdownChange(e.target.value)}
        placeholder="输入 Markdown 表格..."
        autoSize={{ minRows: 4, maxRows: 10 }}
        style={{ fontFamily: 'monospace', fontSize: 12 }}
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
        {headers.length} 列 × {rows.length} 行
      </div>
    </div>
  )
}

/**
 * TableBlock Source Plugin
 *
 * For exporting markdown tables.
 */
export const tableBlockSourcePlugin: SourcePlugin<TableBlockSourceData> = {
  id: 'table-block',
  name: '表格',
  icon: '📊',
  supportedFormats: ['markdown', 'txt', 'html', 'csv'],

  async extract(data: TableBlockSourceData, _options: ExportOptions): Promise<ExtractedContent> {
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
