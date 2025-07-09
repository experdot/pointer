import React, { useCallback, useEffect, useRef } from 'react'
import { useAppContext } from '../store/AppContext'

interface ResizeHandleProps {
  onResize?: (width: number) => void
}

export default function ResizeHandle({ onResize }: ResizeHandleProps) {
  const { state, dispatch } = useAppContext()
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isResizing.current = true
      startX.current = e.clientX
      startWidth.current = state.sidebarWidth
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [state.sidebarWidth]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing.current) return

      const deltaX = e.clientX - startX.current
      const newWidth = startWidth.current + deltaX

      dispatch({
        type: 'SET_SIDEBAR_WIDTH',
        payload: { width: newWidth }
      })

      onResize?.(newWidth)
    },
    [dispatch, onResize]
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

  // 如果侧边栏收起，不显示拖拽手柄
  if (state.sidebarCollapsed) {
    return null
  }

  return (
    <div
      className="resize-handle"
      onMouseDown={handleMouseDown}
      style={{
        width: '4px',
        height: '100%',
        backgroundColor: 'transparent',
        cursor: 'col-resize',
        position: 'absolute',
        right: '-2px',
        top: 0,
        zIndex: 10,
        transition: 'background-color 0.2s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#d9d9d9'
      }}
      onMouseLeave={(e) => {
        if (!isResizing.current) {
          e.currentTarget.style.backgroundColor = 'transparent'
        }
      }}
    />
  )
}
