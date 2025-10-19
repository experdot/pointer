import React, { useState } from 'react'
import { Button, Badge, Tooltip } from 'antd'
import {
  FolderOutlined,
  SearchOutlined,
  MonitorOutlined,
  SettingOutlined,
  HeartOutlined
} from '@ant-design/icons'
import { useAITasksStore } from '../../../stores/aiTasksStore'
import { usePagesStore } from '../../../stores/pagesStore'
import { useTabsStore } from '../../../stores/tabsStore'
import { useFavoritesStore } from '../../../stores/favoritesStore'
import './activitybar.css'

export type ActivityBarTab = 'explore' | 'search' | 'tasks' | 'favorites'

interface ActivityBarProps {
  activeTab: ActivityBarTab
  onTabChange: (tab: ActivityBarTab) => void
}

export default function ActivityBar({ activeTab, onTabChange }: ActivityBarProps) {
  const { getRunningTasksCount } = useAITasksStore()
  const { createAndOpenSettingsPage } = usePagesStore()
  const { openTab } = useTabsStore()
  const { getStats } = useFavoritesStore()
  const [tooltipVisible, setTooltipVisible] = useState<Record<string, boolean>>({})
  const [clickLocked, setClickLocked] = useState(false)

  // 计算活跃任务数量
  const activeTaskCount = getRunningTasksCount()

  // 计算收藏统计
  const favoritesStats = getStats()

  // 处理设置按钮点击
  const handleSettingsClick = () => {
    setClickLocked(true)
    setTooltipVisible({ ...tooltipVisible, settings: false })
    const settingsPageId = createAndOpenSettingsPage('llm') // 默认打开LLM配置，因为这是用户最常需要的设置
    openTab(settingsPageId)
    // 300ms 后解锁
    setTimeout(() => setClickLocked(false), 300)
  }

  const items = [
    {
      key: 'explore' as ActivityBarTab,
      icon: <FolderOutlined />,
      label: '资源管理器',
      tooltip: '资源管理器 - 聊天历史'
    },
    {
      key: 'search' as ActivityBarTab,
      icon: <SearchOutlined />,
      label: '搜索',
      tooltip: '搜索 - 全局搜索'
    },
    {
      key: 'favorites' as ActivityBarTab,
      icon: <HeartOutlined />,
      label: '收藏夹',
      tooltip: `收藏夹 - ${favoritesStats.totalCount} 个收藏`,
    },
    {
      key: 'tasks' as ActivityBarTab,
      icon: <MonitorOutlined />,
      label: '任务监控',
      tooltip: '任务监控 - AI任务状态',
      badge: activeTaskCount > 0 ? activeTaskCount : undefined
    }
  ]

  // 处理标签页点击
  const handleTabClick = (tab: ActivityBarTab) => {
    setClickLocked(true)
    // 关闭所有 tooltip
    const allClosed: Record<string, boolean> = {}
    items.forEach(item => {
      allClosed[item.key] = false
    })
    setTooltipVisible(allClosed)
    onTabChange(tab)
    // 300ms 后解锁
    setTimeout(() => setClickLocked(false), 300)
  }

  // 处理 tooltip 显示变化
  const handleTooltipOpenChange = (key: string, visible: boolean) => {
    // 如果在点击锁定期间，不允许显示 tooltip
    if (clickLocked && visible) {
      return
    }
    setTooltipVisible({ ...tooltipVisible, [key]: visible })
  }

  return (
    <div className="activity-bar">
      {items.map((item) => (
        <Tooltip
          key={item.key}
          title={item.tooltip}
          placement="right"
          mouseLeaveDelay={0}
          destroyTooltipOnHide
          open={tooltipVisible[item.key]}
          onOpenChange={(visible) => handleTooltipOpenChange(item.key, visible)}
        >
          <Badge count={item.badge} size="small" offset={[4, -4]}>
            <Button
              type={activeTab === item.key ? 'primary' : 'text'}
              size="large"
              icon={item.icon}
              className="activity-bar-button"
              onClick={() => handleTabClick(item.key)}
            />
          </Badge>
        </Tooltip>
      ))}

      {/* 设置按钮独立处理 */}
      <Tooltip
        title="设置 - 应用程序设置"
        placement="right"
        mouseLeaveDelay={0}
        destroyTooltipOnHide
        open={tooltipVisible.settings}
        onOpenChange={(visible) => handleTooltipOpenChange('settings', visible)}
      >
        <Button
          type="text"
          size="large"
          icon={<SettingOutlined />}
          className="activity-bar-button"
          onClick={handleSettingsClick}
        />
      </Tooltip>
    </div>
  )
}
