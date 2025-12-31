import React, { useCallback, useRef, useEffect } from 'react'
import { Typography } from 'antd'
import { useLayoutStore, type ActivityPanel } from '../../../stores/layoutStore'
import { Explorer } from '../../panels/Explorer'
import './Sidebar.css'

const { Text } = Typography

const panelTitles: Record<string, string> = {
  explorer: '资源管理器',
  search: '搜索',
  favorites: '收藏',
  tasks: '任务'
}

const panelComponents: Record<ActivityPanel, React.ComponentType | null> = {
  explorer: Explorer,
  search: null,
  favorites: null,
  tasks: null
}

export function Sidebar(): React.JSX.Element {
  const { sidebarWidth, sidebarVisible, activePanel, setSidebarWidth } = useLayoutStore()
  const resizing = useRef(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  // 清理函数，在组件卸载时调用
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      resizing.current = true

      const startX = e.clientX
      const startWidth = sidebarWidth

      const handleMouseMove = (e: MouseEvent) => {
        if (!resizing.current) return
        const delta = e.clientX - startX
        setSidebarWidth(startWidth + delta)
      }

      const handleMouseUp = () => {
        resizing.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        cleanupRef.current = null
      }

      // 保存清理函数
      cleanupRef.current = handleMouseUp

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [sidebarWidth, setSidebarWidth]
  )

  if (!sidebarVisible) return <></>

  const PanelComponent = panelComponents[activePanel]

  return (
    <div className="sidebar" style={{ width: sidebarWidth }}>
      <div className="sidebar-header">
        <Text className="sidebar-title">{panelTitles[activePanel]}</Text>
      </div>
      <div className="sidebar-content">{PanelComponent && <PanelComponent />}</div>
      <div className="sidebar-resizer" onMouseDown={handleMouseDown} />
    </div>
  )
}
