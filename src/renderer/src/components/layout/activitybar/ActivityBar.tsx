import React from 'react'
import { Button, Badge, Tooltip } from 'antd'
import { FolderOutlined, SearchOutlined, MonitorOutlined, SettingOutlined } from '@ant-design/icons'
import { useAITasksStore } from '../../../stores/aiTasksStore'
import { usePagesStore } from '../../../stores/pagesStore'
import { useTabsStore } from '../../../stores/tabsStore'

export type ActivityBarTab = 'explore' | 'search' | 'tasks'

interface ActivityBarProps {
  activeTab: ActivityBarTab
  onTabChange: (tab: ActivityBarTab) => void
}

export default function ActivityBar({ activeTab, onTabChange }: ActivityBarProps) {
  const { getRunningTasksCount } = useAITasksStore()
  const { createAndOpenSettingsPage } = usePagesStore()
  const { openTab } = useTabsStore()

  // 计算活跃任务数量
  const activeTaskCount = getRunningTasksCount()

  // 处理设置按钮点击
  const handleSettingsClick = () => {
    const settingsPageId = createAndOpenSettingsPage()
    openTab(settingsPageId)
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
      key: 'tasks' as ActivityBarTab,
      icon: <MonitorOutlined />,
      label: '任务监控',
      tooltip: '任务监控 - AI任务状态',
      badge: activeTaskCount > 0 ? activeTaskCount : undefined
    }
  ]

  return (
    <div className="activity-bar">
      {items.map((item) => (
        <Tooltip key={item.key} title={item.tooltip} placement="right">
          <Badge count={item.badge} size="small" offset={[4, -4]}>
            <Button
              type={activeTab === item.key ? 'primary' : 'text'}
              size="large"
              icon={item.icon}
              className="activity-bar-button"
              onClick={() => onTabChange(item.key)}
            />
          </Badge>
        </Tooltip>
      ))}

      {/* 设置按钮独立处理 */}
      <Tooltip title="设置 - 应用程序设置" placement="right">
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
