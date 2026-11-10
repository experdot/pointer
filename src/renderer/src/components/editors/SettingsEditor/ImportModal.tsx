import React, { useState, useMemo, useCallback } from 'react'
import {
  Modal,
  Tabs,
  Tree,
  Checkbox,
  Button,
  Space,
  Typography,
  App,
  Flex,
  Upload,
  Radio,
  Alert
} from 'antd'
import { InboxOutlined, WarningOutlined } from '@ant-design/icons'
import type { TreeDataNode, UploadFile } from 'antd'
import type { ExportData } from './ExportModal'
import { DateTimeText } from '../../common/DateTimeText'
import { usePagesStore } from '../../../stores/pagesStore'
import { useFoldersStore } from '../../../stores/foldersStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { command } from '../../../runtime/client'
import { useViewStateStore } from '../../../stores/viewStateStore'
import type { BackupRestoreResult } from '@shared/contracts'
import type { ConfigTree, LLMConfig, ModelConfig } from '@renderer/types/shared'
import {
  buildConfigTreeNodes,
  buildPageTreeNodes,
  type NodeDecorator
} from '../../../utils/treeNodes'

const { Text } = Typography

/** 导入数据与本机数据存在同 id 时的标记 */
function ConflictBadge(): React.JSX.Element {
  return (
    <Text type="warning" style={{ marginLeft: 8 }}>
      <WarningOutlined /> ID冲突
    </Text>
  )
}

const { Dragger } = Upload

interface ImportModalProps {
  open: boolean
  onClose: () => void
}

type TabKey = 'chats' | 'llm' | 'model' | 'ui'
type ConflictStrategy = 'generate-new' | 'skip' | 'overwrite'

