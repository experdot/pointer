import React from 'react'
import { Select, Typography, Tag } from 'antd'
import { StarFilled, RobotOutlined } from '@ant-design/icons'
import { LLMConfig } from '../../../types/type'

const { Text } = Typography

interface ModelSelectorProps {
  llmConfigs: LLMConfig[]
  selectedModel?: string
  defaultLLMId?: string
  onChange: (modelId: string) => void
  disabled?: boolean
  size?: 'small' | 'middle' | 'large'
}

export default function ModelSelector({
  llmConfigs,
  selectedModel,
  defaultLLMId,
  onChange,
  disabled = false,
  size = 'middle'
}: ModelSelectorProps) {
  const options = llmConfigs.map((config) => ({
    value: config.id,
    label: (
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <RobotOutlined />
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {config.name}
            </Text>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {defaultLLMId === config.id && (
            <Tag color="gold" icon={<StarFilled />}>
              默认
            </Tag>
          )}
        </div>
      </div>
    )
  }))

  return (
    <Select
      value={selectedModel}
      onChange={onChange}
      disabled={disabled}
      size={size}
      style={{ minWidth: 100, minHeight: 32 }}
      placeholder="选择模型"
      options={options}
      optionLabelProp="label"
    />
  )
}
