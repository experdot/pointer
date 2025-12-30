import React from 'react'
import { Typography, Flex, Button } from 'antd'
import { PlusOutlined, SettingOutlined } from '@ant-design/icons'
import './WelcomePage.css'

const { Title, Text } = Typography

interface WelcomePageProps {
  onNewChat?: () => void
  onOpenSettings?: () => void
}

export function WelcomePage({ onNewChat, onOpenSettings }: WelcomePageProps): React.JSX.Element {
  return (
    <Flex className="welcome-page" vertical align="center" justify="center">
      <Title level={2} className="welcome-title">
        欢迎使用 Pointer
      </Title>
      <Text type="secondary" className="welcome-subtitle">
        智能 AI 聊天助手
      </Text>
      <Flex gap={12} className="welcome-actions">
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={onNewChat}>
          新建聊天
        </Button>
        <Button icon={<SettingOutlined />} size="large" onClick={onOpenSettings}>
          设置
        </Button>
      </Flex>
    </Flex>
  )
}
