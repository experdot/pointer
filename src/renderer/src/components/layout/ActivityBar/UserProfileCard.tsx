import React, { useState } from 'react'
import { Flex, Avatar, Typography, Button, Divider, List, Input, App } from 'antd'
import {
  UserOutlined,
  SwapOutlined,
  LogoutOutlined,
  CheckOutlined,
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  SmileOutlined,
  CompassOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  StarOutlined,
  HeartOutlined,
  FireOutlined,
  CrownOutlined,
  TrophyOutlined,
  BulbOutlined,
  ExperimentOutlined
} from '@ant-design/icons'
import { useAccountStore, getDefaultAccountId } from '../../../stores/accountStore'
import {
  switchAccount,
  createAccount,
  logout,
  updateAccount
} from '../../../services/accountService'
import { useSwitchTransactionStore } from '../../../stores/switchTransactionStore'

// 默认头像图标列表
const DEFAULT_AVATARS = [
  { icon: UserOutlined, key: 'user', color: '#1677ff' },
  { icon: SmileOutlined, key: 'smile', color: '#52c41a' },
  { icon: CompassOutlined, key: 'compass', color: '#722ed1' },
  { icon: RocketOutlined, key: 'rocket', color: '#fa541c' },
  { icon: ThunderboltOutlined, key: 'thunder', color: '#faad14' },
  { icon: StarOutlined, key: 'star', color: '#eb2f96' },
  { icon: HeartOutlined, key: 'heart', color: '#f5222d' },
  { icon: FireOutlined, key: 'fire', color: '#fa8c16' },
  { icon: CrownOutlined, key: 'crown', color: '#fadb14' },
  { icon: TrophyOutlined, key: 'trophy', color: '#a0d911' },
  { icon: BulbOutlined, key: 'bulb', color: '#13c2c2' },
  { icon: ExperimentOutlined, key: 'experiment', color: '#2f54eb' }
]

// 头像配置类型
type AvatarConfig = (typeof DEFAULT_AVATARS)[number]

// 根据 avatar key 获取头像配置
// eslint-disable-next-line react-refresh/only-export-components
export function getAvatarConfig(avatarKey?: string): AvatarConfig {
  return DEFAULT_AVATARS.find((a) => a.key === avatarKey) || DEFAULT_AVATARS[0]
}

const { Text } = Typography

interface UserProfileCardProps {
  onClose: () => void
}

export function UserProfileCard({ onClose }: UserProfileCardProps): React.JSX.Element {
  const { accounts, currentAccountId } = useAccountStore()
  const currentAccount = accounts.find((a) => a.id === currentAccountId)
  const [showAccountList, setShowAccountList] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [editName, setEditName] = useState('')
  const [editAvatar, setEditAvatar] = useState('')
  const [avatarHovered, setAvatarHovered] = useState(false)
  const switching = useSwitchTransactionStore((state) => state.inProgress)
  const { message } = App.useApp()

  const handleSwitchAccount = async (accountId: string): Promise<void> => {
    if (accountId === currentAccountId || switching) return
    try {
      await switchAccount(accountId)
      onClose()
    } catch {
      message.error('切换账户失败')
    }
  }

  const handleCreateAccount = async (): Promise<void> => {
    const name = newAccountName.trim()
    if (!name || switching) return
    try {
      const account = await createAccount(name)
      await switchAccount(account.id)
      onClose()
    } catch {
      message.error('创建账户失败')
    }
  }

  const handleLogout = async (): Promise<void> => {
    if (switching) return
    try {
      await logout()
      onClose()
    } catch {
      message.error('退出登录失败')
    }
  }

  const handleStartEdit = (): void => {
    setEditName(currentAccount?.name || '')
    setEditAvatar(currentAccount?.avatar || 'user')
    setShowEditForm(true)
  }

  const handleSaveEdit = async (): Promise<void> => {
    const name = editName.trim()
    if (!name || !currentAccountId || switching) return
    try {
      await updateAccount(currentAccountId, { name, avatar: editAvatar })
      setShowEditForm(false)
      setAvatarHovered(false)
      message.success('账户信息已更新')
    } catch {
      message.error('更新失败')
    }
  }

  if (showEditForm) {
    const selectedConfig = getAvatarConfig(editAvatar)
    return (
      <Flex vertical gap={8} style={{ width: 240 }}>
        <Flex align="center" gap={8}>
          <Button
            type="text"
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => {
              setShowEditForm(false)
              setAvatarHovered(false)
            }}
          />
          <Text strong>编辑账户</Text>
        </Flex>
        <Divider style={{ margin: '4px 0' }} />
        <Flex justify="center">
          <Avatar
            size={48}
            icon={<selectedConfig.icon />}
            style={{ backgroundColor: selectedConfig.color }}
          />
        </Flex>
        <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
          选择头像
        </Text>
        <Flex wrap="wrap" gap={8} justify="center">
          {DEFAULT_AVATARS.map((avatar) => (
            <Avatar
              key={avatar.key}
              size={32}
              icon={<avatar.icon />}
              style={{
                backgroundColor: avatar.color,
                cursor: 'pointer',
                border: editAvatar === avatar.key ? '2px solid #1677ff' : '2px solid transparent'
              }}
              onClick={() => setEditAvatar(avatar.key)}
            />
          ))}
        </Flex>
        <Divider style={{ margin: '4px 0' }} />
        <Input
          placeholder="输入账户名称"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onPressEnter={handleSaveEdit}
        />
        <Button type="primary" block onClick={handleSaveEdit} loading={switching}>
          保存
        </Button>
      </Flex>
    )
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
          renderItem={(account) => {
            const avatarConfig = getAvatarConfig(account.avatar)
            return (
              <List.Item
                style={{ padding: '8px', cursor: 'pointer' }}
                onClick={() => handleSwitchAccount(account.id)}
              >
                <Flex align="center" gap={8} flex={1}>
                  <Avatar
                    size={24}
                    icon={<avatarConfig.icon />}
                    style={{ backgroundColor: avatarConfig.color }}
                  />
                  <Text>{account.name}</Text>
                  {account.id === currentAccountId && (
                    <CheckOutlined style={{ marginLeft: 'auto', color: '#1677ff' }} />
                  )}
                </Flex>
              </List.Item>
            )
          }}
        />
        <Divider style={{ margin: '4px 0' }} />
        <Button type="dashed" icon={<PlusOutlined />} block onClick={() => setShowCreateForm(true)}>
          新建账户
        </Button>
      </Flex>
    )
  }

  const currentAvatarConfig = getAvatarConfig(currentAccount?.avatar)

  return (
    <Flex vertical gap={8} style={{ width: 200 }}>
      <Flex align="center" gap={12}>
        <div
          style={{ position: 'relative', cursor: 'pointer' }}
          onMouseEnter={() => setAvatarHovered(true)}
          onMouseLeave={() => setAvatarHovered(false)}
          onClick={handleStartEdit}
        >
          <Avatar
            size={40}
            icon={<currentAvatarConfig.icon />}
            style={{ backgroundColor: currentAvatarConfig.color }}
          />
          {avatarHovered && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <EditOutlined style={{ color: '#fff', fontSize: 16 }} />
            </div>
          )}
        </div>
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
