import type { FC } from 'react'
import { Input } from 'antd'
import type { EditorPlugin, EditorProps } from '../../types'

const { TextArea } = Input

/**
 * Text Editor Component
 *
 * Simple textarea-based editor for text content.
 * TODO: Replace with Monaco Editor for better editing experience.
 */
const TextEditorComponent: FC<EditorProps> = ({ content, options, onChange }) => {
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
        placeholder="编辑内容..."
      />
    </div>
  )
}

/**
 * Text Editor Plugin
 *
 * Supports editing markdown, txt, and html formats.
 */
export const textEditorPlugin: EditorPlugin = {
  id: 'text-editor',
  formats: ['markdown', 'txt', 'html'],
  Component: TextEditorComponent
}
