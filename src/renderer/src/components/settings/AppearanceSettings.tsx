import React from 'react'
import { Form, Select, Card } from 'antd'
import { FormInstance } from 'antd/lib/form'
import { useSettingsStore } from '../../stores/settingsStore'

const { Option } = Select

interface AppearanceSettingsProps {
  form: FormInstance
}

export default function AppearanceSettings({ form }: AppearanceSettingsProps) {
  const { setFontSize } = useSettingsStore()

  const handleFontSizeChange = (value: 'small' | 'medium' | 'large') => {
    setFontSize(value)
  }

  return (
    <Card title="外观设置">
      <Form.Item name="fontSize" label="字体大小">
        <Select onChange={handleFontSizeChange}>
          <Option value="small">小</Option>
          <Option value="medium">中</Option>
          <Option value="large">大</Option>
        </Select>
      </Form.Item>
    </Card>
  )
}
