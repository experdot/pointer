import type { FC } from 'react'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Table, Input, Button, Space, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { EditorPlugin, EditorProps } from '../../types'

interface TableRow {
  key: string
  [column: string]: string
}

/**
 * Parse CSV string to table data
 */
function parseCsv(csv: string): { headers: string[]; rows: string[][] } {
  const lines = csv.trim().split('\n')
  if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
    return { headers: ['Column 1'], rows: [] }
  }

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
 * Convert table data to CSV string
 */
function toCsv(headers: string[], rows: string[][]): string {
  const escapeCell = (cell: string): string => {
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`
    }
    return cell
  }

  const headerLine = headers.map(escapeCell).join(',')
  const dataLines = rows.map((row) => row.map(escapeCell).join(','))

  return [headerLine, ...dataLines].join('\n')
}

/**
 * CSV Table Editor Component
 *
 * Editable table based on Ant Design Table:
 * - Inline cell editing
 * - Header editing
 * - Add/delete rows and columns
 * - Two-way sync with CSV string
 */
// eslint-disable-next-line react-refresh/only-export-components
const CsvTableEditorComponent: FC<EditorProps> = ({ content, onChange }) => {
  const textContent = typeof content === 'string' ? content : ''

  // Parse initial data
  const initialData = useMemo(() => parseCsv(textContent), [textContent])

  const [headers, setHeaders] = useState<string[]>(initialData.headers)
  const [rows, setRows] = useState<string[][]>(initialData.rows)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  const [editingHeader, setEditingHeader] = useState<number | null>(null)

  // Re-parse when content changes from outside
  useEffect(() => {
    const parsed = parseCsv(textContent)
    setHeaders(parsed.headers)
    setRows(parsed.rows)
  }, [textContent])

  // Sync to parent
  const syncToParent = useCallback(
    (newHeaders: string[], newRows: string[][]) => {
      const csv = toCsv(newHeaders, newRows)
      onChange(csv)
    },
    [onChange]
  )

  // Update cell
  const updateCell = (rowIndex: number, colIndex: number, value: string): void => {
    const newRows = rows.map((row, ri) =>
      ri === rowIndex ? row.map((cell, ci) => (ci === colIndex ? value : cell)) : row
    )
    setRows(newRows)
    syncToParent(headers, newRows)
  }

  // Update header
  const updateHeader = (colIndex: number, value: string): void => {
    const newHeaders = headers.map((h, i) => (i === colIndex ? value : h))
    setHeaders(newHeaders)
    syncToParent(newHeaders, rows)
  }

  // Add row
  const addRow = (): void => {
    const newRow = headers.map(() => '')
    const newRows = [...rows, newRow]
    setRows(newRows)
    syncToParent(headers, newRows)
  }

  // Delete row
  const deleteRow = (rowIndex: number): void => {
    const newRows = rows.filter((_, i) => i !== rowIndex)
    setRows(newRows)
    syncToParent(headers, newRows)
  }

  // Add column
  const addColumn = (): void => {
    const newHeaders = [...headers, `Column ${headers.length + 1}`]
    const newRows = rows.map((row) => [...row, ''])
    setHeaders(newHeaders)
    setRows(newRows)
    syncToParent(newHeaders, newRows)
  }

  // Delete column
  const deleteColumn = (colIndex: number): void => {
    if (headers.length <= 1) return // Keep at least one column
    const newHeaders = headers.filter((_, i) => i !== colIndex)
    const newRows = rows.map((row) => row.filter((_, i) => i !== colIndex))
    setHeaders(newHeaders)
    setRows(newRows)
    syncToParent(newHeaders, newRows)
  }

  // Build table columns
  const columns: ColumnsType<TableRow> = headers.map((header, colIndex) => ({
    title: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {editingHeader === colIndex ? (
          <Input
            size="small"
            value={header}
            onChange={(e) => updateHeader(colIndex, e.target.value)}
            onBlur={() => setEditingHeader(null)}
            onPressEnter={() => setEditingHeader(null)}
            autoFocus
            style={{ flex: 1, minWidth: 60 }}
          />
        ) : (
          <span
            style={{ flex: 1, cursor: 'text', minWidth: 60 }}
            onClick={() => setEditingHeader(colIndex)}
          >
            {header || <span style={{ color: 'var(--ant-color-text-quaternary)' }}>-</span>}
          </span>
        )}
        {headers.length > 1 && (
          <Popconfirm
            title="确认删除此列？"
            onConfirm={() => deleteColumn(colIndex)}
            okText="删除"
            cancelText="取消"
          >
            <Button size="small" type="text" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        )}
      </div>
    ),
    dataIndex: `col${colIndex}`,
    key: `col${colIndex}`,
    render: (value: string, _: TableRow, rowIndex: number) => {
      const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex

      if (isEditing) {
        return (
          <Input
            size="small"
            value={value}
            onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
            onBlur={() => setEditingCell(null)}
            onPressEnter={() => setEditingCell(null)}
            autoFocus
          />
        )
      }

      return (
        <div
          style={{
            minHeight: 22,
            cursor: 'text',
            padding: '2px 4px'
          }}
          onClick={() => setEditingCell({ row: rowIndex, col: colIndex })}
        >
          {value || <span style={{ color: 'var(--ant-color-text-quaternary)' }}>-</span>}
        </div>
      )
    }
  }))

  // Add action column
  columns.push({
    title: (
      <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addColumn}>
        列
      </Button>
    ),
    key: 'actions',
    width: 80,
    render: (_, __, rowIndex) => (
      <Popconfirm
        title="确认删除此行？"
        onConfirm={() => deleteRow(rowIndex)}
        okText="删除"
        cancelText="取消"
      >
        <Button size="small" type="text" icon={<DeleteOutlined />} danger />
      </Popconfirm>
    )
  })

  // Build table data
  const tableData: TableRow[] = rows.map((row, rowIndex) => {
    const record: TableRow = { key: String(rowIndex) }
    row.forEach((cell, colIndex) => {
      record[`col${colIndex}`] = cell
    })
    return record
  })

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--ant-color-bg-container)'
      }}
    >
      {/* Toolbar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--ant-color-border)' }}>
        <Space>
          <Button size="small" icon={<PlusOutlined />} onClick={addRow}>
            添加行
          </Button>
          <span style={{ color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>
            {rows.length} 行 x {headers.length} 列
          </span>
        </Space>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <Table
          columns={columns}
          dataSource={tableData}
          pagination={rows.length > 50 ? { pageSize: 50 } : false}
          size="small"
          scroll={{ x: 'max-content' }}
          bordered
        />
      </div>
    </div>
  )
}

/**
 * CSV Editor Plugin
 *
 * Supports editing CSV format with editable table.
 */
export const csvEditorPlugin: EditorPlugin = {
  id: 'csv-editor',
  formats: ['csv'],
  Component: CsvTableEditorComponent
}
