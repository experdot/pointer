import type { FC } from 'react'
import type { PreviewerPlugin, PreviewerProps } from '../../types'

/**
 * Text Previewer Component
 *
 * Simple text previewer for markdown and txt formats.
 * Displays content in a preformatted text block.
 */
const TextPreviewerComponent: FC<PreviewerProps> = ({ result, options }) => {
  const content = typeof result.content === 'string' ? result.content : '[Binary content]'

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
          fontFamily: 'monospace',
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
 */
export const textPreviewerPlugin: PreviewerPlugin = {
  id: 'text-previewer',
  formats: ['markdown', 'txt'],
  Component: TextPreviewerComponent
}
