import type { FC } from 'react'
import type { PreviewerPlugin, PreviewerProps } from '../../types'

/**
 * HTML Previewer Component
 *
 * Renders HTML content in a sandboxed iframe.
 */
const HtmlPreviewerComponent: FC<PreviewerProps> = ({ result, options }) => {
  const content = typeof result.content === 'string' ? result.content : ''

  return (
    <div
      style={{
        height: '100%',
        overflow: 'hidden',
        background: 'var(--ant-color-bg-container)'
      }}
    >
      <iframe
        srcDoc={content}
        sandbox="allow-same-origin"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: '#fff',
          transform: options.zoom ? `scale(${options.zoom})` : undefined,
          transformOrigin: 'top left'
        }}
        title="HTML Preview"
      />
    </div>
  )
}

/**
 * HTML Previewer Plugin
 *
 * Supports HTML format preview using sandboxed iframe.
 */
export const htmlPreviewerPlugin: PreviewerPlugin = {
  id: 'html-previewer',
  formats: ['html'],
  Component: HtmlPreviewerComponent
}
