import React from 'react'
import { Form, Tabs } from 'antd'
import { useSettingsStore } from '../../stores/settingsStore'
import AppearanceSettings from './AppearanceSettings'
import LLMSettings from './LLMSettings'
import ModelConfigSettings from './ModelConfigSettings'
import PromptListSettings from './PromptListSettings'
import DataManagement from './DataManagement'
import SettingsDemo from './SettingsDemo'
import UpdateSettings from './UpdateSettings'

interface SettingsProps {
  open: boolean
  onClose: () => void
  defaultActiveTab?: string
}

export default function Settings({
  open,
  onClose,
  defaultActiveTab = 'appearance'
}: SettingsProps) {
  const { settings } = useSettingsStore()
  const [form] = Form.useForm()

  const tabItems = [
    {
      key: 'appearance',
      label: '外观',
      children: <AppearanceSettings form={form} />
    },
    {
      key: 'llm',
      label: 'LLM配置',
      children: <LLMSettings />
    },
    {
      key: 'model-config',
      label: '模型配置',
      children: <ModelConfigSettings />
    },
    {
      key: 'prompt-lists',
      label: '提示词列表',
      children: <PromptListSettings />
    },
    {
      key: 'update',
      label: '应用更新',
      children: <UpdateSettings />
    },
    {
      key: 'data',
      label: '数据管理',
      children: <DataManagement />
    },
    {
      key: 'debug',
      label: '持久化状态',
      children: <SettingsDemo />
    }
  ]

  if (!open) return null

  return (
    <div
      className="settings-embedded"
      style={{
        height: '100%',
        maxHeight: 'calc(100vh - 120px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          fontSize: settings.fontSize
        }}
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Tabs
          items={tabItems}
          defaultActiveKey={defaultActiveTab}
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
          tabBarStyle={{
            flexShrink: 0,
            marginBottom: 16
          }}
        />
      </Form>
      <style>{`
        .settings-embedded .ant-tabs-content-holder {
          overflow-y: auto !important;
          flex: 1 !important;
        }
        
        .settings-embedded .ant-tabs-tabpane {
          height: 100% !important;
          overflow-y: auto !important;
          padding-right: 8px !important;
        }
        
        /* 自定义滚动条样式 */
        .settings-embedded .ant-tabs-content-holder::-webkit-scrollbar,
        .settings-embedded .ant-tabs-tabpane::-webkit-scrollbar {
          width: 6px;
        }
        
        .settings-embedded .ant-tabs-content-holder::-webkit-scrollbar-track,
        .settings-embedded .ant-tabs-tabpane::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }
        
        .settings-embedded .ant-tabs-content-holder::-webkit-scrollbar-thumb,
        .settings-embedded .ant-tabs-tabpane::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 3px;
        }
        
        .settings-embedded .ant-tabs-content-holder::-webkit-scrollbar-thumb:hover,
        .settings-embedded .ant-tabs-tabpane::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
      `}</style>
    </div>
  )
}