export function ImportModal({ open, onClose }: ImportModalProps): React.JSX.Element {
  const { message } = App.useApp()
  const existingPages = usePagesStore((s) => s.pages)
  const existingFolders = useFoldersStore((s) => s.folders)
  const existingSettings = useSettingsStore((s) => s.settings)

  const [importData, setImportData] = useState<ExportData | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('chats')
  const [importing, setImporting] = useState(false)
  const [restoreResult, setRestoreResult] = useState<BackupRestoreResult | null>(null)
  const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>('generate-new')

  // 各 Tab 的选中状态
  const [checkedChats, setCheckedChats] = useState<React.Key[]>([])
  const [checkedLLM, setCheckedLLM] = useState<React.Key[]>([])
  const [checkedModel, setCheckedModel] = useState<React.Key[]>([])
  const [includeUI, setIncludeUI] = useState(false)

  // 现有数据的 ID 集合
  const existingPageIds = useMemo(() => new Set(existingPages.map((p) => p.id)), [existingPages])
  const existingFolderIds = useMemo(
    () => new Set(existingFolders.map((f) => f.id)),
    [existingFolders]
  )
  const existingLLMIds = useMemo(
    () => new Set(existingSettings.llmConfigs.items.map((i) => i.id)),
    [existingSettings]
  )
  const existingLLMFolderIds = useMemo(
    () => new Set(existingSettings.llmConfigs.folders.map((f) => f.id)),
    [existingSettings]
  )
  const existingModelIds = useMemo(
    () => new Set(existingSettings.modelConfigs.items.map((i) => i.id)),
    [existingSettings]
  )
  const existingModelFolderIds = useMemo(
    () => new Set(existingSettings.modelConfigs.folders.map((f) => f.id)),
    [existingSettings]
  )

  // 冲突标记：文件夹与条目分别对应各自的 id 集合
  const decorateChats = useCallback<NodeDecorator>(
    ({ kind, id }) =>
      (kind === 'folder' ? existingFolderIds : existingPageIds).has(id) ? <ConflictBadge /> : null,
    [existingFolderIds, existingPageIds]
  )
  const decorateLLM = useCallback<NodeDecorator>(
    ({ kind, id }) =>
      (kind === 'folder' ? existingLLMFolderIds : existingLLMIds).has(id) ? (
        <ConflictBadge />
      ) : null,
    [existingLLMFolderIds, existingLLMIds]
  )
  const decorateModel = useCallback<NodeDecorator>(
    ({ kind, id }) =>
      (kind === 'folder' ? existingModelFolderIds : existingModelIds).has(id) ? (
        <ConflictBadge />
      ) : null,
    [existingModelFolderIds, existingModelIds]
  )

  // 构建树数据
  const chatsTree = useMemo(() => {
    if (!importData?.data.pages) return []
    return buildPageTreeNodes(importData.data.pages, importData.data.folders || [], decorateChats)
  }, [importData, decorateChats])

  const llmTree = useMemo(() => {
    if (!importData?.data.settings?.llmConfigs) return []
    return buildConfigTreeNodes(
      importData.data.settings.llmConfigs as ConfigTree<LLMConfig>,
      (item: LLMConfig) => item.name,
      decorateLLM
    )
  }, [importData, decorateLLM])

  const modelTree = useMemo(() => {
    if (!importData?.data.settings?.modelConfigs) return []
    return buildConfigTreeNodes(
      importData.data.settings.modelConfigs as ConfigTree<ModelConfig>,
      (item: ModelConfig) => item.name,
      decorateModel
    )
  }, [importData, decorateModel])

  // 获取所有 keys
  const getAllKeys = useCallback((tree: TreeDataNode[]): React.Key[] => {
    const keys: React.Key[] = []
    const traverse = (nodes: TreeDataNode[]): void => {
      nodes.forEach((node) => {
        keys.push(node.key)
        if (node.children) {
          traverse(node.children)
        }
      })
    }
    traverse(tree)
    return keys
  }, [])

  // 文件上传处理
  const handleFileUpload = async (file: UploadFile): Promise<boolean> => {
    try {
      const text = await (file as unknown as File).text()
      const data = JSON.parse(text) as ExportData

      if (!data.version || !data.data) {
        message.error('无效的导入文件格式')
        return false
      }

      setImportData(data)
      setRestoreResult(null)

      // 初始化选中状态（全选）
      setTimeout(() => {
        if (data.data.pages) {
          const tree = buildPageTreeNodes(data.data.pages, data.data.folders || [], decorateChats)
          setCheckedChats(getAllKeys(tree))
        }
        if (data.data.settings?.llmConfigs) {
          const tree = buildConfigTreeNodes(
            data.data.settings.llmConfigs as ConfigTree<LLMConfig>,
            (item: LLMConfig) => item.name,
            decorateLLM
          )
          setCheckedLLM(getAllKeys(tree))
        }
        if (data.data.settings?.modelConfigs) {
          const tree = buildConfigTreeNodes(
            data.data.settings.modelConfigs as ConfigTree<ModelConfig>,
            (item: ModelConfig) => item.name,
            decorateModel
          )
          setCheckedModel(getAllKeys(tree))
        }
        setIncludeUI(Boolean(data.data.viewState))
      }, 0)

      return false
    } catch {
      message.error('文件解析失败')
      return false
    }
  }

  // 全选/取消全选
  const handleSelectAll = (tab: TabKey, checked: boolean): void => {
    switch (tab) {
      case 'chats':
        setCheckedChats(checked ? getAllKeys(chatsTree) : [])
        break
      case 'llm':
        setCheckedLLM(checked ? getAllKeys(llmTree) : [])
        break
      case 'model':
        setCheckedModel(checked ? getAllKeys(modelTree) : [])
        break
    }
  }

  // 统计选中数量
  const getStats = useCallback(() => {
    const pageIds = checkedChats
      .filter((k) => String(k).startsWith('page:'))
      .map((k) => String(k).replace('page:', ''))
    const folderIds = checkedChats
      .filter((k) => String(k).startsWith('folder:'))
      .map((k) => String(k).replace('folder:', ''))
    const llmIds = checkedLLM
      .filter((k) => String(k).startsWith('item:'))
      .map((k) => String(k).replace('item:', ''))
    const modelIds = checkedModel
      .filter((k) => String(k).startsWith('item:'))
      .map((k) => String(k).replace('item:', ''))

    return { pageIds, folderIds, llmIds, modelIds }
  }, [checkedChats, checkedLLM, checkedModel])

  const stats = getStats()
  const hasSelection =
    checkedChats.length > 0 || checkedLLM.length > 0 || checkedModel.length > 0 || includeUI

  const handleImport = async (): Promise<void> => {
    if (!importData || restoreResult) return
    setImporting(true)
    try {
      await useSettingsStore.getState().flush()
      await useViewStateStore.getState().flush()
      const folderIds = (keys: React.Key[]): string[] =>
        keys
          .map(String)
          .filter((key) => key.startsWith('folder:'))
          .map((key) => key.slice(7))
      const result = await command('backup.restore', {
        backup: importData,
        selection: {
          pages: stats.pageIds,
          folders: stats.folderIds,
          llm: stats.llmIds,
          llmFolders: folderIds(checkedLLM),
          models: stats.modelIds,
          modelFolders: folderIds(checkedModel),
          ui: includeUI
        },
        strategy: conflictStrategy
      })
      setRestoreResult(result)
      if (!result.error) message.success('导入完成')
    } catch (error) {
      message.error('导入失败：' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setImporting(false)
    }
  }

  const handleClose = (): void => {
    setImportData(null)
    setRestoreResult(null)
    setCheckedChats([])
    setCheckedLLM([])
    setCheckedModel([])
    setIncludeUI(false)
    setConflictStrategy('generate-new')
    onClose()
  }

  const renderTree = (
    tree: TreeDataNode[],
    checked: React.Key[],
    setChecked: (keys: React.Key[]) => void,
    tab: TabKey
  ): React.ReactNode => {
    const allKeys = getAllKeys(tree)
    const isAllChecked = allKeys.length > 0 && allKeys.every((k) => checked.includes(k))
    const isIndeterminate = !isAllChecked && checked.length > 0

    return (
      <Flex vertical gap={8} style={{ height: 280, overflow: 'auto' }}>
        <Checkbox
          checked={isAllChecked}
          indeterminate={isIndeterminate}
          onChange={(e) => handleSelectAll(tab, e.target.checked)}
        >
          全选 / 取消全选
        </Checkbox>
        {tree.length > 0 ? (
          <Tree
            checkable
            showIcon
            defaultExpandAll
            checkedKeys={checked}
            onCheck={(keys) => setChecked(keys as React.Key[])}
            treeData={tree}
          />
        ) : (
          <Text type="secondary">无数据</Text>
        )}
      </Flex>
    )
  }

  // 上传界面
  if (!importData) {
    return (
      <Modal title="导入数据" open={open} onCancel={handleClose} footer={null} width={500}>
        <Dragger
          accept=".json"
          showUploadList={false}
          beforeUpload={handleFileUpload}
          style={{ padding: 12 }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此处</p>
          <p className="ant-upload-hint">支持 .json 格式的备份文件</p>
        </Dragger>
      </Modal>
    )
  }

  // 预览界面
  const tabItems = [
    {
      key: 'chats',
      label: `对话 (${stats.pageIds.length})`,
      children: renderTree(chatsTree, checkedChats, setCheckedChats, 'chats')
    },
    {
      key: 'llm',
      label: `LLM配置 (${stats.llmIds.length})`,
      children: renderTree(llmTree, checkedLLM, setCheckedLLM, 'llm')
    },
    {
      key: 'model',
      label: `模型配置 (${stats.modelIds.length})`,
      children: renderTree(modelTree, checkedModel, setCheckedModel, 'model')
    },
    {
      key: 'ui',
      label: '界面',
      children: (
        <Flex vertical gap={8}>
          <Checkbox
            checked={includeUI}
            onChange={(e) => setIncludeUI(e.target.checked)}
            disabled={!importData.data.viewState}
          >
            导入标签页和布局设置
          </Checkbox>
          {!importData.data.viewState && <Text type="secondary">备份文件中不包含界面状态数据</Text>}
        </Flex>
      )
    }
  ]

  return (
    <Modal
      title="导入数据 - 预览"
      open={open}
      onCancel={handleClose}
      width={600}
      footer={
        <Space>
          <Button onClick={handleClose}>取消</Button>
          <Button
            type="primary"
            onClick={handleImport}
            loading={importing}
            disabled={!hasSelection || Boolean(restoreResult)}
          >
            导入选中项
          </Button>
        </Space>
      }
    >
      <Flex vertical gap={12}>
        {restoreResult && (
          <Alert
            type={restoreResult.error ? 'error' : 'success'}
            showIcon
            message={restoreResult.error ? `导入已停止：${restoreResult.error}` : '导入完成'}
            description={`已完成 ${restoreResult.counts.pages} 个对话、${restoreResult.counts.folders} 个文件夹、${restoreResult.counts.configs} 个配置，跳过 ${restoreResult.counts.skipped} 项。${restoreResult.warnings.join('；')}`}
          />
        )}
        <Alert
          type="info"
          showIcon
          message={
            <>
              文件导出时间: <DateTimeText value={importData.exportedAt} />
            </>
          }
        />

        <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k as TabKey)} items={tabItems} />

        <Flex vertical gap={4}>
          <Text strong>ID 冲突处理:</Text>
          <Radio.Group
            value={conflictStrategy}
            onChange={(e) => setConflictStrategy(e.target.value)}
          >
            <Space direction="vertical">
              <Radio value="generate-new">生成新 ID（保留两份）</Radio>
              <Radio value="skip">跳过冲突项</Radio>
              <Radio value="overwrite">覆盖现有项</Radio>
            </Space>
          </Radio.Group>
        </Flex>
      </Flex>
    </Modal>
  )
}
