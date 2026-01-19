import React from 'react'
import { Form, Select, Card, InputNumber } from 'antd'
import { FormInstance } from 'antd/lib/form'
import { useSettingsStore } from '../../stores/settingsStore'

const { Option } = Select

const INPUT_WIDTH = 200

interface AppearanceSettingsProps {
  form: FormInstance
}

export default function AppearanceSettings({ form }: AppearanceSettingsProps) {
  const { setFontSize, setInputMinRows } = useSettingsStore()

  const handleFontSizeChange = (value: 'small' | 'medium' | 'large') => {
    setFontSize(value)
  }

  const handleInputMinRowsChange = (value: number | null) => {
    if (value !== null) {
      setInputMinRows(value)
    }
  }

  return (
    <Card title="外观设置">
      <Form.Item name="fontSize" label="字体大小">
        <Select onChange={handleFontSizeChange} style={{ width: INPUT_WIDTH }}>
          <Option value="small">小</Option>
          <Option value="medium">中</Option>
          <Option value="large">大</Option>
        </Select>
      </Form.Item>
      <Form.Item name="inputMinRows" label="输入框初始行高">
        <InputNumber
          min={1}
          max={10}
          onChange={handleInputMinRowsChange}
          style={{ width: INPUT_WIDTH }}
        />
      </Form.Item>
    </Card>
  )
}
