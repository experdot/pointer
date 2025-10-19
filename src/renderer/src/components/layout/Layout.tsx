import React, { useState, useEffect } from 'react'
import { Layout as AntLayout, Button, Tooltip, Drawer } from 'antd'
import { useUIStore } from '../../stores/uiStore'
import { useSearchStore } from '../../stores/searchStore'
import Sidebar from './sidebar/Sidebar'
import ActivityBar, { ActivityBarTab } from './activitybar/ActivityBar'
import TabsArea from './tabs/TabsArea'
import ResizeHandle from './ResizeHandle'
import { GlobalSearch } from './sidebar_items/search'
import TitleBar from './titlebar/TitleBar'

const { Sider, Content } = AntLayout

// 定义窄屏幕的阈值
const NARROW_SCREEN_THRESHOLD = 768

export default function Layout() {
  const { sidebarCollapsed, sidebarWidth, toggleSidebar } = useUIStore()
  const { clearSearch, setFilterFolderId } = useSearchStore()
  const [activeTab, setActiveTab] = useState<ActivityBarTab>('explore')
  const [searchOpen, setSearchOpen] = useState(false)
  const [isNarrowScreen, setIsNarrowScreen] = useState(false)

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setIsNarrowScreen(window.innerWidth < NARROW_SCREEN_THRESHOLD)
    }

    // 初始化
    handleResize()

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

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
    // 如果点击的是当前已激活的标签
    if (tab === activeTab) {
      // 如果侧边栏是展开状态，则切换为收起
      if (!sidebarCollapsed) {
        toggleSidebar()
      }
      // 如果已经是收起状态，则展开（复用下面的逻辑）
      else {
        toggleSidebar()
      }
    } else {
      // 点击的是不同的标签
      setActiveTab(tab)
      // 如果侧边栏折叠，自动展开
      if (sidebarCollapsed) {
        toggleSidebar()
      }
    }
  }

  const handleSearchOpen = () => {
    setSearchOpen(true)
  }

  const handleFindInFolder = (folderId: string, folderName: string) => {
    setFilterFolderId(folderId)
    // 切换到搜索标签页
    setActiveTab('search')
    // 如果侧边栏折叠，展开它
    if (sidebarCollapsed) {
      toggleSidebar()
    }
  }

  return (
    <div className="app-layout">
      {/* 自定义标题栏 */}
      <TitleBar title="Pointer - AI聊天助手" />

      <AntLayout className="app-main-layout">
        {/* ActivityBar */}
        <Sider width={64} collapsedWidth={64} theme="light" className="app-activity-bar">
          <ActivityBar activeTab={activeTab} onTabChange={handleActivityTabChange} />
        </Sider>

        {/* 窄屏模式：使用 Drawer */}
        {isNarrowScreen ? (
          <Drawer
            placement="left"
            open={!sidebarCollapsed}
            onClose={toggleSidebar}
            width={sidebarWidth}
            styles={{ body: { padding: 0 } }}
            mask={true}
            maskClosable={true}
            closable={false}
          >
            <Sidebar
              collapsed={false}
              activeTab={activeTab}
              onSearchOpen={handleSearchOpen}
              onSettingsOpen={handleSearchOpen}
              onFindInFolder={handleFindInFolder}
            />
          </Drawer>
        ) : (
          /* 宽屏模式：使用 Sider */
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
              onSettingsOpen={handleSearchOpen}
              onFindInFolder={handleFindInFolder}
            />
            <ResizeHandle />
          </Sider>
        )}

        <Content className="app-content">
          <TabsArea />
        </Content>
      </AntLayout>

      {/* 全局模态框 */}
      <GlobalSearch visible={searchOpen} onClose={handleCloseSearch} />
    </div>
  )
}
