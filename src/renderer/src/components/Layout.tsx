import React, { useState, useEffect } from 'react'
import { Layout as AntLayout, Button, Tooltip } from 'antd'
import { MenuUnfoldOutlined, MenuFoldOutlined } from '@ant-design/icons'
import { useAppContext } from '../store/AppContext'
import Sidebar from './Sidebar'
import ActivityBar, { ActivityBarTab } from './ActivityBar'
import TabsArea from './TabsArea'
import ResizeHandle from './ResizeHandle'
import Settings from './Settings'
import GlobalSearch from './sidebar/GlobalSearch'

const { Sider, Content, Header } = AntLayout

export default function Layout() {
  const { state, dispatch } = useAppContext()
  const [activeTab, setActiveTab] = useState<ActivityBarTab>('explore')
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // 处理键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K 或 Cmd+K 打开搜索
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setActiveTab('search')
        if (state.sidebarCollapsed) {
          dispatch({ type: 'TOGGLE_SIDEBAR' })
        }
      }
      // ESC 关闭搜索
      if (e.key === 'Escape' && activeTab === 'search') {
        dispatch({ type: 'CLEAR_SEARCH' })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeTab, state.sidebarCollapsed, dispatch])

  const handleCloseSearch = () => {
    setSearchOpen(false)
    dispatch({ type: 'CLEAR_SEARCH' })
  }

  const handleActivityTabChange = (tab: ActivityBarTab) => {
    setActiveTab(tab)
    // 如果侧边栏折叠，自动展开
    if (state.sidebarCollapsed) {
      dispatch({ type: 'TOGGLE_SIDEBAR' })
    }
  }

  const handleSearchOpen = () => {
    setSearchOpen(true)
  }

  const handleSettingsOpen = () => {
    setSettingsOpen(true)
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
        {/* ActivityBar */}
        <Sider
          width={50}
          collapsedWidth={50}
          theme="light"
          className="app-activity-bar"
        >
          <ActivityBar
            activeTab={activeTab}
            onTabChange={handleActivityTabChange}
          />
        </Sider>

        {/* Sidebar */}
        <Sider
          width={state.sidebarWidth}
          collapsedWidth={0}
          collapsed={state.sidebarCollapsed}
          theme="light"
          className="app-sider"
          style={{ position: 'relative' }}
        >
          <Sidebar
            collapsed={state.sidebarCollapsed}
            activeTab={activeTab}
            onSearchOpen={handleSearchOpen}
            onSettingsOpen={handleSettingsOpen}
          />
          <ResizeHandle />
        </Sider>

        <Content className="app-content">
          <TabsArea />
        </Content>
      </AntLayout>

      {/* 全局模态框 */}
      <GlobalSearch visible={searchOpen} onClose={handleCloseSearch} />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </AntLayout>
  )
}
