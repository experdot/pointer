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
import {
  InboxOutlined,
  FolderOutlined,
  FileTextOutlined,
  SettingOutlined,
  WarningOutlined
} from '@ant-design/icons'
import type { TreeDataNode, UploadFile } from 'antd'
import type { ExportData } from './ExportModal'
import { usePagesStore } from '../../../stores/pagesStore'
import { useFoldersStore } from '../../../stores/foldersStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useTabsStore } from '../../../stores/tabsStore'
import { useLayoutStore } from '../../../stores/layoutStore'
import * as db from '../../../utils/database'
import type { PageRecord, MessagesRecord } from '../../../utils/database'
import type {
  PageFolder,
  ConfigFolder,
  ConfigItemBase,
  ConfigTree,
  LLMConfig,
  ModelConfig
} from '../../../types/type'

const { Text } = Typography
const { Dragger } = Upload

interface ImportModalProps {
  open: boolean
  onClose: () => void
}

type TabKey = 'chats' | 'llm' | 'model' | 'ui'
type ConflictStrategy = 'generate-new' | 'skip' | 'overwrite'

// 构建页面树（带冲突检测）
function buildPagesTree(
  pages: PageRecord[],
  folders: PageFolder[],
  existingPageIds: Set<string>,
  existingFolderIds: Set<string>
): TreeDataNode[] {
  const folderMap = new Map<string | undefined, TreeDataNode[]>()
  folderMap.set(undefined, [])

  const folderNodes = new Map<string, TreeDataNode>()
  folders.forEach((folder) => {
    const hasConflict = existingFolderIds.has(folder.id)
    folderNodes.set(folder.id, {
      key: `folder:${folder.id}`,
      title: (
        <span>
          {folder.name}
          {hasConflict && (
            <Text type="warning" style={{ marginLeft: 8 }}>
              <WarningOutlined /> ID冲突
            </Text>
          )}
        </span>
      ),
      icon: <FolderOutlined />,
      children: []
    })
  })

  pages.forEach((page) => {
    const hasConflict = existingPageIds.has(page.id)
    const pageNode: TreeDataNode = {
      key: `page:${page.id}`,
      title: (
        <span>
          {page.name || '未命名对话'}
          {hasConflict && (
            <Text type="warning" style={{ marginLeft: 8 }}>
              <WarningOutlined /> ID冲突
            </Text>
          )}
        </span>
      ),
      icon: <FileTextOutlined />,
      isLeaf: true
    }

    const parentId = page.parentFolderId
    if (parentId && folderNodes.has(parentId)) {
      folderNodes.get(parentId)!.children!.push(pageNode)
    } else {
      folderMap.get(undefined)!.push(pageNode)
    }
  })

  folders.forEach((folder) => {
    const node = folderNodes.get(folder.id)!
    const parentId = folder.parentFolderId
    if (parentId && folderNodes.has(parentId)) {
      folderNodes.get(parentId)!.children!.push(node)
    } else {
      folderMap.get(undefined)!.push(node)
    }
  })

  return folderMap.get(undefined) || []
}

// 构建配置树（带冲突检测）
function buildConfigTree<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  getTitle: (item: T) => string,
  existingItemIds: Set<string>,
  existingFolderIds: Set<string>
): TreeDataNode[] {
  const folderMap = new Map<string | undefined, TreeDataNode[]>()
  folderMap.set(undefined, [])

  const folderNodes = new Map<string, TreeDataNode>()
  tree.folders.forEach((folder: ConfigFolder) => {
    const hasConflict = existingFolderIds.has(folder.id)
    folderNodes.set(folder.id, {
      key: `folder:${folder.id}`,
      title: (
        <span>
          {folder.name}
          {hasConflict && (
            <Text type="warning" style={{ marginLeft: 8 }}>
              <WarningOutlined /> ID冲突
            </Text>
          )}
        </span>
      ),
      icon: <FolderOutlined />,
      children: []
    })
  })

  tree.items.forEach((item: T) => {
    const hasConflict = existingItemIds.has(item.id)
    const itemNode: TreeDataNode = {
      key: `item:${item.id}`,
      title: (
        <span>
          {getTitle(item)}
          {hasConflict && (
            <Text type="warning" style={{ marginLeft: 8 }}>
              <WarningOutlined /> ID冲突
            </Text>
          )}
        </span>
      ),
      icon: <SettingOutlined />,
      isLeaf: true
    }

    const parentId = item.parentFolderId
    if (parentId && folderNodes.has(parentId)) {
      folderNodes.get(parentId)!.children!.push(itemNode)
    } else {
      folderMap.get(undefined)!.push(itemNode)
    }
  })

  tree.folders.forEach((folder: ConfigFolder) => {
    const node = folderNodes.get(folder.id)!
    const parentId = folder.parentFolderId
    if (parentId && folderNodes.has(parentId)) {
      folderNodes.get(parentId)!.children!.push(node)
    } else {
      folderMap.get(undefined)!.push(node)
    }
  })

  return folderMap.get(undefined) || []
}

