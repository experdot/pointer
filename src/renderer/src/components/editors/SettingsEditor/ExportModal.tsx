import React, { useState, useMemo, useCallback } from 'react'
import { Modal, Tabs, Tree, Checkbox, Button, Space, Typography, App, Flex } from 'antd'
import { FolderOutlined, FileTextOutlined, SettingOutlined } from '@ant-design/icons'
import type { TreeDataNode } from 'antd'
import { usePagesStore } from '../../../stores/pagesStore'
import { useFoldersStore } from '../../../stores/foldersStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useTabsStore } from '../../../stores/tabsStore'
import { useLayoutStore } from '../../../stores/layoutStore'
import * as db from '../../../utils/database'
import type { PageRecord, MessagesRecord, TabsRecord, LayoutRecord } from '../../../utils/database'
import type {
  PageFolder,
  Settings,
  ConfigFolder,
  ConfigItemBase,
  ConfigTree,
  LLMConfig,
  ModelConfig,
  PromptListConfig
} from '../../../types/type'

const { Text } = Typography

// 导出数据格式
export interface ExportData {
  version: string
  exportedAt: number
  data: {
    pages?: PageRecord[]
    folders?: PageFolder[]
    messages?: MessagesRecord[]
    settings?: Partial<Settings>
    tabs?: TabsRecord
    layout?: LayoutRecord
  }
}

interface ExportModalProps {
  open: boolean
  onClose: () => void
}

type TabKey = 'chats' | 'llm' | 'model' | 'prompts' | 'ui'

