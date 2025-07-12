import React from 'react'
import { Button, Badge, Tooltip } from 'antd'
import { 
  FolderOutlined, 
  SearchOutlined, 
  MonitorOutlined, 
  SettingOutlined 
} from '@ant-design/icons'
import { useAppContext } from '../store/AppContext'

export type ActivityBarTab = 'explore' | 'search' | 'tasks' | 'settings'

interface ActivityBarProps {
  activeTab: ActivityBarTab
  onTabChange: (tab: ActivityBarTab) => void
}

export default function ActivityBar({ activeTab, onTabChange }: ActivityBarProps) {
  const { state } = useAppContext()

  // 计算活跃任务数量
  const activeTaskCount = state.aiTasks.filter(task => 
    task.status === 'running' || task.status === 'pending'
  ).length

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
    },
    {
      key: 'settings' as ActivityBarTab,
      icon: <SettingOutlined />,
      label: '设置',
      tooltip: '设置 - 应用程序设置'
    }
  ]

  return (
    <div className="activity-bar">
      {items.map(item => (
        <Tooltip key={item.key} title={item.tooltip} placement="right">
          <div className="activity-bar-item">
            {item.badge !== undefined ? (
              <Badge count={item.badge} size="small" offset={[0, 0]}>
                <Button
                  type="text"
                  icon={item.icon}
                  className={`activity-bar-button ${activeTab === item.key ? 'active' : ''}`}
                  onClick={() => onTabChange(item.key)}
                />
              </Badge>
            ) : (
              <Button
                type="text"
                icon={item.icon}
                className={`activity-bar-button ${activeTab === item.key ? 'active' : ''}`}
                onClick={() => onTabChange(item.key)}
              />
            )}
          </div>
        </Tooltip>
      ))}
    </div>
  )
} 