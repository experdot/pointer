import React from 'react'
import { Form, Select } from 'antd'
import { useSettings } from '../../../hooks/useSettings'

export function GeneralPanel(): React.JSX.Element {
  const { fontSize, setFontSize } = useSettings()

  return (
    <Form layout="vertical" className="settings-general-panel">
      <Form.Item label="字体大小">
        <Select
          value={fontSize}
          onChange={setFontSize}
          options={[
            { value: 'small', label: '小' },
            { value: 'medium', label: '中' },
            { value: 'large', label: '大' }
          ]}
          style={{ width: 120 }}
        />
      </Form.Item>
    </Form>
  )
}
