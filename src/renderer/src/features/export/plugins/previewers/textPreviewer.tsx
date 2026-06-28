import type { FC } from 'react'
import { Streamdown } from 'streamdown'
import type { PreviewerPlugin, PreviewerProps } from '../../types'

/**
 * Text Previewer Component
 *
 * Enhanced text previewer:
 * - Markdown format: renders with Streamdown
 * - TXT format: displays as plain text
 */
// eslint-disable-next-line react-refresh/only-export-components
const TextPreviewerComponent: FC<PreviewerProps> = ({ result, options }) => {
  const content = typeof result.content === 'string' ? result.content : '[Binary content]'

  // Determine format from extension
  const format = result.extension

  // Markdown format: use Streamdown for rendering
  if (format === 'md' || format === 'markdown') {
    return (
      <div
        style={{
          padding: 16,
          height: '100%',
          overflow: 'auto',
          background: 'var(--ant-color-bg-container)'
        }}
      >
        <Streamdown mode="static">{content}</Streamdown>
      </div>
    )
  }

  // TXT format: plain text display
  return (
    <div
      style={{
        padding: 16,
        height: '100%',
        overflow: 'auto',
        background: 'var(--ant-color-bg-container)'
      }}
    >
      <pre
        style={{
          margin: 0,
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          fontSize: options.fontSize || 14,
          whiteSpace: options.wordWrap ? 'pre-wrap' : 'pre',
          wordBreak: options.wordWrap ? 'break-word' : 'normal',
          lineHeight: 1.6
        }}
      >
        {content}
      </pre>
    </div>
  )
}

/**
 * Text Previewer Plugin
 *
 * Supports markdown and txt formats.
 * Markdown is rendered with Streamdown, TXT is displayed as plain text.
 */
export const textPreviewerPlugin: PreviewerPlugin = {
  id: 'text-previewer',
  formats: ['markdown', 'txt'],
  Component: TextPreviewerComponent
}
