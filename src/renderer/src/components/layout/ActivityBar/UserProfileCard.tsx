import { t, useI18n } from '@renderer/i18n'
import type { Account } from '@shared/domain'
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
import { useSavedAction } from '../../../hooks/useSavedAction'
import {
  switchAccount,
  createAccount,
  logout,
  updateAccount
} from '../../../services/accountService'

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

function getAccountName(account: Account): string {
  return account.usesDefaultName ? t('defaults.account') : account.name
}

interface UserProfileCardProps {
  onClose: () => void
}

export function UserProfileCard({ onClose }: UserProfileCardProps): React.JSX.Element {
  useI18n()

  const { accounts, currentAccountId } = useAccountStore()
  const currentAccount = accounts.find((a) => a.id === currentAccountId)
  const [showAccountList, setShowAccountList] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [editName, setEditName] = useState('')
  const [initialEditName, setInitialEditName] = useState('')
  const [editAvatar, setEditAvatar] = useState('')
  const [avatarHovered, setAvatarHovered] = useState(false)
  const [switching, setSwitching] = useState(false)
  const { message } = App.useApp()
  const runSaved = useSavedAction()

  const handleSwitchAccount = async (accountId: string): Promise<void> => {
    if (accountId === currentAccountId || switching) return
    setSwitching(true)
    try {
      if (await runSaved(() => switchAccount(accountId))) onClose()
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('account.switchFailed'))
    } finally {
      setSwitching(false)
    }
  }

  const handleCreateAccount = async (): Promise<void> => {
    const name = newAccountName.trim()
    if (!name || switching) return
    setSwitching(true)
    try {
      if (await runSaved(() => createAccount(name))) onClose()
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('account.createFailed'))
    } finally {
      setSwitching(false)
    }
  }

  const handleLogout = async (): Promise<void> => {
    if (switching) return
    setSwitching(true)
    try {
      if (await runSaved(logout)) onClose()
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('account.signOutFailed'))
    } finally {
      setSwitching(false)
    }
  }

  const handleStartEdit = (): void => {
    const name = currentAccount ? getAccountName(currentAccount) : ''
    setEditName(name)
    setInitialEditName(name)
    setEditAvatar(currentAccount?.avatar || 'user')
    setShowEditForm(true)
  }

  const handleSaveEdit = async (): Promise<void> => {
    const name = editName.trim()
    if (!name || !currentAccountId || switching) return
    setSwitching(true)
    try {
      await updateAccount(currentAccountId, {
        ...(name !== initialEditName ? { name } : {}),
        avatar: editAvatar
      })
      setShowEditForm(false)
      setAvatarHovered(false)
      message.success(t('account.updated'))
    } catch {
      message.error(t('update.failed'))
    } finally {
      setSwitching(false)
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
          <Text strong>{t('account.edit')}</Text>
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
          {t('account.selectAvatar')}
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
          placeholder={t('account.namePlaceholder')}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onPressEnter={handleSaveEdit}
        />
        <Button type="primary" block onClick={handleSaveEdit} loading={switching}>
          {t('common.save')}
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
          <Text strong>{t('account.create')}</Text>
        </Flex>
        <Divider style={{ margin: '4px 0' }} />
        <Input
          placeholder={t('account.namePlaceholder')}
          value={newAccountName}
          onChange={(e) => setNewAccountName(e.target.value)}
          onPressEnter={handleCreateAccount}
          autoFocus
        />
        <Button type="primary" block onClick={handleCreateAccount} loading={switching}>
          {t('account.createSwitch')}
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
          <Text strong>{t('account.select')}</Text>
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
                  <Text>{getAccountName(account)}</Text>
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
          {t('account.create')}
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
          <Text strong>
            {currentAccount ? getAccountName(currentAccount) : t('account.unknown')}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('account.count', { count: accounts.length })}
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
        {t('account.switch')}
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
        {t('account.signOut')}
      </Button>
    </Flex>
  )
}
