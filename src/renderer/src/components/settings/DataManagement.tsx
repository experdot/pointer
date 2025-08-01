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
import { clearAllStores } from '../../stores/useAppStores'
import { clearStoreState } from '../../stores/persistence/storeConfig'
import { useMessagesStore } from '../../stores/messagesStore'

import {
  importExternalChatHistory,
  parseExternalChatHistory,
  importSelectedChats,
  SelectableChatItem
} from '../../utils/externalChatImporter/index'
import { PageFolder } from '../../types/type'

const { Text, Paragraph } = Typography

export default function DataManagement() {
  const { importSettings, exportSettings } = useSettingsStore()
  const { pages, folders, importPages, importFolders, clearAllPages } = usePagesStore()
  const [importing, setImporting] = useState(false)
  const [importingExternal, setImportingExternal] = useState(false)
  const [selectiveImportModal, setSelectiveImportModal] = useState(false)
  const [selectableChatItems, setSelectableChatItems] = useState<SelectableChatItem[]>([])
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([])
  const [customFolderName, setCustomFolderName] = useState('')
  const { modal, message } = App.useApp()

  // 生成精确到秒的时间戳用于文件名
  const getTimestamp = () => {
    const now = new Date()
    return now.toISOString().replace(/[:.]/g, '-').slice(0, -5) // 移除毫秒和Z，替换冒号和点号
  }

  // 导出所有数据
  const handleExportAll = () => {
    try {
      const settings = exportSettings()
      const allData = {
        type: 'all-data',
        settings,
        pages,
        folders,
        version: '1.0.0',
        exportTime: Date.now()
      }
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = `ai-chat-all-data-${getTimestamp()}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      message.success('所有数据导出成功')
    } catch (error) {
      message.error('导出失败')
    }
  }

  // 单独导出设置
  const handleExportSettings = () => {
    try {
      const settings = exportSettings()
      const settingsData = {
        type: 'settings-only',
        settings,
        version: '1.0.0',
        exportTime: Date.now()
      }
      const blob = new Blob([JSON.stringify(settingsData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = `ai-chat-settings-${getTimestamp()}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      message.success('设置数据导出成功')
    } catch (error) {
      message.error('设置导出失败')
    }
  }

  // 单独导出聊天记录
  const handleExportChats = () => {
    try {
      const chatsData = {
        type: 'chats-only',
        pages,
        folders,
        version: '1.0.0',
        exportTime: Date.now()
      }
      const blob = new Blob([JSON.stringify(chatsData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = `ai-chat-history-${getTimestamp()}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      message.success('聊天记录导出成功')
    } catch (error) {
      message.error('聊天记录导出失败')
    }
  }

  const handleImport = (file: File) => {
    setImporting(true)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const parsedData = JSON.parse(content)

        // 根据文件类型进行不同的处理
        if (parsedData.type === 'all-data') {
          // 完整数据导出
          importSettings(parsedData.settings)

          if (parsedData.pages && parsedData.pages.length > 0) {
            importPages(parsedData.pages)
          }

          if (parsedData.folders && parsedData.folders.length > 0) {
            importFolders(parsedData.folders)
          }

          message.success('所有数据导入成功（包含设置和聊天历史）')
        } else if (parsedData.type === 'settings-only') {
          // 只有设置数据
          importSettings(parsedData.settings)
          message.success('设置数据导入成功')
        } else if (parsedData.type === 'chats-only') {
          // 只有聊天记录数据
          if (parsedData.pages && parsedData.pages.length > 0) {
            importPages(parsedData.pages)
          }

          if (parsedData.folders && parsedData.folders.length > 0) {
            importFolders(parsedData.folders)
          }

          message.success('聊天记录导入成功')
        } else if (
          parsedData.settings &&
          parsedData.pages !== undefined &&
          parsedData.folders !== undefined
        ) {
          // 兼容旧版本的完整数据格式（没有type字段）
          importSettings(parsedData.settings)

          if (parsedData.pages && parsedData.pages.length > 0) {
            importPages(parsedData.pages)
          }

          if (parsedData.folders && parsedData.folders.length > 0) {
            importFolders(parsedData.folders)
          }

          message.success('数据导入成功（包含设置和聊天历史）')
        } else {
          // 假设是旧格式的纯设置数据
          importSettings(parsedData)
          message.success('设置数据导入成功')
        }
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

  // 重置所有数据
  const handleResetAll = () => {
    modal.confirm({
      title: '确认重置所有数据',
      icon: <ExclamationCircleOutlined />,
      content: '这将清除所有设置和聊天数据，此操作不可恢复。确定要继续吗？',
      okText: '确定重置',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          // 第一步：清除内存中的所有存储状态
          clearAllStores()

          // 第二步：清除 messagesStore 中的流式消息状态
          useMessagesStore.setState({ streamingMessages: {} })

          // 第三步：清除 IndexedDB 中的所有持久化数据
          await Promise.all([
            clearStoreState('settings-store'),
            clearStoreState('messages-store'),
            clearStoreState('search-store'),
            clearStoreState('tabs-store'),
            clearStoreState('ui-store'),
            clearStoreState('object-store'),
            clearStoreState('crosstab-store'),
            clearStoreState('ai-tasks-store')
            // pages 和 folders 已经在 clearAllPages() 中处理了
          ])

          message.success('所有数据已重置')
        } catch (error) {
          console.error('重置失败:', error)
          message.error('重置失败')
        }
      }
    })
  }

  // 单独清空聊天记录
  const handleResetChats = () => {
    modal.confirm({
      title: '确认清空聊天记录',
      icon: <ExclamationCircleOutlined />,
      content: '这将清除所有聊天历史和文件夹，但保留您的设置配置。此操作不可恢复，确定要继续吗？',
      okText: '确定清空',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          // 清除聊天相关的存储
          clearAllPages()

          // 清除相关的持久化数据
          await Promise.all([
            clearStoreState('messages-store'),
            clearStoreState('search-store'),
            clearStoreState('tabs-store'),
            clearStoreState('ui-store')
          ])

          // 重置消息存储的流式消息状态
          useMessagesStore.setState({ streamingMessages: {} })

          message.success('聊天记录已清空')
        } catch (error) {
          console.error('清空聊天记录失败:', error)
          message.error('清空聊天记录失败')
        }
      }
    })
  }

  // 单独重置设置
  const handleResetSettings = () => {
    modal.confirm({
      title: '确认重置设置',
      icon: <ExclamationCircleOutlined />,
      content:
        '这将重置所有LLM配置、模型配置和应用设置，但保留您的聊天记录。此操作不可恢复，确定要继续吗？',
      okText: '确定重置',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          // 重置设置存储
          const { resetSettings } = useSettingsStore.getState()
          resetSettings()

          // 清除设置相关的持久化数据
          await clearStoreState('settings-store')

          message.success('设置已重置')
        } catch (error) {
          console.error('重置设置失败:', error)
          message.error('重置设置失败')
        }
      }
    })
  }

  const getCurrentDataSize = () => {
    try {
      const settings = exportSettings()
      const allData = {
        type: 'all-data',
        settings,
        pages,
        folders,
        version: '1.0.0',
        exportTime: Date.now()
      }
      const settingsSize = (
        JSON.stringify({ type: 'settings-only', settings, version: '1.0.0' }).length / 1024
      ).toFixed(2)
      const chatsSize = (
        JSON.stringify({ type: 'chats-only', pages, folders, version: '1.0.0' }).length / 1024
      ).toFixed(2)
      const totalSize = (JSON.stringify(allData).length / 1024).toFixed(2)

      return `总计: ${totalSize} KB (设置: ${settingsSize} KB, 聊天: ${chatsSize} KB)`
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
          <Space direction="horizontal" size="small" wrap style={{ marginBottom: '4px' }}>
            <Button icon={<DownloadOutlined />} onClick={handleExportAll} type="primary" ghost>
              导出所有数据
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExportSettings} type="default">
              仅导出设置
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExportChats} type="default">
              仅导出聊天记录
            </Button>
          </Space>
          <div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              您可以选择导出所有数据，或者分别导出设置和聊天记录
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
              支持导入完整数据文件、设置文件或聊天记录文件，系统会自动识别文件类型进行相应处理
            </Text>
          </div>
        </div>

        {/* 导入外部聊天历史 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '8px' }}>
            <Text strong>导入外部聊天历史</Text>
          </div>
          <Space direction="horizontal" size="small" style={{ marginBottom: '4px' }}>
          <Upload accept=".json" showUploadList={false} beforeUpload={handleSelectiveImport}>
              <Button icon={<SelectOutlined />} type="primary" ghost>
                选择性导入
              </Button>
            </Upload>
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
          <Space direction="horizontal" size="small" wrap style={{ marginBottom: '4px' }}>
            <Button icon={<DeleteOutlined />} danger type="default" onClick={handleResetAll}>
              重置所有数据
            </Button>
            <Button icon={<DeleteOutlined />} danger type="default" onClick={handleResetSettings}>
              仅清空设置
            </Button>
            <Button icon={<DeleteOutlined />} danger type="default" onClick={handleResetChats}>
              仅清空聊天记录
            </Button>
          </Space>
          <div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              您可以选择重置所有数据，或者分别清空聊天记录、重置设置配置
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
