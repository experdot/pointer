import React, { useState } from 'react'
import { Flex, Tooltip, Popover, Avatar } from 'antd'
import {
  MessageOutlined,
  SearchOutlined,
  StarOutlined,
  UnorderedListOutlined,
  SettingOutlined,
  FolderOutlined
} from '@ant-design/icons'
import { useLayoutStore, type ActivityPanel } from '../../../stores/layoutStore'
import { useAccountStore } from '../../../stores/accountStore'
import { UserProfileCard, getAvatarConfig } from './UserProfileCard'
import { WorkspaceCard } from './WorkspaceCard'
import { openSettings } from '../../../services/settingsService'
import './ActivityBar.css'

interface ActivityItem {
  key: ActivityPanel
  icon: React.ReactNode
  title: string
}

const activities: ActivityItem[] = [
  { key: 'explorer', icon: <MessageOutlined />, title: '资源管理器' },
  { key: 'search', icon: <SearchOutlined />, title: '搜索' },
  { key: 'favorites', icon: <StarOutlined />, title: '收藏' },
  { key: 'tasks', icon: <UnorderedListOutlined />, title: '任务' }
]

export function ActivityBar(): React.JSX.Element {
  const { activePanel, sidebarVisible, setActivePanel } = useLayoutStore()
  const { accounts, currentAccountId } = useAccountStore()
  const currentAccount = accounts.find((a) => a.id === currentAccountId)
  const avatarConfig = getAvatarConfig(currentAccount?.avatar)
  const [userPopoverOpen, setUserPopoverOpen] = useState(false)
  const [workspacePopoverOpen, setWorkspacePopoverOpen] = useState(false)

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
          content={<WorkspaceCard onClose={() => setWorkspacePopoverOpen(false)} />}
          trigger="click"
          placement="rightBottom"
          arrow={false}
          open={workspacePopoverOpen}
          onOpenChange={setWorkspacePopoverOpen}
          destroyOnHidden
        >
          <Tooltip title="工作区" placement="right">
            <button className="activity-bar-item">
              <FolderOutlined />
            </button>
          </Tooltip>
        </Popover>
        <Tooltip title="设置" placement="right">
          <button className="activity-bar-item" onClick={() => openSettings()}>
            <SettingOutlined />
          </button>
        </Tooltip>
        <Popover
          content={<UserProfileCard onClose={() => setUserPopoverOpen(false)} />}
          trigger="click"
          placement="rightBottom"
          arrow={false}
          open={userPopoverOpen}
          onOpenChange={setUserPopoverOpen}
          destroyOnHidden
        >
          <button className="activity-bar-item activity-bar-avatar">
            <Avatar
              size={28}
              icon={<avatarConfig.icon />}
              style={{ backgroundColor: avatarConfig.color }}
            />
          </button>
        </Popover>
      </Flex>
    </Flex>
  )
}
