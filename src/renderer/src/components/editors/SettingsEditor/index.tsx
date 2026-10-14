import React, { useState, useEffect } from 'react'
import { Tabs } from 'antd'
import type { TabsProps } from 'antd'
import {
  ApiOutlined,
  RobotOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  DatabaseOutlined,
  KeyOutlined
} from '@ant-design/icons'
import { GeneralPanel } from './GeneralPanel'
import { LLMConfigPanel } from './LLMConfigPanel'
import { ModelConfigPanel } from './ModelConfigPanel'
import { DataPanel } from './DataPanel'
import { ShortcutsPanel } from './ShortcutsPanel'
import { AboutPanel } from './AboutPanel'
import { consumePendingSettingsTab } from '../../../services/settingsService'
import { useSettingsUIStore } from '../../../stores/settingsUIStore'
import './SettingsEditor.css'

export function SettingsEditor(): React.JSX.Element {
  const [activeKey, setActiveKey] = useState('general')

  const pendingTab = useSettingsUIStore((state) => state.pendingTab)

  // 挂载时与之后的每次请求都要生效（页签已打开时不会重新挂载）
  useEffect(() => {
    if (!pendingTab) return
    setActiveKey(pendingTab)
    consumePendingSettingsTab()
  }, [pendingTab])
  const items: TabsProps['items'] = [
    {
      key: 'general',
      label: (
        <span>
          <SettingOutlined /> 通用
        </span>
      ),
      children: <GeneralPanel />
    },
    {
      key: 'llm',
      label: (
        <span>
          <ApiOutlined /> LLM 配置
        </span>
      ),
      children: <LLMConfigPanel />
    },
    {
      key: 'model',
      label: (
        <span>
          <RobotOutlined /> 模型配置
        </span>
      ),
      children: <ModelConfigPanel />
    },
    {
      key: 'data',
      label: (
        <span>
          <DatabaseOutlined /> 数据
        </span>
      ),
      children: <DataPanel />
    },
    {
      key: 'shortcuts',
      label: (
        <span>
          <KeyOutlined /> 快捷键
        </span>
      ),
      children: <ShortcutsPanel />
    },
    {
      key: 'about',
      label: (
        <span>
          <InfoCircleOutlined /> 关于
        </span>
      ),
      children: <AboutPanel />
    }
  ]

  return (
    <div className="settings-editor">
      <Tabs items={items} activeKey={activeKey} onChange={setActiveKey} className="settings-tabs" />
    </div>
  )
}
