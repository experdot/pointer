import React from 'react'
import { Tabs } from 'antd'
import type { TabsProps } from 'antd'
import {
  ApiOutlined,
  RobotOutlined,
  FileTextOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  DatabaseOutlined
} from '@ant-design/icons'
import { GeneralPanel } from './GeneralPanel'
import { LLMConfigPanel } from './LLMConfigPanel'
import { ModelConfigPanel } from './ModelConfigPanel'
import { PromptListPanel } from './PromptListPanel'
import { DataPanel } from './DataPanel'
import { AboutPanel } from './AboutPanel'
import './SettingsEditor.css'

export function SettingsEditor(): React.JSX.Element {
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
      key: 'prompts',
      label: (
        <span>
          <FileTextOutlined /> 提示词列表
        </span>
      ),
      children: <PromptListPanel />
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
      <Tabs items={items} className="settings-tabs" />
    </div>
  )
}
