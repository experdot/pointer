import React, { useEffect, useRef } from 'react'
import { Empty } from 'antd'
import { Tabs } from '../Tabs'
import { useTabsStore } from '../../../stores/tabsStore'
import { renderTabEditor } from '../../../utils/tabRegistry'
import './EditorArea.css'

export function EditorArea(): React.JSX.Element {
  const { tabs, activeTabId, cleanupInvalidTabs } = useTabsStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)

  // 使用 ref 存储 cleanupInvalidTabs 避免依赖变化
  const cleanupRef = useRef(cleanupInvalidTabs)
  cleanupRef.current = cleanupInvalidTabs

  // 定期清理无效的 tabs（使用注册机制验证）
  useEffect(() => {
    cleanupRef.current()
  }, [tabs.length])

  const renderContent = (): React.JSX.Element | null => {
    if (!activeTab) {
      return <Empty description="打开一个聊天开始对话" style={{ marginTop: 100 }} />
    }

    const editor = renderTabEditor(activeTab)
    if (editor) {
      return <>{editor}</>
    }

    return <Empty description={`未知的标签类型: ${activeTab.type}`} style={{ marginTop: 100 }} />
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
