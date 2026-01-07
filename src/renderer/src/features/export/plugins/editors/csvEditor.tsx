import type { FC } from 'react'
import { Input } from 'antd'
import type { EditorPlugin, EditorProps } from '../../types'

const { TextArea } = Input

/**
 * CSV Editor Component
 *
 * Simple textarea-based editor for CSV content.
 * TODO: Could be enhanced with a table-based editor for better UX.
 */
const CsvEditorComponent: FC<EditorProps> = ({ content, options, onChange }) => {
  const textContent = typeof content === 'string' ? content : ''

  return (
    <div
      style={{
        height: '100%',
        padding: 16,
        background: 'var(--ant-color-bg-container)'
      }}
    >
      <TextArea
        value={textContent}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: '100%',
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          fontSize: options.fontSize || 14,
          resize: 'none',
          lineHeight: 1.6
        }}
        placeholder="编辑 CSV 内容..."
      />
    </div>
  )
}

/**
 * CSV Editor Plugin
 *
 * Supports editing CSV format.
 */
export const csvEditorPlugin: EditorPlugin = {
  id: 'csv-editor',
  formats: ['csv'],
  Component: CsvEditorComponent
}
