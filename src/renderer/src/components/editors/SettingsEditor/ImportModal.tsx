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
import { useMessagesStore } from '../../../stores/messagesStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useTabsStore } from '../../../stores/tabsStore'
import { useLayoutStore } from '../../../stores/layoutStore'
import type { MessagesRecord } from '@renderer/types/shared'
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

/** 文件夹层级深度，用于保证父级先创建 */
function folderDepth(
  folder: { id: string; parentFolderId?: string },
  all: ReadonlyArray<{ id: string; parentFolderId?: string }>
): number {
  let depth = 0
  let current: string | undefined = folder.parentFolderId
  const visited = new Set<string>([folder.id])

  while (current) {
    if (visited.has(current)) break
    visited.add(current)
    depth += 1
    current = all.find((item) => item.id === current)?.parentFolderId
  }

  return depth
}
const { Dragger } = Upload

interface ImportModalProps {
  open: boolean
  onClose: () => void
}

type TabKey = 'chats' | 'llm' | 'model' | 'ui'
type ConflictStrategy = 'generate-new' | 'skip' | 'overwrite'

// 构建页面树（带冲突检测）
// 构建配置树（带冲突检测）
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
      /** 每个父文件夹下最后创建的页面，用于按顺序串联插入 */
      const lastPageByParent = new Map<string, string>()

      // 导入文件夹
      if (stats.folderIds.length > 0 && importData.data.folders) {
        const foldersToImport = importData.data.folders
          .filter((f) => stats.folderIds.includes(f.id))
          // 父文件夹必须先建，否则子文件夹的 parentFolderId 无法重映射
          .sort(
            (a, b) =>
              folderDepth(a, importData.data.folders ?? []) -
              folderDepth(b, importData.data.folders ?? [])
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
        const pagesToImport = importData.data.pages
          .filter((p) => stats.pageIds.includes(p.id))
          // 按（所属文件夹, 顺序）创建，保证同级顺序与备份一致
          .sort(
            (a, b) =>
              (a.parentFolderId ?? '').localeCompare(b.parentFolderId ?? '') ||
              (a.order ?? 0) - (b.order ?? 0)
          )

        for (const page of pagesToImport) {
          if (conflictStrategy === 'skip' && existingPageIds.has(page.id)) {
            continue
          }

          const resolved = resolveId(page, existingPageIds, pageIdMap)

          // 更新 parentFolderId
          if (resolved.parentFolderId && folderIdMap.has(resolved.parentFolderId)) {
            resolved.parentFolderId = folderIdMap.get(resolved.parentFolderId)
          }

          // 用"上一个已创建的兄弟"作为参照，保证导入后同级顺序与备份一致
          // （内核在无参照时会把新节点插到最前面）
          const previousSibling = lastPageByParent.get(resolved.parentFolderId ?? '')
          const created = await usePagesStore.getState().create({
            name: resolved.name,
            parentFolderId: resolved.parentFolderId,
            afterNodeId: previousSibling,
            starred: page.starred
          })
          lastPageByParent.set(resolved.parentFolderId ?? '', created.id)

          // 导入消息
          const messagesRecord = importData.data.messages?.find((m) => m.pageId === page.id)
          if (messagesRecord) {
            const newRecord: MessagesRecord = {
              ...messagesRecord,
              pageId: resolved.id
            }
            await useMessagesStore.getState().replaceConversation(resolved.id, newRecord)
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
      if (includeUI && importData.data.viewState) {
        const state = importData.data.viewState
        for (const tab of state.tabs) {
          if (!useTabsStore.getState().tabs.some((existing) => existing.id === tab.id)) {
            useTabsStore.getState().openTab(tab)
          }
        }
        const layoutState = useLayoutStore.getState()
        layoutState.setSidebarWidth(state.layout.sidebarWidth)
        layoutState.setSidebarVisible(state.layout.sidebarVisible)
        layoutState.setActivePanel(state.layout.activePanel)
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
