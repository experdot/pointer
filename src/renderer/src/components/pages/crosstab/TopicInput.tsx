import React from 'react'
import { Card, Input, Typography, Space } from 'antd'

const { Text } = Typography
const { TextArea } = Input

interface TopicInputProps {
  userInput: string
  onUserInputChange: (value: string) => void
}

export default function TopicInput({ userInput, onUserInputChange }: TopicInputProps) {
  return (
    <Card title="输入主题" className="tab-card">
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Text strong>请输入您要分析的主题：</Text>
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            AI将分析主题并自动生成交叉表的结构元数据
          </Text>
        </div>
        <TextArea
          value={userInput}
          onChange={(e) => onUserInputChange(e.target.value)}
          placeholder="例如：世界简史、漫威电影宇宙角色分析、常见编程语言对比等"
          autoSize={{ minRows: 4, maxRows: 8 }}
          style={{ fontSize: 14 }}
        />
        <div className="input-hint">
          <Text type="secondary" italic>
            提示：请输入具体的主题，AI会自动分析并设计最合适的交叉表结构
          </Text>
        </div>
      </Space>
    </Card>
  )
}
