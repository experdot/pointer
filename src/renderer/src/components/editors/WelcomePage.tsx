import { t, useI18n } from '@renderer/i18n'
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
  useI18n()

  return (
    <Flex className="welcome-page" vertical align="center" justify="center">
      <Title level={2} className="welcome-title">
        {t('welcome.title')}
      </Title>
      <Text type="secondary" className="welcome-subtitle">
        {t('welcome.description')}
      </Text>
      <Flex gap={12} className="welcome-actions">
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={onNewChat}>
          {t('chat.newConversation')}
        </Button>
        <Button icon={<SettingOutlined />} size="large" onClick={onOpenSettings}>
          {t('settings.title')}
        </Button>
      </Flex>
    </Flex>
  )
}
