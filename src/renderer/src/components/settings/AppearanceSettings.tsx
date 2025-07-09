import React from 'react'
import { Form, Select, Card } from 'antd'
import { FormInstance } from 'antd/lib/form'

const { Option } = Select

interface AppearanceSettingsProps {
  form: FormInstance
}

export default function AppearanceSettings({ form }: AppearanceSettingsProps) {
  return (
    <Card size="small" title="外观设置">
      <Form.Item name="fontSize" label="字体大小">
        <Select>
          <Option value="small">小</Option>
          <Option value="medium">中</Option>
          <Option value="large">大</Option>
        </Select>
      </Form.Item>
    </Card>
  )
}
