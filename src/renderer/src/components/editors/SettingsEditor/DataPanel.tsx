import React, { useState } from 'react'
import { Button, Flex, Typography, App, Space, Divider } from 'antd'
import {
  ExclamationCircleOutlined,
  ExportOutlined,
  ImportOutlined,
  DeleteOutlined,
  CloudDownloadOutlined
} from '@ant-design/icons'
import { useSettingsStore } from '../../../stores/settingsStore'
import { usePagesStore } from '../../../stores/pagesStore'
import { useFoldersStore } from '../../../stores/foldersStore'
import { useMessagesStore } from '../../../stores/messagesStore'
import { useTabsStore } from '../../../stores/tabsStore'
import { useLayoutStore } from '../../../stores/layoutStore'
import { ExportModal } from './ExportModal'
import { ImportModal } from './ImportModal'
import { ThirdPartyImportModal } from './ThirdPartyImportModal'

const { Text } = Typography

export function DataPanel(): React.JSX.Element {
  const { modal } = App.useApp()
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [thirdPartyImportOpen, setThirdPartyImportOpen] = useState(false)

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
        useFoldersStore.getState().reset()
        useMessagesStore.getState().reset()
        useTabsStore.getState().reset()
        useSettingsStore.getState().reset()
        useLayoutStore.getState().reset()
      }
    })
  }

  return (
    <Flex vertical gap={24}>
      <div>
        <Text strong style={{ fontSize: 16 }}>
          数据管理
        </Text>
        <br />
        <Text type="secondary">导入、导出或重置应用数据</Text>
      </div>

      <Space size="middle">
        <Button icon={<ExportOutlined />} onClick={() => setExportModalOpen(true)}>
          导出数据
        </Button>
        <Button icon={<ImportOutlined />} onClick={() => setImportModalOpen(true)}>
          导入数据
        </Button>
        <Button danger icon={<DeleteOutlined />} onClick={handleResetAll}>
          重置数据
        </Button>
      </Space>

      <Divider style={{ margin: '8px 0' }} />

      <div>
        <Text strong style={{ fontSize: 16 }}>
          第三方数据导入
        </Text>
        <br />
        <Text type="secondary">从其他平台导入聊天记录（支持 OpenAI、DeepSeek 等）</Text>
      </div>

      <Space>
        <Button icon={<CloudDownloadOutlined />} onClick={() => setThirdPartyImportOpen(true)}>
          导入第三方数据
        </Button>
      </Space>

      <ExportModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} />
      <ImportModal open={importModalOpen} onClose={() => setImportModalOpen(false)} />
      <ThirdPartyImportModal
        open={thirdPartyImportOpen}
        onClose={() => setThirdPartyImportOpen(false)}
      />
    </Flex>
  )
}
