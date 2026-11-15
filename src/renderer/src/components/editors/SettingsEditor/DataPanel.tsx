import { t, useI18n } from '@renderer/i18n'
import React, { useState } from 'react'
import { Button, Flex, Typography, Space, Divider } from 'antd'
import {
  ExportOutlined,
  ImportOutlined,
  DeleteOutlined,
  CloudDownloadOutlined
} from '@ant-design/icons'
import { ExportModal } from './ExportModal'
import { ImportModal } from './ImportModal'
import { ThirdPartyImportModal } from './ThirdPartyImportModal'
import { ResetModal } from './ResetModal'

const { Text } = Typography

export function DataPanel(): React.JSX.Element {
  useI18n()

  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [thirdPartyImportOpen, setThirdPartyImportOpen] = useState(false)
  const [resetModalOpen, setResetModalOpen] = useState(false)

  return (
    <Flex vertical gap={24}>
      <div>
        <Text strong style={{ fontSize: 16 }}>
          {t('data.title')}
        </Text>
        <br />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('data.description')}
        </Text>
      </div>

      <Space size="middle">
        <Button icon={<ExportOutlined />} onClick={() => setExportModalOpen(true)}>
          {t('data.export')}
        </Button>
        <Button icon={<ImportOutlined />} onClick={() => setImportModalOpen(true)}>
          {t('data.import')}
        </Button>
        <Button danger icon={<DeleteOutlined />} onClick={() => setResetModalOpen(true)}>
          {t('data.reset')}
        </Button>
      </Space>

      <Divider style={{ margin: '8px 0' }} />

      <div>
        <Text strong style={{ fontSize: 16 }}>
          {t('data.thirdPartyTitle')}
        </Text>
        <br />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('data.thirdPartyDescription')}
        </Text>
      </div>

      <Space>
        <Button icon={<CloudDownloadOutlined />} onClick={() => setThirdPartyImportOpen(true)}>
          {t('data.thirdPartyImport')}
        </Button>
      </Space>

      <ExportModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} />
      <ImportModal open={importModalOpen} onClose={() => setImportModalOpen(false)} />
      <ThirdPartyImportModal
        open={thirdPartyImportOpen}
        onClose={() => setThirdPartyImportOpen(false)}
      />
      <ResetModal open={resetModalOpen} onClose={() => setResetModalOpen(false)} />
    </Flex>
  )
}
