import React, { useState } from 'react'
import { Flex, Tooltip, Popover, Avatar } from 'antd'
import {
  FileOutlined,
  SearchOutlined,
  StarOutlined,
  UnorderedListOutlined,
  UserOutlined
} from '@ant-design/icons'
import { useLayoutStore, type ActivityPanel } from '../../../stores/layoutStore'
import { useAccountStore } from '../../../stores/accountStore'
import { UserProfileCard } from './UserProfileCard'
import './ActivityBar.css'

interface ActivityItem {
  key: ActivityPanel
  icon: React.ReactNode
  title: string
}

const activities: ActivityItem[] = [
  { key: 'explorer', icon: <FileOutlined />, title: '资源管理器' },
  { key: 'search', icon: <SearchOutlined />, title: '搜索' },
  { key: 'favorites', icon: <StarOutlined />, title: '收藏' },
  { key: 'tasks', icon: <UnorderedListOutlined />, title: '任务' }
]

export function ActivityBar(): React.JSX.Element {
  const { activePanel, sidebarVisible, setActivePanel } = useLayoutStore()
  const { accounts, currentAccountId } = useAccountStore()
  const currentAccount = accounts.find((a) => a.id === currentAccountId)
  const [popoverOpen, setPopoverOpen] = useState(false)

  return (
    <Flex className="activity-bar" vertical justify="space-between">
      <Flex vertical>
        {activities.map((item) => (
          <Tooltip key={item.key} title={item.title} placement="right">
            <button
              className={`activity-bar-item ${activePanel === item.key && sidebarVisible ? 'active' : ''}`}
              onClick={() => setActivePanel(item.key)}
            >
              {item.icon}
            </button>
          </Tooltip>
        ))}
      </Flex>
      <Flex vertical className="activity-bar-bottom">
        <Popover
          content={<UserProfileCard onClose={() => setPopoverOpen(false)} />}
          trigger="click"
          placement="rightBottom"
          arrow={false}
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
        >
          <button className="activity-bar-item activity-bar-avatar">
            <Avatar size={28} icon={<UserOutlined />} src={currentAccount?.avatar} />
          </button>
        </Popover>
      </Flex>
    </Flex>
  )
}
