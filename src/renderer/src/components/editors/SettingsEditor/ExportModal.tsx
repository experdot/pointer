import React, { useState, useMemo, useCallback } from 'react'
import { Modal, Tabs, Tree, Checkbox, Button, Space, Typography, App, Flex } from 'antd'
import type { TreeDataNode } from 'antd'
import { usePagesStore } from '../../../stores/pagesStore'
import { useFoldersStore } from '../../../stores/foldersStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useViewStateStore } from '../../../stores/viewStateStore'
import { query } from '../../../runtime/client'
import type { PageRecord, MessagesRecord, ViewState } from '@renderer/types/shared'
import type { Folder, Settings, LLMConfig, ModelConfig } from '@renderer/types/shared'
import { buildConfigTreeNodes, buildPageTreeNodes } from '../../../utils/treeNodes'

const { Text } = Typography

// 导出数据格式
export interface ExportData {
  version: string
  exportedAt: number
  data: {
    pages?: PageRecord[]
    folders?: Folder[]
    messages?: MessagesRecord[]
    settings?: Partial<Settings>
    viewState?: ViewState
  }
}

interface ExportModalProps {
  open: boolean
  onClose: () => void
}

type TabKey = 'chats' | 'llm' | 'model' | 'ui'

// 构建页面树
// 构建配置树
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
  const [includeUI, setIncludeUI] = useState(false)

  // 构建树数据
  const chatsTree = useMemo(() => buildPageTreeNodes(pages, folders), [pages, folders])
  const llmTree = useMemo(
    () => buildConfigTreeNodes(settings.llmConfigs, (item: LLMConfig) => item.name),
    [settings.llmConfigs]
  )
  const modelTree = useMemo(
    () => buildConfigTreeNodes(settings.modelConfigs, (item: ModelConfig) => item.name),
    [settings.modelConfigs]
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
      setIncludeUI(false)
    }
  }, [open, chatsTree, llmTree, modelTree, getAllKeys])

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

        // 加载会话
        const messages: MessagesRecord[] = []
        for (const pageId of stats.pageIds) {
          const record = await query('conversation.get', { pageId })
          messages.push(record)
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

      // 导出界面状态
      if (includeUI) {
        exportData.data.viewState = useViewStateStore.getState().viewState
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
          <Button
            type="primary"
            onClick={handleExport}
            loading={exporting}
            disabled={!hasSelection}
          >
            导出选中项
          </Button>
        </Space>
      }
    >
      <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k as TabKey)} items={tabItems} />
    </Modal>
  )
}
