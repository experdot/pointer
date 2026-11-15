import { t, useI18n } from '@renderer/i18n'
import React, { useState } from 'react'
import { App, Modal, Checkbox, Space, Typography, Alert } from 'antd'
import { command } from '../../../runtime/client'
import { useViewStateStore } from '../../../stores/viewStateStore'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { useSettingsStore } from '../../../stores/settingsStore'

const { Text } = Typography

interface ResetModalProps {
  open: boolean
  onClose: () => void
}

type ResetType = 'conversations' | 'folders' | 'tabs' | 'settings' | 'layout'

const RESET_OPTIONS: Array<{ value: ResetType; label: string; description: string }> = [
  {
    value: 'conversations',
    get label(): string {
      return t('reset.conversations')
    },
    get description(): string {
      return t('reset.conversationsHelp')
    }
  },
  {
    value: 'folders',
    get label(): string {
      return t('common.folders')
    },
    get description(): string {
      return t('reset.foldersHelp')
    }
  },
  {
    value: 'tabs',
    get label(): string {
      return t('reset.tabs')
    },
    get description(): string {
      return t('reset.tabsHelp')
    }
  },
  {
    value: 'settings',
    get label(): string {
      return t('reset.settings')
    },
    get description(): string {
      return t('reset.settingsHelp')
    }
  },
  {
    value: 'layout',
    get label(): string {
      return t('reset.layout')
    },
    get description(): string {
      return t('reset.layoutHelp')
    }
  }
]

export function ResetModal({ open, onClose }: ResetModalProps): React.JSX.Element {
  useI18n()

  const [selected, setSelected] = useState<ResetType[]>([])
  const [resetting, setResetting] = useState(false)
  const { message } = App.useApp()

  const handleReset = async (): Promise<void> => {
    setResetting(true)
    try {
      await useSettingsStore.getState().flush()
      await useViewStateStore.getState().flush()
      await command('data.reset', { targets: selected })
      setSelected([])
      onClose()
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error))
    } finally {
      setResetting(false)
    }
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
      title={t('data.reset')}
      open={open}
      onCancel={handleClose}
      onOk={handleReset}
      confirmLoading={resetting}
      okText={t('reset.confirm')}
      okType="danger"
      okButtonProps={{ disabled: selected.length === 0 }}
      cancelText={t('common.cancel')}
      width={480}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message={t('reset.irreversible')}
          description={t('reset.warning')}
        />

        <div>
          <Checkbox
            checked={selected.length === RESET_OPTIONS.length}
            indeterminate={selected.length > 0 && selected.length < RESET_OPTIONS.length}
            onChange={handleSelectAll}
            style={{ marginBottom: 8 }}
          >
            <Text strong>{t('common.selectAll')}</Text>
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
