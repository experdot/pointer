import React from 'react'
import { Button, Flex, Typography, App } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { useSettingsStore } from '../../../stores/settingsStore'
import { usePagesStore } from '../../../stores/pagesStore'
import { useTabsStore } from '../../../stores/tabsStore'
import { useLayoutStore } from '../../../stores/layoutStore'

const { Text } = Typography

export function DataPanel(): React.JSX.Element {
  const { modal } = App.useApp()

  const handleResetAll = (): void => {
    modal.confirm({
      title: '重置所有数据',
      icon: <ExclamationCircleOutlined />,
      content: '此操作将清除所有对话、设置和配置数据，且无法恢复。确定要继续吗？',
      okText: '确定重置',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        usePagesStore.getState().reset()
        useTabsStore.getState().reset()
        useSettingsStore.getState().reset()
        useLayoutStore.getState().reset()
      }
    })
  }

  return (
    <Flex vertical gap={16} style={{ maxWidth: 400 }}>
      <div>
        <Text strong>重置数据</Text>
        <br />
        <Text type="secondary">清除所有本地数据，恢复到初始状态</Text>
      </div>
      <Button danger onClick={handleResetAll}>
        重置所有数据
      </Button>
    </Flex>
  )
}
