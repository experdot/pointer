import React, { useState } from 'react'
import { Flex, Avatar, Typography, Button, Divider, List, Input, App } from 'antd'
import {
  UserOutlined,
  SwapOutlined,
  LogoutOutlined,
  CheckOutlined,
  ArrowLeftOutlined,
  PlusOutlined
} from '@ant-design/icons'
import { useAccountStore, getDefaultAccountId } from '../../../stores/accountStore'
import { switchAccount, createAccount, logout } from '../../../services/accountService'

const { Text } = Typography

interface UserProfileCardProps {
  onClose: () => void
}

export function UserProfileCard({ onClose }: UserProfileCardProps): React.JSX.Element {
  const { accounts, currentAccountId } = useAccountStore()
  const currentAccount = accounts.find((a) => a.id === currentAccountId)
  const [showAccountList, setShowAccountList] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [switching, setSwitching] = useState(false)
  const { message } = App.useApp()

  const handleSwitchAccount = async (accountId: string): Promise<void> => {
    if (accountId === currentAccountId || switching) return
    setSwitching(true)
    try {
      await switchAccount(accountId)
      onClose()
    } catch {
      message.error('切换账户失败')
    } finally {
      setSwitching(false)
    }
  }

  const handleCreateAccount = async (): Promise<void> => {
    const name = newAccountName.trim()
    if (!name || switching) return
    setSwitching(true)
    try {
      const account = await createAccount(name)
      await switchAccount(account.id)
      onClose()
    } catch {
      message.error('创建账户失败')
    } finally {
      setSwitching(false)
    }
  }

  const handleLogout = async (): Promise<void> => {
    if (switching) return
    setSwitching(true)
    try {
      await logout()
      onClose()
    } catch {
      message.error('退出登录失败')
    } finally {
      setSwitching(false)
    }
  }

  if (showCreateForm) {
    return (
      <Flex vertical gap={8} style={{ width: 200 }}>
        <Flex align="center" gap={8}>
          <Button
            type="text"
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => {
              setShowCreateForm(false)
              setNewAccountName('')
            }}
          />
          <Text strong>新建账户</Text>
        </Flex>
        <Divider style={{ margin: '4px 0' }} />
        <Input
          placeholder="输入账户名称"
          value={newAccountName}
          onChange={(e) => setNewAccountName(e.target.value)}
          onPressEnter={handleCreateAccount}
          autoFocus
        />
        <Button type="primary" block onClick={handleCreateAccount} loading={switching}>
          创建并切换
        </Button>
      </Flex>
    )
  }

  if (showAccountList) {
    return (
      <Flex vertical gap={8} style={{ width: 200 }}>
        <Flex align="center" gap={8}>
          <Button
            type="text"
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => setShowAccountList(false)}
          />
          <Text strong>选择账户</Text>
        </Flex>
        <Divider style={{ margin: '4px 0' }} />
        <List
          size="small"
          dataSource={accounts}
          renderItem={(account) => (
            <List.Item
              style={{ padding: '8px', cursor: 'pointer' }}
              onClick={() => handleSwitchAccount(account.id)}
            >
              <Flex align="center" gap={8} flex={1}>
                <Avatar size={24} icon={<UserOutlined />} src={account.avatar} />
                <Text>{account.name}</Text>
                {account.id === currentAccountId && (
                  <CheckOutlined style={{ marginLeft: 'auto', color: '#1677ff' }} />
                )}
              </Flex>
            </List.Item>
          )}
        />
        <Divider style={{ margin: '4px 0' }} />
        <Button type="dashed" icon={<PlusOutlined />} block onClick={() => setShowCreateForm(true)}>
          新建账户
        </Button>
      </Flex>
    )
  }

  return (
    <Flex vertical gap={8} style={{ width: 200 }}>
      <Flex align="center" gap={12}>
        <Avatar size={40} icon={<UserOutlined />} src={currentAccount?.avatar} />
        <Flex vertical>
          <Text strong>{currentAccount?.name || '未知用户'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {accounts.length} 个账户
          </Text>
        </Flex>
      </Flex>
      <Divider style={{ margin: '8px 0' }} />
      <Button
        type="text"
        icon={<SwapOutlined />}
        block
        style={{ justifyContent: 'flex-start' }}
        onClick={() => setShowAccountList(true)}
      >
        切换账户
      </Button>
      <Button
        type="text"
        icon={<LogoutOutlined />}
        block
        style={{ justifyContent: 'flex-start' }}
        onClick={handleLogout}
        loading={switching}
        disabled={currentAccountId === getDefaultAccountId()}
      >
        退出登录
      </Button>
    </Flex>
  )
}
