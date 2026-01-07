import type { FC } from 'react'
import { Table } from 'antd'
import { useMemo } from 'react'
import type { PreviewerPlugin, PreviewerProps } from '../../types'

/**
 * Parse CSV content into rows and columns
 */
function parseCsv(csv: string): { headers: string[]; rows: string[][] } {
  const lines = csv.trim().split('\n')
  if (lines.length === 0) return { headers: [], rows: [] }

  const parseRow = (line: string): string[] => {
    const cells: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        cells.push(current)
        current = ''
      } else {
        current += char
      }
    }
    cells.push(current)
    return cells
  }

  const headers = parseRow(lines[0])
  const rows = lines.slice(1).map(parseRow)

  return { headers, rows }
}

/**
 * CSV/Table Previewer Component
 *
 * Displays CSV content in a table format.
 */
const TablePreviewerComponent: FC<PreviewerProps> = ({ result }) => {
  const content = typeof result.content === 'string' ? result.content : ''

  const { headers, rows } = useMemo(() => parseCsv(content), [content])

  // Build Ant Design Table columns and data
  const columns = headers.map((header, index) => ({
    title: header || `Column ${index + 1}`,
    dataIndex: `col${index}`,
    key: `col${index}`,
    ellipsis: true
  }))

  const tableData = rows.map((row, rowIndex) => {
    const record: Record<string, string> = { key: String(rowIndex) }
    row.forEach((cell, colIndex) => {
      record[`col${colIndex}`] = cell
    })
    return record
  })

  if (headers.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ant-color-text-secondary)'
        }}
      >
        无法解析表格内容
      </div>
    )
  }

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        padding: 16,
        background: 'var(--ant-color-bg-container)'
      }}
    >
      <Table
        columns={columns}
        dataSource={tableData}
        pagination={rows.length > 50 ? { pageSize: 50 } : false}
        size="small"
        scroll={{ x: 'max-content' }}
        bordered
      />
    </div>
  )
}

/**
 * Table/CSV Previewer Plugin
 *
 * Supports CSV format preview in table form.
 */
export const tablePreviewerPlugin: PreviewerPlugin = {
  id: 'table-previewer',
  formats: ['csv'],
  Component: TablePreviewerComponent
}
