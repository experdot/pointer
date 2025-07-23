import React, { useCallback, useEffect, useRef } from 'react'
import { useUIStore } from '../../stores/uiStore'

interface ResizeHandleProps {
  onResize?: (width: number) => void
}

export default function ResizeHandle({ onResize }: ResizeHandleProps) {
  const { sidebarWidth, setSidebarWidth } = useUIStore()
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isResizing.current = true
      startX.current = e.clientX
      startWidth.current = sidebarWidth
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [sidebarWidth]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing.current) return

      const deltaX = e.clientX - startX.current
      const newWidth = startWidth.current + deltaX

      setSidebarWidth(newWidth)
      onResize?.(newWidth)
    },
    [setSidebarWidth, onResize]
  )

  const handleMouseUp = useCallback(() => {
    if (!isResizing.current) return

    isResizing.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  return (
    <div
      className="resize-handle"
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '4px',
        height: '100%',
        cursor: 'col-resize',
        backgroundColor: 'transparent',
        zIndex: 1000
      }}
    />
  )
}
