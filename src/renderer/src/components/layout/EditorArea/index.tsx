import React, { useEffect, useRef, useState } from 'react'
import { Empty } from 'antd'
import { Tabs } from '../Tabs'
import { useTabsStore } from '../../../stores/tabsStore'
import { renderTabEditor } from '../../../utils/tabRegistry'
import './EditorArea.css'

export function EditorArea(): React.JSX.Element {
  const { tabs, activeTabId, cleanupInvalidTabs } = useTabsStore()

  // UI 层维护：记录哪些 tab 曾被激活过（用于懒加载 + 保持挂载）
  const [activatedIds, setActivatedIds] = useState<Set<string>>(() => {
    // 初始化时将当前 activeTabId 加入集合
    return activeTabId ? new Set([activeTabId]) : new Set()
  })

  // 使用 ref 存储 cleanupInvalidTabs 避免依赖变化
  const cleanupRef = useRef(cleanupInvalidTabs)
  cleanupRef.current = cleanupInvalidTabs

  // 定期清理无效的 tabs（使用注册机制验证）
  useEffect(() => {
    cleanupRef.current()
  }, [tabs.length])

  // 当 activeTabId 变化时，将其加入已激活集合
  useEffect(() => {
    if (activeTabId && !activatedIds.has(activeTabId)) {
      setActivatedIds((prev) => new Set(prev).add(activeTabId))
    }
  }, [activeTabId, activatedIds])

  // 当 tab 被关闭时，从已激活集合中移除
  useEffect(() => {
    const currentTabIds = new Set(tabs.map((t) => t.id))
    setActivatedIds((prev) => {
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (currentTabIds.has(id)) {
          next.add(id)
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [tabs])

  // 获取需要渲染的 tabs（已激活且仍存在）
  const tabsToRender = tabs.filter((t) => activatedIds.has(t.id))

  return (
    <div className="editor-area">
      <div className="editor-tabs">
        <Tabs />
      </div>
      <div className="editor-content">
        {tabsToRender.length === 0 ? (
          <Empty description="打开一个聊天开始对话" style={{ marginTop: 100 }} />
        ) : (
          tabsToRender.map((tab) => (
            <div
              key={tab.id}
              className="editor-pane"
              style={{ display: tab.id === activeTabId ? 'flex' : 'none' }}
            >
              {renderTabEditor(tab)}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
