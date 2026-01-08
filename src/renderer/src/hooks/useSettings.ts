import { useMemo, useCallback } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import type {
  ConfigTree,
  ConfigFolder,
  ConfigItemBase,
  LLMConfig,
  ModelConfig,
  Settings
} from '../types/type'
import * as settingsService from '../services/settingsService'

// 通用树操作返回类型
interface ConfigTreeResult<T extends ConfigItemBase> {
  items: T[]
  folders: ConfigFolder[]
  rootItems: (T | ConfigFolder)[]
  getItemsInFolder: (folderId: string | undefined) => (T | ConfigFolder)[]
  expandedKeys: string[]
}

// 通用树操作 Hook
function useConfigTree<T extends ConfigItemBase>(tree: ConfigTree<T>): ConfigTreeResult<T> {
  const rootItems = useMemo(() => {
    const items = tree.items.filter((item) => !item.parentFolderId)
    const folders = tree.folders.filter((f) => !f.parentFolderId)
    return [...folders, ...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [tree.items, tree.folders])

  const getItemsInFolder = useCallback(
    (folderId: string | undefined): (T | ConfigFolder)[] => {
      const items = tree.items.filter((item) => item.parentFolderId === folderId)
      const folders = tree.folders.filter((f) => f.parentFolderId === folderId)
      return [...folders, ...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    },
    [tree.items, tree.folders]
  )

  const expandedKeys = useMemo(
    () => tree.folders.filter((f) => f.expanded).map((f) => f.id),
    [tree.folders]
  )

  return { items: tree.items, folders: tree.folders, rootItems, getItemsInFolder, expandedKeys }
}

interface UseSettingsResult {
  settings: Settings
  fontSize: Settings['fontSize']
  defaultLLMId: string | undefined
  defaultModelConfigId: string | undefined
  setFontSize: typeof settingsService.setFontSize
  setDefaultLLMId: typeof settingsService.setDefaultLLMId
  setDefaultModelConfigId: typeof settingsService.setDefaultModelConfigId
  openSettings: typeof settingsService.openSettings
}

export function useSettings(): UseSettingsResult {
  const { settings } = useSettingsStore()

  return {
    settings,
    fontSize: settings.fontSize,
    defaultLLMId: settings.defaultLLMId,
    defaultModelConfigId: settings.defaultModelConfigId,

    // 基础设置
    setFontSize: settingsService.setFontSize,
    setDefaultLLMId: settingsService.setDefaultLLMId,
    setDefaultModelConfigId: settingsService.setDefaultModelConfigId,
    openSettings: settingsService.openSettings
  }
}

interface UseLLMConfigsResult extends ConfigTreeResult<LLMConfig> {
  batchUpdateItemsOrder: (items: (LLMConfig | ConfigFolder)[], parentFolderId?: string) => void
  createConfig: typeof settingsService.createLLMConfig
  updateConfig: typeof settingsService.updateLLMConfig
  deleteConfig: typeof settingsService.deleteLLMConfig
  copyConfig: typeof settingsService.copyLLMConfig
  createFolder: typeof settingsService.createLLMConfigFolder
  updateFolder: typeof settingsService.updateLLMConfigFolder
  deleteFolder: typeof settingsService.deleteLLMConfigFolder
  toggleFolderExpanded: typeof settingsService.toggleLLMConfigFolderExpanded
}

export function useLLMConfigs(): UseLLMConfigsResult {
  const { settings, batchUpdateLLMConfigs, batchUpdateLLMConfigFolders } = useSettingsStore()
  const tree = useConfigTree(settings.llmConfigs)

  const batchUpdateItemsOrder = useCallback(
    (items: (LLMConfig | ConfigFolder)[], parentFolderId?: string) => {
      const itemUpdates: Array<{ id: string; updates: Partial<LLMConfig> }> = []
      const folderUpdates: Array<{ id: string; updates: Partial<ConfigFolder> }> = []

      items.forEach((item, index) => {
        if ('baseUrl' in item) {
          itemUpdates.push({ id: item.id, updates: { order: index, parentFolderId } })
        } else {
          folderUpdates.push({ id: item.id, updates: { order: index, parentFolderId } })
        }
      })

      if (itemUpdates.length) batchUpdateLLMConfigs(itemUpdates)
      if (folderUpdates.length) batchUpdateLLMConfigFolders(folderUpdates)
    },
    [batchUpdateLLMConfigs, batchUpdateLLMConfigFolders]
  )

  return {
    ...tree,
    batchUpdateItemsOrder,
    createConfig: settingsService.createLLMConfig,
    updateConfig: settingsService.updateLLMConfig,
    deleteConfig: settingsService.deleteLLMConfig,
    copyConfig: settingsService.copyLLMConfig,
    createFolder: settingsService.createLLMConfigFolder,
    updateFolder: settingsService.updateLLMConfigFolder,
    deleteFolder: settingsService.deleteLLMConfigFolder,
    toggleFolderExpanded: settingsService.toggleLLMConfigFolderExpanded
  }
}

interface UseModelConfigsResult extends ConfigTreeResult<ModelConfig> {
  batchUpdateItemsOrder: (items: (ModelConfig | ConfigFolder)[], parentFolderId?: string) => void
  createConfig: typeof settingsService.createModelConfig
  updateConfig: typeof settingsService.updateModelConfig
  deleteConfig: typeof settingsService.deleteModelConfig
  copyConfig: typeof settingsService.copyModelConfig
  createFolder: typeof settingsService.createModelConfigFolder
  updateFolder: typeof settingsService.updateModelConfigFolder
  deleteFolder: typeof settingsService.deleteModelConfigFolder
  toggleFolderExpanded: typeof settingsService.toggleModelConfigFolderExpanded
}

export function useModelConfigs(): UseModelConfigsResult {
  const { settings, batchUpdateModelConfigs, batchUpdateModelConfigFolders } = useSettingsStore()
  const tree = useConfigTree(settings.modelConfigs)

  const batchUpdateItemsOrder = useCallback(
    (items: (ModelConfig | ConfigFolder)[], parentFolderId?: string) => {
      const itemUpdates: Array<{ id: string; updates: Partial<ModelConfig> }> = []
      const folderUpdates: Array<{ id: string; updates: Partial<ConfigFolder> }> = []

      items.forEach((item, index) => {
        if ('systemPrompt' in item) {
          itemUpdates.push({ id: item.id, updates: { order: index, parentFolderId } })
        } else {
          folderUpdates.push({ id: item.id, updates: { order: index, parentFolderId } })
        }
      })

      if (itemUpdates.length) batchUpdateModelConfigs(itemUpdates)
      if (folderUpdates.length) batchUpdateModelConfigFolders(folderUpdates)
    },
    [batchUpdateModelConfigs, batchUpdateModelConfigFolders]
  )

  return {
    ...tree,
    batchUpdateItemsOrder,
    createConfig: settingsService.createModelConfig,
    updateConfig: settingsService.updateModelConfig,
    deleteConfig: settingsService.deleteModelConfig,
    copyConfig: settingsService.copyModelConfig,
    createFolder: settingsService.createModelConfigFolder,
    updateFolder: settingsService.updateModelConfigFolder,
    deleteFolder: settingsService.deleteModelConfigFolder,
    toggleFolderExpanded: settingsService.toggleModelConfigFolderExpanded
  }
}
