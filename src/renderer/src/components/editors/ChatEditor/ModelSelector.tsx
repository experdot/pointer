import React from 'react'
import { Select } from 'antd'
import { useSettingsStore } from '../../../stores/settingsStore'

interface ModelSelectorProps {
  value?: string
  onChange?: (llmId: string) => void
  onSelect?: () => void
  size?: 'small' | 'middle' | 'large'
  style?: React.CSSProperties
  variant?: 'outlined' | 'filled' | 'borderless'
  disabled?: boolean
}

export function ModelSelector({
  value,
  onChange,
  onSelect,
  size = 'small',
  style,
  variant,
  disabled
}: ModelSelectorProps): React.JSX.Element {
  const { settings, setDefaultLLMId } = useSettingsStore()
  const llmConfigs = settings.llmConfigs.items

  const currentValue = value ?? settings.defaultLLMId

  const handleChange = (llmId: string): void => {
    if (onChange) {
      onChange(llmId)
    } else {
      setDefaultLLMId(llmId)
    }
    onSelect?.()
  }

  return (
    <Select
      size={size}
      style={{ minWidth: 100, fontSize: 12, color: 'var(--ant-color-text-tertiary)', ...style }}
      value={currentValue}
      onChange={handleChange}
      placeholder="选择模型"
      variant={variant}
      disabled={disabled}
      options={llmConfigs.map((config) => ({
        value: config.id,
        label: config.name
      }))}
    />
  )
}
