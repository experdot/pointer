import React, { useState } from 'react'
import { Button, Flex, Typography, Space, Divider } from 'antd'
import { ExportOutlined, ImportOutlined, DeleteOutlined, CloudDownloadOutlined } from '@ant-design/icons'
import { ExportModal } from './ExportModal'
import { ImportModal } from './ImportModal'
import { ThirdPartyImportModal } from './ThirdPartyImportModal'
import { ResetModal } from './ResetModal'

const { Text } = Typography

export function DataPanel(): React.JSX.Element {
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [thirdPartyImportOpen, setThirdPartyImportOpen] = useState(false)
  const [resetModalOpen, setResetModalOpen] = useState(false)

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
        <Button danger icon={<DeleteOutlined />} onClick={() => setResetModalOpen(true)}>
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
      <ResetModal open={resetModalOpen} onClose={() => setResetModalOpen(false)} />
    </Flex>
  )
}
