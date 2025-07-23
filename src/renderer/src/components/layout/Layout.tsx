import React, { useState, useEffect } from 'react'
import { Layout as AntLayout, Button, Tooltip } from 'antd'
import { useUIStore } from '../../stores/uiStore'
import { useSearchStore } from '../../stores/searchStore'
import Sidebar from './sidebar/Sidebar'
import ActivityBar, { ActivityBarTab } from './activitybar/ActivityBar'
import TabsArea from './tabs/TabsArea'
import ResizeHandle from './ResizeHandle'
import Settings from '../settings/Settings'
import GlobalSearch from './sidebar_items/search/GlobalSearch'
import TitleBar from './titlebar/TitleBar'

const { Sider, Content } = AntLayout

export default function Layout() {
  const { sidebarCollapsed, sidebarWidth, toggleSidebar } = useUIStore()
  const { clearSearch } = useSearchStore()
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
        if (sidebarCollapsed) {
          toggleSidebar()
        }
      }
      // ESC 关闭搜索
      if (e.key === 'Escape' && activeTab === 'search') {
        clearSearch()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeTab, sidebarCollapsed, toggleSidebar, clearSearch])

  const handleCloseSearch = () => {
    setSearchOpen(false)
    clearSearch()
  }

  const handleActivityTabChange = (tab: ActivityBarTab) => {
    setActiveTab(tab)
    // 如果侧边栏折叠，自动展开
    if (sidebarCollapsed) {
      toggleSidebar()
    }
  }

  const handleSearchOpen = () => {
    setSearchOpen(true)
  }

  const handleSettingsOpen = () => {
    setSettingsOpen(true)
  }

  return (
    <div className="app-layout">
      {/* 自定义标题栏 */}
      <TitleBar
        title="Pointer - AI聊天助手"
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
      />

      <AntLayout className="app-main-layout">
        {/* ActivityBar */}
        <Sider width={50} collapsedWidth={50} theme="light" className="app-activity-bar">
          <ActivityBar activeTab={activeTab} onTabChange={handleActivityTabChange} />
        </Sider>

        {/* Sidebar */}
        <Sider
          width={sidebarWidth}
          collapsedWidth={0}
          collapsed={sidebarCollapsed}
          theme="light"
          className="app-sider"
          style={{ position: 'relative' }}
        >
          <Sidebar
            collapsed={sidebarCollapsed}
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
    </div>
  )
}
