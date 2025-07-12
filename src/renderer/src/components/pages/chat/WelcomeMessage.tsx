import React from 'react'
import { RobotOutlined, SettingOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Space, Typography } from 'antd'
import { useAppContext } from '../../../store/AppContext'

const { Text, Title } = Typography

interface WelcomeMessageProps {
  onOpenSettings?: () => void
}

export default function WelcomeMessage({ onOpenSettings }: WelcomeMessageProps) {
  const { state } = useAppContext()

  const hasLLMConfigs = state.settings.llmConfigs && state.settings.llmConfigs.length > 0
  const hasDefaultModel =
    state.settings.defaultLLMId &&
    state.settings.llmConfigs?.find((config) => config.id === state.settings.defaultLLMId)

  // 如果没有配置任何LLM
  if (!hasLLMConfigs) {
    return (
      <div className="chat-welcome">
        <div className="welcome-content">
          <RobotOutlined style={{ fontSize: 64, color: '#faad14', marginBottom: 24 }} />
          <Title level={3} style={{ color: '#262626', marginBottom: 16 }}>
            欢迎使用 Pointer - AI 聊天助手
          </Title>
          <Text type="secondary" style={{ fontSize: 16, marginBottom: 24, display: 'block' }}>
            开始对话前，请先配置您的AI模型
          </Text>
          <Space direction="vertical" size="middle" style={{ width: '100%', maxWidth: 400 }}>
            <div
              style={{
                background: '#fff7e6',
                border: '1px solid #ffd591',
                borderRadius: 8,
                padding: 16,
                textAlign: 'left'
              }}
            >
              <Text strong style={{ color: '#ad6800' }}>
                配置步骤：
              </Text>
              <ol style={{ margin: '8px 0 0 0', paddingLeft: 20, color: '#ad6800' }}>
                <li>点击下方"配置模型"按钮</li>
                <li>添加您的AI服务配置（API密钥等）</li>
                <li>测试连接并保存配置</li>
                <li>返回开始愉快聊天！</li>
              </ol>
            </div>
            <Button
              type="primary"
              size="large"
              icon={<SettingOutlined />}
              onClick={onOpenSettings}
              style={{ width: '100%' }}
            >
              配置模型
            </Button>
          </Space>
        </div>
      </div>
    )
  }

  // 如果有配置但没有默认模型
  if (!hasDefaultModel) {
    return (
      <div className="chat-welcome">
        <div className="welcome-content">
          <RobotOutlined style={{ fontSize: 48, color: '#ff7a45', marginBottom: 16 }} />
          <Title level={4} style={{ color: '#262626', marginBottom: 12 }}>
            请选择默认模型
          </Title>
          <Text type="secondary" style={{ marginBottom: 20, display: 'block' }}>
            您已配置了AI模型，但还需要设置一个默认模型
          </Text>
          <Button type="primary" icon={<SettingOutlined />} onClick={onOpenSettings}>
            设置默认模型
          </Button>
        </div>
      </div>
    )
  }

  // 正常情况：有配置且有默认模型
  return (
    <div className="chat-welcome">
      <div className="welcome-content">
        <RobotOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
        <Title level={4} style={{ color: '#262626', marginBottom: 8 }}>
          开始新的对话
        </Title>
        <Text type="secondary">请在下方输入您的问题或想法</Text>
      </div>
    </div>
  )
}
