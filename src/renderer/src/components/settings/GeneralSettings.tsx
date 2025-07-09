import React from 'react'
import { Card, Space, Switch, Typography } from 'antd'

const { Text } = Typography

export default function GeneralSettings() {
  return (
    <Card size="small" title="通用设置" bordered={false}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text strong>启用快捷键</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              启用键盘快捷键功能
            </Text>
          </div>
          <Switch defaultChecked />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text strong>自动保存聊天</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              自动保存聊天记录到本地
            </Text>
          </div>
          <Switch defaultChecked />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text strong>发送统计信息</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              帮助改进应用体验（匿名）
            </Text>
          </div>
          <Switch defaultChecked />
        </div>
      </Space>
    </Card>
  )
}
