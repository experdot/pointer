import React from 'react'
import { Flex, Spin, Typography } from 'antd'
import { useSwitchTransactionStore } from '../../stores/switchTransactionStore'

const { Text, Title } = Typography

export function SwitchTransactionOverlay(): React.JSX.Element | null {
  const { inProgress, kind, targetLabel, message } = useSwitchTransactionStore()

  if (!inProgress) {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(255, 255, 255, 0.86)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <Flex
        vertical
        align="center"
        justify="center"
        gap={12}
        style={{ width: '100%', height: '100%' }}
      >
        <Spin size="large" />
        <Title level={4} style={{ margin: 0 }}>
          {kind === 'account' ? '正在切换账户' : '正在切换工作区'}
        </Title>
        {targetLabel ? <Text strong>{targetLabel}</Text> : null}
        {message ? <Text type="secondary">{message}</Text> : null}
      </Flex>
    </div>
  )
}
