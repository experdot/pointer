import type { FC } from 'react'
import { useState } from 'react'
import { Slider } from 'antd'
import type { PreviewerPlugin, PreviewerProps } from '../../types'

/**
 * Image Previewer Component
 *
 * Displays image content with zoom controls.
 */
// eslint-disable-next-line react-refresh/only-export-components
const ImagePreviewerComponent: FC<PreviewerProps> = ({ result }) => {
  const [zoom, setZoom] = useState(100)

  // Get image source - either a data URL string (preview) or blob URL
  let imageSrc: string | null = null

  if (typeof result.preview === 'string' && result.preview.startsWith('data:')) {
    imageSrc = result.preview
  } else if (result.content instanceof Blob) {
    imageSrc = URL.createObjectURL(result.content)
  }

  if (!imageSrc) {
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
        无法预览图片内容
      </div>
    )
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--ant-color-bg-container)'
      }}
    >
      {/* Zoom controls */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--ant-color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}
      >
        <span style={{ fontSize: 13 }}>缩放:</span>
        <Slider
          min={10}
          max={200}
          value={zoom}
          onChange={setZoom}
          style={{ width: 150 }}
          tooltip={{ formatter: (value) => `${value}%` }}
        />
        <span style={{ fontSize: 13, minWidth: 40 }}>{zoom}%</span>
      </div>

      {/* Image display */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          background: '#f5f5f5'
        }}
      >
        <img
          src={imageSrc}
          alt="Export Preview"
          style={{
            maxWidth: '100%',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            background: '#fff'
          }}
        />
      </div>
    </div>
  )
}

/**
 * Image Previewer Plugin
 *
 * Supports PNG format preview with zoom controls.
 */
export const imagePreviewerPlugin: PreviewerPlugin = {
  id: 'image-previewer',
  formats: ['png'],
  Component: ImagePreviewerComponent
}