// 生成新 ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

export function ImportModal({ open, onClose }: ImportModalProps): React.JSX.Element {
  const { message } = App.useApp()
  const existingPages = usePagesStore((s) => s.pages)
  const existingFolders = useFoldersStore((s) => s.folders)
  const existingSettings = useSettingsStore((s) => s.settings)

  const [importData, setImportData] = useState<ExportData | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('chats')
  const [importing, setImporting] = useState(false)
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

  // 构建树数据
  const chatsTree = useMemo(() => {
    if (!importData?.data.pages) return []
    return buildPagesTree(
      importData.data.pages,
      importData.data.folders || [],
      existingPageIds,
      existingFolderIds
    )
  }, [importData, existingPageIds, existingFolderIds])

  const llmTree = useMemo(() => {
    if (!importData?.data.settings?.llmConfigs) return []
    return buildConfigTree(
      importData.data.settings.llmConfigs as ConfigTree<LLMConfig>,
      (item: LLMConfig) => item.name,
      existingLLMIds,
      existingLLMFolderIds
    )
  }, [importData, existingLLMIds, existingLLMFolderIds])

  const modelTree = useMemo(() => {
    if (!importData?.data.settings?.modelConfigs) return []
    return buildConfigTree(
      importData.data.settings.modelConfigs as ConfigTree<ModelConfig>,
      (item: ModelConfig) => item.name,
      existingModelIds,
      existingModelFolderIds
    )
  }, [importData, existingModelIds, existingModelFolderIds])

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

      // 初始化选中状态（全选）
      setTimeout(() => {
        if (data.data.pages) {
          const tree = buildPagesTree(
            data.data.pages,
            data.data.folders || [],
            existingPageIds,
            existingFolderIds
          )
          setCheckedChats(getAllKeys(tree))
        }
        if (data.data.settings?.llmConfigs) {
          const tree = buildConfigTree(
            data.data.settings.llmConfigs as ConfigTree<LLMConfig>,
            (item: LLMConfig) => item.name,
            existingLLMIds,
            existingLLMFolderIds
          )
          setCheckedLLM(getAllKeys(tree))
        }
        if (data.data.settings?.modelConfigs) {
          const tree = buildConfigTree(
            data.data.settings.modelConfigs as ConfigTree<ModelConfig>,
            (item: ModelConfig) => item.name,
            existingModelIds,
            existingModelFolderIds
          )
          setCheckedModel(getAllKeys(tree))
        }
        setIncludeUI(!!data.data.tabs || !!data.data.layout)
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
    stats.pageIds.length > 0 || stats.llmIds.length > 0 || stats.modelIds.length > 0 || includeUI

  // 处理 ID 冲突
  const resolveId = <T extends { id: string }>(
    item: T,
    existingIds: Set<string>,
    idMap: Map<string, string>
  ): T => {
    if (!existingIds.has(item.id)) {
      return item
    }

    switch (conflictStrategy) {
      case 'generate-new': {
        const newId = generateId()
        idMap.set(item.id, newId)
        return { ...item, id: newId }
      }
      case 'skip':
        return item // 会在后续过滤掉
      case 'overwrite':
        return item
    }
  }

  // 导入数据
  const handleImport = async (): Promise<void> => {
    if (!importData) return

    setImporting(true)
    try {
      const folderIdMap = new Map<string, string>()
      const pageIdMap = new Map<string, string>()

      // 导入文件夹
      if (stats.folderIds.length > 0 && importData.data.folders) {
        const foldersToImport = importData.data.folders.filter((f) =>
          stats.folderIds.includes(f.id)
        )

        for (const folder of foldersToImport) {
          if (conflictStrategy === 'skip' && existingFolderIds.has(folder.id)) {
            continue
          }

          const resolved = resolveId(folder, existingFolderIds, folderIdMap)

          // 更新 parentFolderId
          if (resolved.parentFolderId && folderIdMap.has(resolved.parentFolderId)) {
            resolved.parentFolderId = folderIdMap.get(resolved.parentFolderId)
          }

          await useFoldersStore.getState().create(resolved)
        }
      }

      // 导入页面和消息
      if (stats.pageIds.length > 0 && importData.data.pages) {
        const pagesToImport = importData.data.pages.filter((p) => stats.pageIds.includes(p.id))

        for (const page of pagesToImport) {
          if (conflictStrategy === 'skip' && existingPageIds.has(page.id)) {
            continue
          }

          const resolved = resolveId(page, existingPageIds, pageIdMap)

          // 更新 parentFolderId
          if (resolved.parentFolderId && folderIdMap.has(resolved.parentFolderId)) {
            resolved.parentFolderId = folderIdMap.get(resolved.parentFolderId)
          }

          await usePagesStore.getState().create(resolved)

          // 导入消息
          const messagesRecord = importData.data.messages?.find((m) => m.pageId === page.id)
          if (messagesRecord) {
            const newRecord: MessagesRecord = {
              ...messagesRecord,
              pageId: resolved.id
            }
            await db.putMessages(newRecord)
          }
        }
      }

      // 导入 LLM 配置
      if (stats.llmIds.length > 0 && importData.data.settings?.llmConfigs) {
        const llmFolderIdMap = new Map<string, string>()
        const llmFolderIds = checkedLLM
          .filter((k) => String(k).startsWith('folder:'))
          .map((k) => String(k).replace('folder:', ''))

        // 导入文件夹
        for (const folder of importData.data.settings.llmConfigs.folders) {
          if (!llmFolderIds.includes(folder.id)) continue
          if (conflictStrategy === 'skip' && existingLLMFolderIds.has(folder.id)) continue

          const resolved = resolveId(folder, existingLLMFolderIds, llmFolderIdMap)
          if (resolved.parentFolderId && llmFolderIdMap.has(resolved.parentFolderId)) {
            resolved.parentFolderId = llmFolderIdMap.get(resolved.parentFolderId)
          }
          useSettingsStore.getState().addLLMConfigFolder(resolved)
        }

        // 导入配置项
        for (const item of importData.data.settings.llmConfigs.items) {
          if (!stats.llmIds.includes(item.id)) continue
          if (conflictStrategy === 'skip' && existingLLMIds.has(item.id)) continue

          const resolved = resolveId(item, existingLLMIds, new Map())
          if (resolved.parentFolderId && llmFolderIdMap.has(resolved.parentFolderId)) {
            resolved.parentFolderId = llmFolderIdMap.get(resolved.parentFolderId)
          }
          useSettingsStore.getState().addLLMConfig(resolved)
        }
      }

      // 导入模型配置
      if (stats.modelIds.length > 0 && importData.data.settings?.modelConfigs) {
        const modelFolderIdMap = new Map<string, string>()
        const modelFolderIds = checkedModel
          .filter((k) => String(k).startsWith('folder:'))
          .map((k) => String(k).replace('folder:', ''))

        for (const folder of importData.data.settings.modelConfigs.folders) {
          if (!modelFolderIds.includes(folder.id)) continue
          if (conflictStrategy === 'skip' && existingModelFolderIds.has(folder.id)) continue

          const resolved = resolveId(folder, existingModelFolderIds, modelFolderIdMap)
          if (resolved.parentFolderId && modelFolderIdMap.has(resolved.parentFolderId)) {
            resolved.parentFolderId = modelFolderIdMap.get(resolved.parentFolderId)
          }
          useSettingsStore.getState().addModelConfigFolder(resolved)
        }

        for (const item of importData.data.settings.modelConfigs.items) {
          if (!stats.modelIds.includes(item.id)) continue
          if (conflictStrategy === 'skip' && existingModelIds.has(item.id)) continue

          const resolved = resolveId(item, existingModelIds, new Map())
          if (resolved.parentFolderId && modelFolderIdMap.has(resolved.parentFolderId)) {
            resolved.parentFolderId = modelFolderIdMap.get(resolved.parentFolderId)
          }
          useSettingsStore.getState().addModelConfig(resolved)
        }
      }

      // 导入界面状态
      if (includeUI) {
        if (importData.data.tabs) {
          const tabsState = useTabsStore.getState()
          // 合并标签页
          importData.data.tabs.tabs.forEach((tab) => {
            if (!tabsState.tabs.find((t) => t.id === tab.id)) {
              tabsState.openTab(tab)
            }
          })
        }
        if (importData.data.layout) {
          const layoutState = useLayoutStore.getState()
          layoutState.setSidebarWidth(importData.data.layout.sidebarWidth)
          layoutState.setSidebarVisible(importData.data.layout.sidebarVisible)
          layoutState.setActivePanel(importData.data.layout.activePanel)
        }
      }

      message.success('导入成功')
      handleClose()
    } catch (error) {
      message.error('导入失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setImporting(false)
    }
  }

  const handleClose = (): void => {
    setImportData(null)
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
            disabled={!importData.data.tabs && !importData.data.layout}
          >
            导入标签页和布局设置
          </Checkbox>
          {!importData.data.tabs && !importData.data.layout && (
            <Text type="secondary">备份文件中不包含界面状态数据</Text>
          )}
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
            disabled={!hasSelection}
          >
            导入选中项
          </Button>
        </Space>
      }
    >
      <Flex vertical gap={12}>
        <Alert
          type="info"
          showIcon
          message={`文件导出时间: ${new Date(importData.exportedAt).toLocaleString()}`}
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
