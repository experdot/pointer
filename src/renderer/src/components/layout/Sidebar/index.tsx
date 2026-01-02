import React, { useCallback, useRef, useEffect, useState } from 'react'
import { Typography, Drawer } from 'antd'
import { useLayoutStore, type ActivityPanel } from '../../../stores/layoutStore'
import { Explorer } from '../../panels/Explorer'
import './Sidebar.css'

const { Text } = Typography

// 紧凑模式阈值
const COMPACT_MODE_THRESHOLD = 768

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
  const {
    sidebarWidth,
    sidebarVisible,
    activePanel,
    setSidebarWidth,
    setSidebarVisible,
    setCompactMode,
    isCompactMode,
    minSidebarWidth,
    maxSidebarWidth
  } = useLayoutStore()
  const resizing = useRef(false)
  // 拖拽时的临时宽度，null 表示未在拖拽
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const [isMac, setIsMac] = useState(false)

  // 检测平台
  useEffect(() => {
    window.electronWindow?.getPlatform().then((platform: string) => {
      setIsMac(platform === 'darwin')
    })
  }, [])

  // 监听窗口 resize
  useEffect(() => {
    const handleResize = (): void => {
      setCompactMode(window.innerWidth < COMPACT_MODE_THRESHOLD)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [setCompactMode])

  // 拖拽事件处理
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!resizing.current) return
      const newWidth = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, e.clientX - 48))
      setDragWidth(newWidth)
    }

    const handleMouseUp = (): void => {
      if (resizing.current) {
        resizing.current = false
        setDragWidth((w) => {
          if (w !== null) setSidebarWidth(w)
          return null
        })
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [minSidebarWidth, maxSidebarWidth, setSidebarWidth])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizing.current = true
  }, [])

  const PanelComponent = panelComponents[activePanel]
  const displayWidth = dragWidth ?? sidebarWidth

  const sidebarContent = (
    <>
      <div className="sidebar-header">
        <Text className="sidebar-title">{panelTitles[activePanel]}</Text>
      </div>
      <div className="sidebar-content">{PanelComponent && <PanelComponent />}</div>
    </>
  )

  // 紧凑模式：使用 Drawer
  if (isCompactMode) {
    return (
      <Drawer
        open={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        placement="left"
        width={sidebarWidth}
        styles={{
          wrapper: isMac ? { paddingTop: 40, background: 'var(--ant-color-bg-container)' } : undefined,
          content: isMac ? { borderTop: '1px solid var(--ant-color-border)' } : undefined,
          body: { padding: 0, display: 'flex', flexDirection: 'column' }
        }}
        title={panelTitles[activePanel]}
      >
        <div className="sidebar-content">{PanelComponent && <PanelComponent />}</div>
      </Drawer>
    )
  }

  // 正常模式
  if (!sidebarVisible) return <></>

  return (
    <div className="sidebar" style={{ width: displayWidth }}>
      {sidebarContent}
      <div className="sidebar-resizer" onMouseDown={handleMouseDown} />
    </div>
  )
}
