import { useMemo, useCallback } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import type {
  ConfigTree,
  ConfigFolder,
  ConfigItemBase,
  LLMConfig,
  ModelConfig,
  PromptListConfig
} from '../types/type'
import * as settingsService from '../services/settingsService'

// 通用树操作 Hook
function useConfigTree<T extends ConfigItemBase>(tree: ConfigTree<T>) {
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

export function useSettings() {
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

export function useLLMConfigs() {
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

export function useModelConfigs() {
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

export function usePromptLists() {
  const { settings, batchUpdatePromptLists, batchUpdatePromptListFolders } = useSettingsStore()
  const tree = useConfigTree(settings.promptLists)

  const batchUpdateItemsOrder = useCallback(
    (items: (PromptListConfig | ConfigFolder)[], parentFolderId?: string) => {
      const itemUpdates: Array<{ id: string; updates: Partial<PromptListConfig> }> = []
      const folderUpdates: Array<{ id: string; updates: Partial<ConfigFolder> }> = []

      items.forEach((item, index) => {
        if ('prompts' in item) {
          itemUpdates.push({ id: item.id, updates: { order: index, parentFolderId } })
        } else {
          folderUpdates.push({ id: item.id, updates: { order: index, parentFolderId } })
        }
      })

      if (itemUpdates.length) batchUpdatePromptLists(itemUpdates)
      if (folderUpdates.length) batchUpdatePromptListFolders(folderUpdates)
    },
    [batchUpdatePromptLists, batchUpdatePromptListFolders]
  )

  return {
    ...tree,
    batchUpdateItemsOrder,
    createConfig: settingsService.createPromptList,
    updateConfig: settingsService.updatePromptList,
    deleteConfig: settingsService.deletePromptList,
    copyConfig: settingsService.copyPromptList,
    createFolder: settingsService.createPromptListFolder,
    updateFolder: settingsService.updatePromptListFolder,
    deleteFolder: settingsService.deletePromptListFolder,
    toggleFolderExpanded: settingsService.togglePromptListFolderExpanded
  }
}
