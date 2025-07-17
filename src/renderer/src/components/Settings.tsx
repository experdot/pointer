import React, { useState } from 'react'
import { Modal, Form, Tabs, Space, Button, App } from 'antd'
import { SettingOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons'
import { useSettingsStore } from '../stores/settingsStore'
import AppearanceSettings from './settings/AppearanceSettings'
import LLMSettings from './settings/LLMSettings'
import DataManagement from './settings/DataManagement'
import SettingsDemo from './settings/SettingsDemo'

interface SettingsProps {
  open: boolean
  onClose: () => void
  embedded?: boolean
}

export default function Settings({ open, onClose, embedded = false }: SettingsProps) {
  const { settings, updateSettings } = useSettingsStore()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const { message } = App.useApp()

  const handleSave = async () => {
    try {
      setLoading(true)
      const values = await form.validateFields()

      // 只更新表单相关的设置，保持LLM配置不变
      const formSettings = {
        fontSize: values.fontSize
      }

      updateSettings(formSettings)
      message.success('设置已保存')
      if (!embedded) {
        onClose()
      }
    } catch (error) {
      message.error('保存失败，请检查输入')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    form.setFieldsValue({
      fontSize: settings.fontSize
    })
  }

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

  const settingsContent = (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        fontSize: settings.fontSize
      }}
    >
      <Tabs items={tabItems} />
      {embedded && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <Button key="reset" onClick={handleReset} icon={<ReloadOutlined />}>
            重置
          </Button>
          <Button
            key="save"
            type="primary"
            loading={loading}
            onClick={handleSave}
            icon={<SaveOutlined />}
          >
            保存
          </Button>
        </div>
      )}
    </Form>
  )

  if (!open) return null

  if (embedded) {
    return (
      <div className="settings-embedded">
        {settingsContent}
      </div>
    )
  }

  return (
    <Modal
      title={
        <Space>
          <SettingOutlined />
          应用设置
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={700}
      footer={[
        <Button key="reset" onClick={handleReset} icon={<ReloadOutlined />}>
          重置
        </Button>,
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={loading}
          onClick={handleSave}
          icon={<SaveOutlined />}
        >
          保存
        </Button>
      ]}
    >
      {settingsContent}
    </Modal>
  )
}
