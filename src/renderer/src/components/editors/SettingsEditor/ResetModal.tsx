import React, { useState } from 'react'
import { Modal, Checkbox, Space, Typography, Alert } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { useSettingsStore } from '../../../stores/settingsStore'
import { usePagesStore } from '../../../stores/pagesStore'
import { useFoldersStore } from '../../../stores/foldersStore'
import { useMessagesStore } from '../../../stores/messagesStore'
import { useTabsStore } from '../../../stores/tabsStore'
import { useLayoutStore } from '../../../stores/layoutStore'

const { Text } = Typography

interface ResetModalProps {
  open: boolean
  onClose: () => void
}

type ResetType = 'conversations' | 'folders' | 'tabs' | 'settings' | 'layout'

const RESET_OPTIONS: Array<{ value: ResetType; label: string; description: string }> = [
  {
    value: 'conversations',
    label: '对话数据',
    description: '所有聊天对话和消息记录'
  },
  {
    value: 'folders',
    label: '文件夹',
    description: '对话的文件夹组织结构'
  },
  {
    value: 'tabs',
    label: '标签页状态',
    description: '当前打开的标签页'
  },
  {
    value: 'settings',
    label: '应用设置',
    description: 'API 密钥、模型配置、主题等设置'
  },
  {
    value: 'layout',
    label: '界面布局',
    description: '侧边栏宽度、面板状态等布局信息'
  }
]

export function ResetModal({ open, onClose }: ResetModalProps): React.JSX.Element {
  const [selected, setSelected] = useState<ResetType[]>([])

  const handleReset = async (): Promise<void> => {
    if (selected.includes('conversations')) {
      await usePagesStore.getState().reset()
      useMessagesStore.getState().reset()
    }
    if (selected.includes('folders')) {
      await useFoldersStore.getState().reset()
    }
    if (selected.includes('tabs')) {
      await useTabsStore.getState().reset()
    }
    if (selected.includes('settings')) {
      await useSettingsStore.getState().reset()
    }
    if (selected.includes('layout')) {
      await useLayoutStore.getState().reset()
    }

    setSelected([])
    onClose()
  }

  const handleClose = (): void => {
    setSelected([])
    onClose()
  }

  const handleSelectAll = (): void => {
    if (selected.length === RESET_OPTIONS.length) {
      setSelected([])
    } else {
      setSelected(RESET_OPTIONS.map((o) => o.value))
    }
  }

  return (
    <Modal
      title="重置数据"
      open={open}
      onCancel={handleClose}
      onOk={handleReset}
      okText="确定重置"
      okType="danger"
      okButtonProps={{ disabled: selected.length === 0 }}
      cancelText="取消"
      width={480}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message="此操作无法恢复"
          description="选中的数据将被永久删除，请谨慎操作。"
        />

        <div>
          <Checkbox
            checked={selected.length === RESET_OPTIONS.length}
            indeterminate={selected.length > 0 && selected.length < RESET_OPTIONS.length}
            onChange={handleSelectAll}
            style={{ marginBottom: 8 }}
          >
            <Text strong>全选</Text>
          </Checkbox>

          <Checkbox.Group
            value={selected}
            onChange={(values) => setSelected(values as ResetType[])}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%', paddingLeft: 24 }}>
              {RESET_OPTIONS.map((option) => (
                <Checkbox key={option.value} value={option.value}>
                  <Space direction="vertical" size={0}>
                    <Text>{option.label}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {option.description}
                    </Text>
                  </Space>
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
        </div>
      </Space>
    </Modal>
  )
}
