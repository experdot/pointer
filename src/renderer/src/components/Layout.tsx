import React, { useState, useEffect } from 'react'
import { Layout as AntLayout, Button, Tooltip } from 'antd'
import { MenuUnfoldOutlined, MenuFoldOutlined } from '@ant-design/icons'
import { useAppContext } from '../store/AppContext'
import Sidebar from './Sidebar'
import TabsArea from './TabsArea'
import ResizeHandle from './ResizeHandle'
import GlobalSearch from './sidebar/GlobalSearch'

const { Sider, Content, Header } = AntLayout

export default function Layout() {
  const { state, dispatch } = useAppContext()
  const [searchOpen, setSearchOpen] = useState(false)

  // 处理键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K 或 Cmd+K 打开搜索
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      // ESC 关闭搜索
      if (e.key === 'Escape' && searchOpen) {
        handleCloseSearch()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [searchOpen])

  const handleCloseSearch = () => {
    setSearchOpen(false)
    dispatch({ type: 'CLEAR_SEARCH' })
  }

  const handleWidthChange = (newWidth: number) => {
    dispatch({ type: 'SET_SIDEBAR_WIDTH', payload: { width: newWidth } })
  }

  const toggleSidebar = () => {
    dispatch({ type: 'TOGGLE_SIDEBAR' })
  }

  return (
    <AntLayout className="app-layout">
      <Header className="app-header">
        <div className="header-left">
          <Tooltip title={state.sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}>
            <Button
              type="text"
              icon={state.sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={toggleSidebar}
            />
          </Tooltip>
          <h2 className="app-title">AI聊天助手</h2>
        </div>
        <div className="header-right">{/* 可以添加其他头部操作按钮 */}</div>
      </Header>

      <AntLayout>
        <Sider
          width={state.sidebarWidth}
          collapsedWidth={50}
          collapsed={state.sidebarCollapsed}
          theme="light"
          className="app-sider"
          style={{ position: 'relative' }}
        >
          <Sidebar collapsed={state.sidebarCollapsed} />
          <ResizeHandle />
        </Sider>

        <Content className="app-content">
          <TabsArea />
        </Content>
      </AntLayout>
      <GlobalSearch visible={searchOpen} onClose={handleCloseSearch} />
    </AntLayout>
  )
}
