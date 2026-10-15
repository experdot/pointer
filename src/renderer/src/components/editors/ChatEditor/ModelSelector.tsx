import React, { useMemo } from 'react'
import { TreeSelect, Divider } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { useSettingsStore } from '../../../stores/settingsStore'
import { openSettings } from '../../../services/settingsService'
import { buildConfigSelectorTree } from '../../../utils/treeNodes'
import './ModelSelector.css'

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
  variant = 'borderless',
  disabled
}: ModelSelectorProps): React.JSX.Element {
  const { settings, setDefaultLLMId } = useSettingsStore()
  const { items, folders } = settings.llmConfigs

  const currentValue = value ?? settings.defaultLLMId

  const treeData = useMemo(() => buildConfigSelectorTree(items, folders), [items, folders])

  const handleChange = (llmId: string): void => {
    if (onChange) {
      onChange(llmId)
    } else {
      setDefaultLLMId(llmId)
    }
    onSelect?.()
  }

  const popupRender = (menu: React.ReactElement): React.ReactElement => (
    <>
      {menu}
      <Divider style={{ margin: '4px 0' }} />
      <div className="model-selector__settings-link" onClick={() => openSettings('llm')}>
        <SettingOutlined /> 管理 LLM 配置
      </div>
    </>
  )

  return (
    <TreeSelect
      className="model-selector"
      size={size}
      style={style}
      value={currentValue}
      onChange={handleChange}
      placeholder="选择模型"
      variant={variant}
      disabled={disabled}
      treeData={treeData}
      treeDefaultExpandAll
      showSearch
      treeNodeFilterProp="title"
      treeLine
      treeExpandAction="click"
      popupMatchSelectWidth={false}
      styles={{ popup: { root: { minWidth: 300 } } }}
      popupRender={popupRender}
    />
  )
}
