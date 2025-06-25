import React from 'react'
import { Select, Typography, Tag } from 'antd'
import { StarFilled, RobotOutlined } from '@ant-design/icons'
import { LLMConfig } from '../../types'

const { Text } = Typography

interface ModelSelectorProps {
  llmConfigs: LLMConfig[]
  selectedModel?: string
  defaultModelId?: string
  onChange: (modelId: string) => void
  disabled?: boolean
  size?: 'small' | 'middle' | 'large'
}

export default function ModelSelector({
  llmConfigs,
  selectedModel,
  defaultModelId,
  onChange,
  disabled = false,
  size = 'middle'
}: ModelSelectorProps) {
  const getDisplayValue = () => {
    if (!selectedModel) return undefined

    const config = llmConfigs.find((config) => config.id === selectedModel)
    return config ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <RobotOutlined />
        <Text>{config.name}</Text>
        {config.isDefault && <StarFilled style={{ color: '#faad14', fontSize: 12 }} />}
      </div>
    ) : (
      selectedModel
    )
  }

  const options = llmConfigs.map((config) => ({
    value: config.id,
    label: (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RobotOutlined />
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {config.name}
            </Text>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {config.isDefault && (
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
      dropdownStyle={{ minWidth: 250 }}
      optionLabelProp="label"
    />
  )
}