// 构建页面树
function buildPagesTree(pages: PageRecord[], folders: PageFolder[]): TreeDataNode[] {
  const folderMap = new Map<string | undefined, TreeDataNode[]>()

  // 初始化根节点
  folderMap.set(undefined, [])

  // 创建文件夹节点
  folders.forEach((folder) => {
    const parentId = folder.parentFolderId
    if (!folderMap.has(parentId)) {
      folderMap.set(parentId, [])
    }
  })

  // 创建文件夹树节点
  const folderNodes = new Map<string, TreeDataNode>()
  folders.forEach((folder) => {
    folderNodes.set(folder.id, {
      key: `folder:${folder.id}`,
      title: folder.name,
      icon: <FolderOutlined />,
      children: []
    })
  })

  // 添加页面到对应文件夹
  pages.forEach((page) => {
    const parentId = page.parentFolderId
    const pageNode: TreeDataNode = {
      key: `page:${page.id}`,
      title: page.title || '未命名对话',
      icon: <FileTextOutlined />,
      isLeaf: true
    }

    if (parentId && folderNodes.has(parentId)) {
      folderNodes.get(parentId)!.children!.push(pageNode)
    } else {
      if (!folderMap.has(undefined)) {
        folderMap.set(undefined, [])
      }
      folderMap.get(undefined)!.push(pageNode)
    }
  })

  // 构建文件夹层级
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

// 构建配置树
function buildConfigTree<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  getTitle: (item: T) => string
): TreeDataNode[] {
  const folderMap = new Map<string | undefined, TreeDataNode[]>()
  folderMap.set(undefined, [])

  // 创建文���夹节点
  const folderNodes = new Map<string, TreeDataNode>()
  tree.folders.forEach((folder: ConfigFolder) => {
    folderNodes.set(folder.id, {
      key: `folder:${folder.id}`,
      title: folder.name,
      icon: <FolderOutlined />,
      children: []
    })
  })

  // 添加配置项
  tree.items.forEach((item: T) => {
    const itemNode: TreeDataNode = {
      key: `item:${item.id}`,
      title: getTitle(item),
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

  // 构建文件夹层级
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

export function ExportModal({ open, onClose }: ExportModalProps): React.JSX.Element {
  const { message } = App.useApp()
  const pages = usePagesStore((s) => s.pages)
  const folders = useFoldersStore((s) => s.folders)
  const settings = useSettingsStore((s) => s.settings)

  const [activeTab, setActiveTab] = useState<TabKey>('chats')
  const [exporting, setExporting] = useState(false)

  // 各 Tab 的选中状态
  const [checkedChats, setCheckedChats] = useState<React.Key[]>([])
  const [checkedLLM, setCheckedLLM] = useState<React.Key[]>([])
  const [checkedModel, setCheckedModel] = useState<React.Key[]>([])
  const [checkedPrompts, setCheckedPrompts] = useState<React.Key[]>([])
  const [includeUI, setIncludeUI] = useState(false)

  // 构建树数据
  const chatsTree = useMemo(() => buildPagesTree(pages, folders), [pages, folders])
  const llmTree = useMemo(
    () => buildConfigTree(settings.llmConfigs, (item: LLMConfig) => item.name),
    [settings.llmConfigs]
  )
  const modelTree = useMemo(
    () => buildConfigTree(settings.modelConfigs, (item: ModelConfig) => item.name),
    [settings.modelConfigs]
  )
  const promptsTree = useMemo(
    () => buildConfigTree(settings.promptLists, (item: PromptListConfig) => item.name),
    [settings.promptLists]
  )

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

  // 初始化选中状态（全选）
  React.useEffect(() => {
    if (open) {
      setCheckedChats(getAllKeys(chatsTree))
      setCheckedLLM(getAllKeys(llmTree))
      setCheckedModel(getAllKeys(modelTree))
      setCheckedPrompts(getAllKeys(promptsTree))
      setIncludeUI(false)
    }
  }, [open, chatsTree, llmTree, modelTree, promptsTree, getAllKeys])

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
      case 'prompts':
        setCheckedPrompts(checked ? getAllKeys(promptsTree) : [])
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
    const promptIds = checkedPrompts
      .filter((k) => String(k).startsWith('item:'))
      .map((k) => String(k).replace('item:', ''))

    return { pageIds, folderIds, llmIds, modelIds, promptIds }
  }, [checkedChats, checkedLLM, checkedModel, checkedPrompts])

  const stats = getStats()
  const hasSelection =
    stats.pageIds.length > 0 ||
    stats.llmIds.length > 0 ||
    stats.modelIds.length > 0 ||
    stats.promptIds.length > 0 ||
    includeUI

  // 导出数据
  const handleExport = async (): Promise<void> => {
    setExporting(true)
    try {
      const exportData: ExportData = {
        version: '1.0.0',
        exportedAt: Date.now(),
        data: {}
      }

      // 导出对话数据
      if (stats.pageIds.length > 0) {
        exportData.data.pages = pages.filter((p) => stats.pageIds.includes(p.id))
        exportData.data.folders = folders.filter((f) => stats.folderIds.includes(f.id))

        // 加载消息
        const messages: MessagesRecord[] = []
        for (const pageId of stats.pageIds) {
          const record = await db.getMessages(pageId)
          if (record) {
            messages.push(record)
          }
        }
        exportData.data.messages = messages
      }

      // 导出 LLM 配置
      if (stats.llmIds.length > 0) {
        const llmFolderIds = checkedLLM
          .filter((k) => String(k).startsWith('folder:'))
          .map((k) => String(k).replace('folder:', ''))

        exportData.data.settings = {
          ...exportData.data.settings,
          llmConfigs: {
            items: settings.llmConfigs.items.filter((i) => stats.llmIds.includes(i.id)),
            folders: settings.llmConfigs.folders.filter((f) => llmFolderIds.includes(f.id))
          }
        }
      }

      // 导出模型配置
      if (stats.modelIds.length > 0) {
        const modelFolderIds = checkedModel
          .filter((k) => String(k).startsWith('folder:'))
          .map((k) => String(k).replace('folder:', ''))

        exportData.data.settings = {
          ...exportData.data.settings,
          modelConfigs: {
            items: settings.modelConfigs.items.filter((i) => stats.modelIds.includes(i.id)),
            folders: settings.modelConfigs.folders.filter((f) => modelFolderIds.includes(f.id))
          }
        }
      }

      // 导出提示词列表
      if (stats.promptIds.length > 0) {
        const promptFolderIds = checkedPrompts
          .filter((k) => String(k).startsWith('folder:'))
          .map((k) => String(k).replace('folder:', ''))

        exportData.data.settings = {
          ...exportData.data.settings,
          promptLists: {
            items: settings.promptLists.items.filter((i) => stats.promptIds.includes(i.id)),
            folders: settings.promptLists.folders.filter((f) => promptFolderIds.includes(f.id))
          }
        }
      }

      // 导出界面状态
      if (includeUI) {
        exportData.data.tabs = useTabsStore.getState()
        exportData.data.layout = useLayoutStore.getState()
      }

      // 下载文件
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pointer-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)

      message.success('导出成功')
      onClose()
    } catch (error) {
      message.error('导出失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setExporting(false)
    }
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
      <Flex vertical gap={8} style={{ height: 300, overflow: 'auto' }}>
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
          <Text type="secondary">暂无数据</Text>
        )}
      </Flex>
    )
  }

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
      key: 'prompts',
      label: `提示词 (${stats.promptIds.length})`,
      children: renderTree(promptsTree, checkedPrompts, setCheckedPrompts, 'prompts')
    },
    {
      key: 'ui',
      label: '界面',
      children: (
        <Flex vertical gap={8}>
          <Checkbox checked={includeUI} onChange={(e) => setIncludeUI(e.target.checked)}>
            包含标签页和布局设置
          </Checkbox>
          <Text type="secondary">导出当前打开的标签页、侧边栏宽度等界面状态</Text>
        </Flex>
      )
    }
  ]

  return (
    <Modal
      title="导出数据"
      open={open}
      onCancel={onClose}
      width={600}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleExport} loading={exporting} disabled={!hasSelection}>
            导出选中项
          </Button>
        </Space>
      }
    >
      <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k as TabKey)} items={tabItems} />
    </Modal>
  )
}
