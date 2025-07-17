import React, { useState } from 'react'
import {
  Card,
  Button,
  Space,
  Modal,
  Upload,
  Typography,
  Divider,
  Popconfirm,
  App,
  Table,
  Checkbox,
  Input,
  Tag
} from 'antd'
import {
  DownloadOutlined,
  UploadOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  ImportOutlined,
  SelectOutlined
} from '@ant-design/icons'
import { useSettingsStore } from '../../stores/settingsStore'
import { usePagesStore } from '../../stores/pagesStore'

import {
  importExternalChatHistory,
  parseExternalChatHistory,
  importSelectedChats,
  SelectableChatItem
} from '../../utils/externalChatImporter'
import { PageFolder } from '../../types/type'

const { Text, Paragraph } = Typography

export default function DataManagement() {
  const { importSettings, exportSettings } = useSettingsStore()
  const { pages, folders, importPages, clearAllPages } = usePagesStore()
  const [importing, setImporting] = useState(false)
  const [importingExternal, setImportingExternal] = useState(false)
  const [selectiveImportModal, setSelectiveImportModal] = useState(false)
  const [selectableChatItems, setSelectableChatItems] = useState<SelectableChatItem[]>([])
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([])
  const [customFolderName, setCustomFolderName] = useState('')
  const { modal, message } = App.useApp()

  const handleExport = () => {
    try {
      const data = exportSettings()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = `ai-chat-settings-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      message.success('数据导出成功')
    } catch (error) {
      message.error('导出失败')
    }
  }

  const handleImport = (file: File) => {
    setImporting(true)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const parsedData = JSON.parse(content)
        importSettings(parsedData)
        message.success('数据导入成功')
      } catch (error) {
        message.error('导入失败，文件格式错误')
      } finally {
        setImporting(false)
      }
    }

    reader.onerror = () => {
      message.error('文件读取失败')
      setImporting(false)
    }

    reader.readAsText(file)
    return false // 防止自动上传
  }

  // 导入外部聊天历史（快速导入）
  const handleImportExternal = (file: File) => {
    setImportingExternal(true)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const result = importExternalChatHistory(content)

        if (result.success) {
          // 获取当前状态
          const currentChats = usePagesStore.getState().pages || []
          const currentFolders = usePagesStore.getState().folders || []

          // 创建新文件夹（如果有的话）
          let updatedFolders = currentFolders
          if (result.folder) {
            // 添加到文件夹列表
            const newFolder: PageFolder = {
              id: result.folder.id,
              name: result.folder.name,
              expanded: true,
              createdAt: Date.now(),
              order: Date.now()
            }
            updatedFolders = [...currentFolders, newFolder]
          }

          // 合并新聊天到现有聊天中
          const mergedChats = [...currentChats, ...result.pages]

          // 保存到存储并更新状态
          usePagesStore.getState().importPages(mergedChats)
          usePagesStore.getState().importFolders(updatedFolders)

          // 更新应用状态，确保保留当前的设置
          importPages(mergedChats)

          message.success(result.message)
        } else {
          message.error(result.message)
        }
      } catch (error) {
        console.error('导入外部数据失败:', error)
        message.error('导入失败，请检查文件格式是否正确')
      } finally {
        setImportingExternal(false)
      }
    }

    reader.onerror = () => {
      message.error('文件读取失败')
      setImportingExternal(false)
    }

    reader.readAsText(file)
    return false // 防止自动上传
  }

  // 选择性导入外部聊天历史
  const handleSelectiveImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const parseResult = parseExternalChatHistory(content)

        if (parseResult.success) {
          setSelectableChatItems(parseResult.pages)
          setSelectedChatIds([])
          setCustomFolderName('')
          setSelectiveImportModal(true)
        } else {
          message.error(parseResult.message)
        }
      } catch (error) {
        console.error('解析外部数据失败:', error)
        message.error('解析失败，请检查文件格式是否正确')
      }
    }

    reader.onerror = () => {
      message.error('文件读取失败')
    }

    reader.readAsText(file)
    return false // 防止自动上传
  }

  // 处理选择性导入确认
  const handleConfirmSelectiveImport = () => {
    if (selectedChatIds.length === 0) {
      message.warning('请至少选择一个聊天记录')
      return
    }

    const selectedItems = selectableChatItems.filter((item) => selectedChatIds.includes(item.id))
    const result = importSelectedChats(selectedItems, customFolderName || undefined)

    if (result.success) {
      // 获取当前状态
      const currentChats = usePagesStore.getState().pages || []
      const currentFolders = usePagesStore.getState().folders || []

      // 创建新文件夹（如果有的话）
      let updatedFolders = currentFolders
      if (result.folder) {
        // 添加到文件夹列表
        const newFolder: PageFolder = {
          id: result.folder.id,
          name: result.folder.name,
          expanded: true,
          createdAt: Date.now(),
          order: Date.now()
        }
        updatedFolders = [newFolder]
      }
      
      // 保存到存储并更新状态
      usePagesStore.getState().importPages([...result.pages])
      usePagesStore.getState().importFolders([...updatedFolders])

      message.success(result.message)
      setSelectiveImportModal(false)
    } else {
      message.error(result.message)
    }
  }

  // 表格列配置
  const columns = [
    {
      title: '选择',
      key: 'select',
      width: 60,
      render: (_: any, record: SelectableChatItem) => (
        <Checkbox
          checked={selectedChatIds.includes(record.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedChatIds([...selectedChatIds, record.id])
            } else {
              setSelectedChatIds(selectedChatIds.filter((id) => id !== record.id))
            }
          }}
        />
      )
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true
    },
    {
      title: '消息数',
      dataIndex: 'messageCount',
      key: 'messageCount',
      width: 80
    },
    {
      title: '来源',
      dataIndex: 'formatType',
      key: 'formatType',
      width: 100,
      render: (formatType: string) => (
        <Tag color={formatType === 'deepseek' ? 'blue' : 'green'}>
          {formatType === 'deepseek' ? 'DeepSeek' : 'OpenAI'}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 120,
      render: (createTime: number) => new Date(createTime).toLocaleDateString()
    }
  ]

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedChatIds(selectableChatItems.map((item) => item.id))
    } else {
      setSelectedChatIds([])
    }
  }

  const handleReset = () => {
    modal.confirm({
      title: '确认重置',
      icon: <ExclamationCircleOutlined />,
      content: '这将清除所有设置和数据，此操作不可恢复。确定要继续吗？',
      okText: '确定重置',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        try {
          // 清除localStorage中的所有数据 
          usePagesStore.getState().clearAllPages()

          message.success('数据已重置')

          // 立即重新加载页面以确保状态完全重置
          window.location.reload()
        } catch (error) {
          console.error('重置失败:', error)
          message.error('重置失败')
        }
      }
    })
  }

  const getCurrentDataSize = () => {
    try {
      const data = exportSettings()
      return `${(JSON.stringify(data).length / 1024).toFixed(2)} KB`
    } catch {
      return '计算中...'
    }
  }

  return (
    <Card size="small" title="数据管理">
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {/* 说明信息 */}
        <div style={{ marginBottom: '12px' }}>
          <Paragraph type="secondary" style={{ margin: 0, marginBottom: 4 }}>
            导出您的所有设置和聊天数据，或从备份文件中恢复数据。
          </Paragraph>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            当前数据大小: {getCurrentDataSize()}
          </Text>
        </div>

        {/* 导出数据 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '8px' }}>
            <Text strong>导出数据</Text>
          </div>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
            type="primary"
            ghost
            style={{ marginBottom: '4px' }}
          >
            导出所有数据
          </Button>
          <div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              导出包括设置、LLM配置、聊天记录等所有数据
            </Text>
          </div>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        {/* 导入数据 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '8px' }}>
            <Text strong>导入数据</Text>
          </div>
          <Upload
            accept=".json"
            showUploadList={false}
            beforeUpload={handleImport}
            disabled={importing}
          >
            <Button
              icon={<UploadOutlined />}
              loading={importing}
              type="default"
              style={{ marginBottom: '4px' }}
            >
              {importing ? '导入中...' : '选择文件导入'}
            </Button>
          </Upload>
          <div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              导入数据将覆盖当前所有设置，请确保备份重要数据
            </Text>
          </div>
        </div>

        {/* 导入外部聊天历史 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '8px' }}>
            <Text strong>导入外部聊天历史</Text>
          </div>
          <Space direction="horizontal" size="small" style={{ marginBottom: '4px' }}>
            <Upload
              accept=".json"
              showUploadList={false}
              beforeUpload={handleImportExternal}
              disabled={importingExternal}
            >
              <Button icon={<ImportOutlined />} loading={importingExternal} type="default">
                {importingExternal ? '导入中...' : '快速导入(50条限制)'}
              </Button>
            </Upload>
            <Upload accept=".json" showUploadList={false} beforeUpload={handleSelectiveImport}>
              <Button icon={<SelectOutlined />} type="primary" ghost>
                选择性导入
              </Button>
            </Upload>
          </Space>
          <div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              支持导入DeepSeek、OpenAI等平台导出的聊天历史JSON文件。快速导入最多50条记录，选择性导入可自定义选择。
            </Text>
          </div>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        {/* 重置数据 */}
        <div>
          <div style={{ marginBottom: '8px' }}>
            <Text strong>重置数据</Text>
          </div>
          <Popconfirm
            title="确认重置所有数据？"
            description="此操作将清除所有设置和聊天记录，且不可恢复"
            onConfirm={handleReset}
            okText="确认重置"
            cancelText="取消"
            okType="danger"
          >
            <Button icon={<DeleteOutlined />} danger type="default" style={{ marginBottom: '4px' }}>
              重置所有数据
            </Button>
          </Popconfirm>
          <div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              将应用恢复到初始状态，清除所有用户数据
            </Text>
          </div>
        </div>
      </Space>

      {/* 选择性导入模态框 */}
      <Modal
        title="选择要导入的聊天记录"
        open={selectiveImportModal}
        onCancel={() => setSelectiveImportModal(false)}
        width={800}
        style={{ top: 20 }}
        bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
        footer={[
          <Button key="cancel" onClick={() => setSelectiveImportModal(false)}>
            取消
          </Button>,
          <Button
            key="import"
            type="primary"
            onClick={handleConfirmSelectiveImport}
            disabled={selectedChatIds.length === 0}
          >
            导入选中的 {selectedChatIds.length} 项
          </Button>
        ]}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* 文件夹名称输入 */}
          <div>
            <Text strong style={{ marginBottom: '8px', display: 'block' }}>
              导入文件夹名称（可选）
            </Text>
            <Input
              placeholder="留空将自动生成文件夹名称"
              value={customFolderName}
              onChange={(e) => setCustomFolderName(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          {/* 全选操作 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Checkbox
                indeterminate={
                  selectedChatIds.length > 0 && selectedChatIds.length < selectableChatItems.length
                }
                checked={selectedChatIds.length === selectableChatItems.length}
                onChange={(e) => handleSelectAll(e.target.checked)}
              >
                全选
              </Checkbox>
              <Text type="secondary">
                共 {selectableChatItems.length} 个聊天记录，已选择 {selectedChatIds.length} 个
              </Text>
            </Space>
          </div>

          {/* 聊天记录表格 */}
          <div style={{ height: '50vh', display: 'flex', flexDirection: 'column' }}>
            <Table
              columns={columns}
              dataSource={selectableChatItems}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                pageSizeOptions: ['10', '20', '50']
              }}
              size="small"
              scroll={{ y: 'calc(50vh - 120px)' }}
            />
          </div>
        </Space>
      </Modal>
    </Card>
  )
}
