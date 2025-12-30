import React, { useEffect } from 'react'
import { Empty } from 'antd'
import { Tabs } from './Tabs'
import { WelcomePage } from '../editors/WelcomePage'
import { useTabsStore } from '../../stores/tabsStore'
import { usePagesStore } from '../../stores/pagesStore'
import './EditorArea.css'

export function EditorArea(): React.JSX.Element {
  const { tabs, activeTabId } = useTabsStore()
  const { cleanupInvalidTabs } = useTabsStore()
  const pages = usePagesStore((state) => state.pages)
  const activeTab = tabs.find((t) => t.id === activeTabId)

  // 同步清理无效的 chat tabs
  useEffect(() => {
    const validPageIds = pages.map((p) => p.id)
    cleanupInvalidTabs(validPageIds)
  }, [pages, cleanupInvalidTabs])

  const renderContent = () => {
    if (!activeTab) {
      return <Empty description="打开一个聊天开始对话" style={{ marginTop: 100 }} />
    }

    switch (activeTab.type) {
      case 'welcome':
        return <WelcomePage />
      case 'chat':
        return <div>聊天编辑器: {activeTab.title}</div>
      case 'settings':
        return <div>设置编辑器</div>
      default:
        return null
    }
  }

  return (
    <div className="editor-area">
      <div className="editor-tabs">
        <Tabs />
      </div>
      <div className="editor-content">{renderContent()}</div>
    </div>
  )
}
