import { t, useI18n } from '@renderer/i18n'
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
  getAllTreeKeys,
  type NodeDecorator
} from '../../../utils/treeNodes'

const { Text } = Typography

/** 导入数据与本机数据存在同 id 时的标记 */
function ConflictBadge(): React.JSX.Element {
  useI18n()

  return (
    <Text type="warning" style={{ marginLeft: 8 }}>
      <WarningOutlined /> {t('import.idConflict')}
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
  useI18n()

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

  // 文件上传处理
  const handleFileUpload = async (file: UploadFile): Promise<boolean> => {
    try {
      const text = await (file as unknown as File).text()
      const data = JSON.parse(text) as ExportData

      if (!data.version || !data.data) {
        message.error(t('import.invalidFormat'))
        return false
      }

      setImportData(data)
      setRestoreResult(null)

      // 初始化选中状态（全选）
      setTimeout(() => {
        if (data.data.pages) {
          const tree = buildPageTreeNodes(data.data.pages, data.data.folders || [], decorateChats)
          setCheckedChats(getAllTreeKeys(tree))
        }
        if (data.data.settings?.llmConfigs) {
          const tree = buildConfigTreeNodes(
            data.data.settings.llmConfigs as ConfigTree<LLMConfig>,
            (item: LLMConfig) => item.name,
            decorateLLM
          )
          setCheckedLLM(getAllTreeKeys(tree))
        }
        if (data.data.settings?.modelConfigs) {
          const tree = buildConfigTreeNodes(
            data.data.settings.modelConfigs as ConfigTree<ModelConfig>,
            (item: ModelConfig) => item.name,
            decorateModel
          )
          setCheckedModel(getAllTreeKeys(tree))
        }
        setIncludeUI(Boolean(data.data.viewState))
      }, 0)

      return false
    } catch {
      message.error(t('import.parseFailed'))
      return false
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
      if (!result.error) message.success(t('import.complete'))
    } catch (error) {
      message.error(
        t('import.errorPrefix') + (error instanceof Error ? error.message : String(error))
      )
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
    setChecked: (keys: React.Key[]) => void
  ): React.ReactNode => {
    const allKeys = getAllTreeKeys(tree)
    const isAllChecked = allKeys.length > 0 && allKeys.every((k) => checked.includes(k))
    const isIndeterminate = !isAllChecked && checked.length > 0

    return (
      <Flex vertical gap={8} style={{ height: 280, overflow: 'auto' }}>
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
          <Text type="secondary">{t('import.noData')}</Text>
        )}
      </Flex>
    )
  }

  // 上传界面
  if (!importData) {
    return (
      <Modal title={t('data.import')} open={open} onCancel={handleClose} footer={null} width={500}>
        <Dragger
          accept=".json"
          showUploadList={false}
          beforeUpload={handleFileUpload}
          style={{ padding: 12 }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 14 }}>
            {t('import.dropFile')}
          </p>
          <p className="ant-upload-hint">{t('import.backupFormat')}</p>
        </Dragger>
      </Modal>
    )
  }

  // 预览界面
  const tabItems = [
    {
      key: 'chats',
      label: t('backup.conversations', { v0: String(stats.pageIds.length) }),
      children: renderTree(chatsTree, checkedChats, setCheckedChats)
    },
    {
      key: 'llm',
      label: t('backup.llms', { v0: String(stats.llmIds.length) }),
      children: renderTree(llmTree, checkedLLM, setCheckedLLM)
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
          <Checkbox
            checked={includeUI}
            onChange={(e) => setIncludeUI(e.target.checked)}
            disabled={!importData.data.viewState}
          >
            {t('import.includeLayout')}
          </Checkbox>
          {!importData.data.viewState && <Text type="secondary">{t('import.noLayout')}</Text>}
        </Flex>
      )
    }
  ]

  return (
    <Modal
      title={t('import.previewTitle')}
      open={open}
      onCancel={handleClose}
      width={600}
      footer={
        <Space>
          <Button onClick={handleClose}>{t('common.cancel')}</Button>
          <Button
            type="primary"
            onClick={handleImport}
            loading={importing}
            disabled={!hasSelection || Boolean(restoreResult)}
          >
            {t('import.selected')}
          </Button>
        </Space>
      }
    >
      <Flex vertical gap={12}>
        {restoreResult && (
          <Alert
            type={restoreResult.error ? 'error' : 'success'}
            showIcon
            message={
              restoreResult.error
                ? t('import.stopped', { v0: String(restoreResult.error) })
                : t('import.complete')
            }
            description={t('import.progressSummary', {
              v0: String(restoreResult.counts.pages),
              v1: String(restoreResult.counts.folders),
              v2: String(restoreResult.counts.configs),
              v3: String(restoreResult.counts.skipped),
              v4: String(restoreResult.warnings.join('；'))
            })}
          />
        )}
        <Alert
          type="info"
          showIcon
          message={
            <>
              {t('import.exportedAt')}
              <DateTimeText value={importData.exportedAt} />
            </>
          }
        />

        <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k as TabKey)} items={tabItems} />

        <Flex vertical gap={4}>
          <Text strong>{t('import.conflictPolicy')}</Text>
          <Radio.Group
            value={conflictStrategy}
            onChange={(e) => setConflictStrategy(e.target.value)}
          >
            <Space direction="vertical">
              <Radio value="generate-new">{t('import.generateNewIds')}</Radio>
              <Radio value="skip">{t('import.skipConflicts')}</Radio>
              <Radio value="overwrite">{t('import.overwrite')}</Radio>
            </Space>
          </Radio.Group>
        </Flex>
      </Flex>
    </Modal>
  )
}
