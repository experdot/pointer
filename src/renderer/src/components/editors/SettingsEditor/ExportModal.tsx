import { t, useI18n } from '@renderer/i18n'
import { BACKUP_FORMAT_VERSION } from '@shared/contracts'
import React, { useState, useMemo, useCallback } from 'react'
import { Modal, Tabs, Tree, Checkbox, Button, Space, Typography, App, Flex, Divider } from 'antd'
import type { TreeDataNode } from 'antd'
import { usePagesStore } from '../../../stores/pagesStore'
import { useFoldersStore } from '../../../stores/foldersStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useViewStateStore } from '../../../stores/viewStateStore'
import { query } from '../../../runtime/client'
import type { MessagesRecord } from '@renderer/types/shared'
import type { LLMConfig, ModelConfig } from '@renderer/types/shared'
import { buildConfigTreeNodes, buildPageTreeNodes, getAllTreeKeys } from '../../../utils/treeNodes'

const { Text } = Typography

export type { BackupData as ExportData } from '@shared/contracts'
import type { BackupData as ExportData } from '@shared/contracts'

interface ExportModalProps {
  open: boolean
  onClose: () => void
}

type TabKey = 'chats' | 'llm' | 'model' | 'ui'

export function ExportModal({ open, onClose }: ExportModalProps): React.JSX.Element {
  useI18n()

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
  const [includeApiKeys, setIncludeApiKeys] = useState(false)

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

  // 初始化选中状态（全选）
  React.useEffect(() => {
    if (open) {
      setCheckedChats(getAllTreeKeys(chatsTree))
      setCheckedLLM(getAllTreeKeys(llmTree))
      setCheckedModel(getAllTreeKeys(modelTree))
      setIncludeUI(false)
      setIncludeApiKeys(false)
    }
  }, [open, chatsTree, llmTree, modelTree])

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

    const llmFolderIds = checkedLLM
      .filter((key) => String(key).startsWith('folder:'))
      .map((key) => String(key).slice(7))
    const modelFolderIds = checkedModel
      .filter((key) => String(key).startsWith('folder:'))
      .map((key) => String(key).slice(7))
    return { pageIds, folderIds, llmIds, modelIds, llmFolderIds, modelFolderIds }
  }, [checkedChats, checkedLLM, checkedModel])

  const stats = getStats()
  const hasSelection =
    stats.pageIds.length > 0 ||
    stats.folderIds.length > 0 ||
    stats.llmIds.length > 0 ||
    stats.modelIds.length > 0 ||
    stats.llmFolderIds.length > 0 ||
    stats.modelFolderIds.length > 0 ||
    includeUI

  // 导出数据
  const handleExport = async (): Promise<void> => {
    setExporting(true)
    try {
      const exportData: ExportData = {
        version: BACKUP_FORMAT_VERSION,
        exportedAt: Date.now(),
        data: {}
      }

      // 导出对话数据
      if (stats.pageIds.length > 0 || stats.folderIds.length > 0) {
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
      if (stats.llmIds.length > 0 || stats.llmFolderIds.length > 0) {
        exportData.data.settings = {
          ...exportData.data.settings,
          llmConfigs: {
            items: settings.llmConfigs.items
              .filter((i) => stats.llmIds.includes(i.id))
              .map((item) => ({ ...item, apiKey: includeApiKeys ? item.apiKey : '' })),
            folders: settings.llmConfigs.folders.filter((f) => stats.llmFolderIds.includes(f.id))
          },
          defaultLLMId:
            settings.defaultLLMId && stats.llmIds.includes(settings.defaultLLMId)
              ? settings.defaultLLMId
              : undefined
        }
      }

      // 导出模型配置
      if (stats.modelIds.length > 0 || stats.modelFolderIds.length > 0) {
        exportData.data.settings = {
          ...exportData.data.settings,
          modelConfigs: {
            items: settings.modelConfigs.items.filter((i) => stats.modelIds.includes(i.id)),
            folders: settings.modelConfigs.folders.filter((f) =>
              stats.modelFolderIds.includes(f.id)
            )
          },
          defaultModelConfigId:
            settings.defaultModelConfigId && stats.modelIds.includes(settings.defaultModelConfigId)
              ? settings.defaultModelConfigId
              : undefined
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
      try {
        a.click()
      } finally {
        URL.revokeObjectURL(url)
      }

      message.success(t('export.success'))
      onClose()
    } catch (error) {
      message.error(
        t('export.errorPrefix') +
          (error instanceof Error ? error.message : t('common.unknownError'))
      )
    } finally {
      setExporting(false)
    }
  }

  const renderTree = (
    tree: TreeDataNode[],
    checked: React.Key[],
    setChecked: (keys: React.Key[]) => void
  ): React.ReactNode => {
    const allKeys = getAllTreeKeys(tree)
    const isAllChecked = allKeys.length > 0 && allKeys.every((k) => checked.includes(k))
    const isIndeterminate = !isAllChecked && checked.length > 0

    return (
      <Flex vertical gap={8} style={{ height: 300, overflow: 'auto' }}>
        <Checkbox
          checked={isAllChecked}
          indeterminate={isIndeterminate}
          onChange={(e) => setChecked(e.target.checked ? allKeys : [])}
        >
          {t('common.toggleAll')}
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
          <Text type="secondary">{t('common.noData')}</Text>
        )}
      </Flex>
    )
  }

  const tabItems = [
    {
      key: 'chats',
      label: t('backup.conversations', { v0: String(stats.pageIds.length) }),
      children: (
        <Flex vertical gap={8}>
          {renderTree(chatsTree, checkedChats, setCheckedChats)}
          <Text type="secondary">{t('backup.noImages')}</Text>
        </Flex>
      )
    },
    {
      key: 'llm',
      label: t('backup.llms', { v0: String(stats.llmIds.length) }),
      children: (
        <>
          <Checkbox
            checked={includeApiKeys}
            onChange={(event) => setIncludeApiKeys(event.target.checked)}
          >
            {t('backup.includeKeys')}
          </Checkbox>
          <Divider style={{ margin: '8px 0' }} />
          {renderTree(llmTree, checkedLLM, setCheckedLLM)}
        </>
      )
    },
    {
      key: 'model',
      label: t('backup.models', { v0: String(stats.modelIds.length) }),
      children: renderTree(modelTree, checkedModel, setCheckedModel)
    },
    {
      key: 'ui',
      label: t('backup.interface'),
      children: (
        <Flex vertical gap={8}>
          <Checkbox checked={includeUI} onChange={(e) => setIncludeUI(e.target.checked)}>
            {t('backup.includeLayout')}
          </Checkbox>
          <Text type="secondary">{t('backup.layoutDescription')}</Text>
        </Flex>
      )
    }
  ]

  return (
    <Modal
      title={t('data.export')}
      open={open}
      onCancel={onClose}
      width={600}
      footer={
        <Space>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            type="primary"
            onClick={handleExport}
            loading={exporting}
            disabled={!hasSelection}
          >
            {t('backup.exportSelected')}
          </Button>
        </Space>
      }
    >
      <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k as TabKey)} items={tabItems} />
    </Modal>
  )
}
