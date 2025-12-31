import React from 'react'
import { Typography, Flex, Divider } from 'antd'
import { GithubOutlined } from '@ant-design/icons'

const { Title, Text, Link } = Typography

export function AboutPanel(): React.JSX.Element {
  return (
    <Flex vertical gap={16} style={{ maxWidth: 400 }}>
      <div>
        <Title level={4} style={{ margin: 0 }}>Pointer</Title>
        <Text type="secondary">智能 AI 聊天助手</Text>
      </div>
      <Divider style={{ margin: 0 }} />
      <Flex vertical gap={8}>
        <Flex justify="space-between">
          <Text type="secondary">版本</Text>
          <Text>1.0.0-preview</Text>
        </Flex>
        <Flex justify="space-between">
          <Text type="secondary">技术栈</Text>
          <Text>Electron + React + TypeScript</Text>
        </Flex>
      </Flex>
      <Divider style={{ margin: 0 }} />
      <Flex gap={16}>
        <Link href="https://github.com" target="_blank">
          <GithubOutlined /> GitHub
        </Link>
      </Flex>
    </Flex>
  )
}
