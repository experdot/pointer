import React from 'react'
import { Card, Input, Typography, Space, Button } from 'antd'
import {
  RobotOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  BulbOutlined
} from '@ant-design/icons'

const { Text, Title } = Typography
const { TextArea } = Input

interface TopicInputProps {
  userInput: string
  onUserInputChange: (value: string) => void
  onGenerate?: () => void
  isGenerating?: boolean
  isCompleted?: boolean
  onGoNext?: () => void
}

export default function TopicInput({
  userInput,
  onUserInputChange,
  onGenerate,
  isGenerating,
  isCompleted,
  onGoNext
}: TopicInputProps) {
  return (
    <Card title="输入主题" className="tab-card">
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Title level={5} style={{ marginBottom: 8 }}>
            请输入您要分析的主题
          </Title>
          <Text type="secondary">
            AI 将分析主题并自动生成交叉表的结构元数据，包括横轴维度、纵轴维度和值维度
          </Text>
        </div>

        <TextArea
          value={userInput}
          onChange={(e) => onUserInputChange(e.target.value)}
          placeholder="例如：世界简史、漫威电影宇宙角色分析、常见编程语言对比等"
          autoSize={{ minRows: 4, maxRows: 8 }}
          style={{ fontSize: 14 }}
          disabled={isGenerating}
        />

        <div className="input-hint">
          <Space>
            <BulbOutlined style={{ color: '#faad14' }} />
            <Text type="secondary" italic>
              提示：请输入具体的主题，AI 会自动分析并设计最合适的交叉表结构
            </Text>
          </Space>
        </div>

        {/* 主操作按钮 */}
        <Button
          type="primary"
          size="large"
          icon={isGenerating ? <LoadingOutlined /> : <RobotOutlined />}
          onClick={onGenerate}
          disabled={!userInput.trim() || isGenerating}
          loading={isGenerating}
          style={{ width: '100%' }}
        >
          {isGenerating ? '正在分析主题...' : '分析主题并生成结构'}
        </Button>

        {/* 完成提示 */}
        {isCompleted && !isGenerating && (
          <div className="completion-notice">
            <div className="completion-notice-content">
              <CheckCircleOutlined className="completion-notice-icon" />
              <span className="completion-notice-text">
                主题结构已生成！您可以查看并编辑结构，或继续下一步
              </span>
            </div>
            <Button
              type="primary"
              icon={<ArrowRightOutlined />}
              onClick={onGoNext}
            >
              查看并编辑结构
            </Button>
          </div>
        )}
      </Space>
    </Card>
  )
}
