import React, { useMemo } from 'react'
import { TreeSelect, Divider } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { useSettingsStore } from '../../../stores/settingsStore'
import { openSettings } from '../../../services/settingsService'
import { buildConfigSelectorTree } from '../../../utils/treeNodes'
import './ModelConfigSelector.css'

interface ModelConfigSelectorProps {
  value?: string
  onChange?: (modelConfigId: string | undefined) => void
  onSelect?: () => void
  size?: 'small' | 'middle' | 'large'
  style?: React.CSSProperties
  variant?: 'outlined' | 'filled' | 'borderless'
  disabled?: boolean
}

export function ModelConfigSelector({
  value,
  onChange,
  onSelect,
  size = 'small',
  style,
  variant = 'borderless',
  disabled
}: ModelConfigSelectorProps): React.JSX.Element {
  const { settings, setDefaultModelConfigId } = useSettingsStore()
  const { items, folders } = settings.modelConfigs

  const currentValue = value ?? settings.defaultModelConfigId

  const treeData = useMemo(() => buildConfigSelectorTree(items, folders), [items, folders])

  const handleChange = (modelConfigId: string | undefined): void => {
    if (onChange) {
      onChange(modelConfigId)
    } else {
      setDefaultModelConfigId(modelConfigId)
    }
    onSelect?.()
  }

  const popupRender = (menu: React.ReactElement): React.ReactElement => (
    <>
      {menu}
      <Divider style={{ margin: '4px 0' }} />
      <div className="model-config-selector__settings-link" onClick={() => openSettings('model')}>
        <SettingOutlined /> 管理模型配置
      </div>
    </>
  )

  return (
    <TreeSelect
      className="model-config-selector"
      size={size}
      style={style}
      value={currentValue}
      onChange={handleChange}
      placeholder="模型配置"
      variant={variant}
      disabled={disabled}
      treeData={treeData}
      treeDefaultExpandAll
      showSearch
      allowClear
      treeNodeFilterProp="title"
      treeLine
      treeExpandAction="click"
      popupMatchSelectWidth={false}
      styles={{ popup: { root: { minWidth: 200 } } }}
      popupRender={popupRender}
    />
  )
}
