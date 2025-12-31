import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Settings,
  ConfigTree,
  ConfigFolder,
  ConfigItemBase,
  LLMConfig,
  ModelConfig,
  PromptListConfig
} from '../types/type'
import { createIndexedDBStorage } from '../utils/indexedDB'
import { registerStoreReset } from '../utils/storeRegistry'
import {
  updateTreeItem,
  updateTreeFolder,
  removeTreeFolder,
  removeTreeItem,
  addTreeItem,
  addTreeFolder,
  batchUpdateTreeItems,
  batchUpdateTreeFolders
} from '../utils/treeUtils'

// 空树结构
const emptyTree = <T extends ConfigItemBase>(): ConfigTree<T> => ({
  items: [],
  folders: []
})

// 初始设置
const initialSettings: Settings = {
  fontSize: 'medium',
  llmConfigs: emptyTree<LLMConfig>(),
  modelConfigs: emptyTree<ModelConfig>(),
  promptLists: emptyTree<PromptListConfig>()
}

interface SettingsState {
  settings: Settings
}

interface SettingsActions {
  // 基础设置
  setFontSize: (fontSize: Settings['fontSize']) => void
  setDefaultLLMId: (id: string | undefined) => void
  setDefaultModelConfigId: (id: string | undefined) => void

  // LLM 配置
  addLLMConfig: (config: LLMConfig) => void
  updateLLMConfig: (id: string, updates: Partial<LLMConfig>) => void
  removeLLMConfig: (id: string) => void
  addLLMConfigFolder: (folder: ConfigFolder) => void
  updateLLMConfigFolder: (id: string, updates: Partial<ConfigFolder>) => void
  removeLLMConfigFolder: (id: string) => void
  batchUpdateLLMConfigs: (updates: Array<{ id: string; updates: Partial<LLMConfig> }>) => void
  batchUpdateLLMConfigFolders: (
    updates: Array<{ id: string; updates: Partial<ConfigFolder> }>
  ) => void

  // Model 配置
  addModelConfig: (config: ModelConfig) => void
  updateModelConfig: (id: string, updates: Partial<ModelConfig>) => void
  removeModelConfig: (id: string) => void
  addModelConfigFolder: (folder: ConfigFolder) => void
  updateModelConfigFolder: (id: string, updates: Partial<ConfigFolder>) => void
  removeModelConfigFolder: (id: string) => void
  batchUpdateModelConfigs: (updates: Array<{ id: string; updates: Partial<ModelConfig> }>) => void
  batchUpdateModelConfigFolders: (
    updates: Array<{ id: string; updates: Partial<ConfigFolder> }>
  ) => void

  // 提示词列表
  addPromptList: (config: PromptListConfig) => void
  updatePromptList: (id: string, updates: Partial<PromptListConfig>) => void
  removePromptList: (id: string) => void
  addPromptListFolder: (folder: ConfigFolder) => void
  updatePromptListFolder: (id: string, updates: Partial<ConfigFolder>) => void
  removePromptListFolder: (id: string) => void
  batchUpdatePromptLists: (
    updates: Array<{ id: string; updates: Partial<PromptListConfig> }>
  ) => void
  batchUpdatePromptListFolders: (
    updates: Array<{ id: string; updates: Partial<ConfigFolder> }>
  ) => void

  // 重置
  reset: () => void
}

type SettingsStore = SettingsState & SettingsActions

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: initialSettings,

      // 基础设置
      setFontSize: (fontSize) => set((state) => ({ settings: { ...state.settings, fontSize } })),

      setDefaultLLMId: (id) =>
        set((state) => ({ settings: { ...state.settings, defaultLLMId: id } })),

      setDefaultModelConfigId: (id) =>
        set((state) => ({ settings: { ...state.settings, defaultModelConfigId: id } })),

      // LLM 配置
      addLLMConfig: (config) =>
        set((state) => ({
          settings: {
            ...state.settings,
            llmConfigs: addTreeItem(state.settings.llmConfigs, config)
          }
        })),

      updateLLMConfig: (id, updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            llmConfigs: updateTreeItem(state.settings.llmConfigs, id, updates)
          }
        })),

      removeLLMConfig: (id) =>
        set((state) => ({
          settings: {
            ...state.settings,
            llmConfigs: removeTreeItem(state.settings.llmConfigs, id)
          }
        })),

      addLLMConfigFolder: (folder) =>
        set((state) => ({
          settings: {
            ...state.settings,
            llmConfigs: addTreeFolder(state.settings.llmConfigs, folder)
          }
        })),

      updateLLMConfigFolder: (id, updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            llmConfigs: updateTreeFolder(
              state.settings.llmConfigs,
              id,
              updates
            ) as ConfigTree<LLMConfig>
          }
        })),

      removeLLMConfigFolder: (id) =>
        set((state) => ({
          settings: {
            ...state.settings,
            llmConfigs: removeTreeFolder(state.settings.llmConfigs, id)
          }
        })),

      batchUpdateLLMConfigs: (updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            llmConfigs: batchUpdateTreeItems(state.settings.llmConfigs, updates)
          }
        })),

      batchUpdateLLMConfigFolders: (updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            llmConfigs: batchUpdateTreeFolders(state.settings.llmConfigs, updates)
          }
        })),

      // Model 配置
      addModelConfig: (config) =>
        set((state) => ({
          settings: {
            ...state.settings,
            modelConfigs: addTreeItem(state.settings.modelConfigs, config)
          }
        })),

      updateModelConfig: (id, updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            modelConfigs: updateTreeItem(state.settings.modelConfigs, id, updates)
          }
        })),

      removeModelConfig: (id) =>
        set((state) => ({
          settings: {
            ...state.settings,
            modelConfigs: removeTreeItem(state.settings.modelConfigs, id)
          }
        })),

      addModelConfigFolder: (folder) =>
        set((state) => ({
          settings: {
            ...state.settings,
            modelConfigs: addTreeFolder(state.settings.modelConfigs, folder)
          }
        })),

      updateModelConfigFolder: (id, updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            modelConfigs: updateTreeFolder(
              state.settings.modelConfigs,
              id,
              updates
            ) as ConfigTree<ModelConfig>
          }
        })),

      removeModelConfigFolder: (id) =>
        set((state) => ({
          settings: {
            ...state.settings,
            modelConfigs: removeTreeFolder(state.settings.modelConfigs, id)
          }
        })),

      batchUpdateModelConfigs: (updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            modelConfigs: batchUpdateTreeItems(state.settings.modelConfigs, updates)
          }
        })),

      batchUpdateModelConfigFolders: (updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            modelConfigs: batchUpdateTreeFolders(state.settings.modelConfigs, updates)
          }
        })),

      // 提示词列表
      addPromptList: (config) =>
        set((state) => ({
          settings: {
            ...state.settings,
            promptLists: addTreeItem(state.settings.promptLists, config)
          }
        })),

      updatePromptList: (id, updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            promptLists: updateTreeItem(state.settings.promptLists, id, updates)
          }
        })),

      removePromptList: (id) =>
        set((state) => ({
          settings: {
            ...state.settings,
            promptLists: removeTreeItem(state.settings.promptLists, id)
          }
        })),

      addPromptListFolder: (folder) =>
        set((state) => ({
          settings: {
            ...state.settings,
            promptLists: addTreeFolder(state.settings.promptLists, folder)
          }
        })),

      updatePromptListFolder: (id, updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            promptLists: updateTreeFolder(
              state.settings.promptLists,
              id,
              updates
            ) as ConfigTree<PromptListConfig>
          }
        })),

      removePromptListFolder: (id) =>
        set((state) => ({
          settings: {
            ...state.settings,
            promptLists: removeTreeFolder(state.settings.promptLists, id)
          }
        })),

      batchUpdatePromptLists: (updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            promptLists: batchUpdateTreeItems(state.settings.promptLists, updates)
          }
        })),

      batchUpdatePromptListFolders: (updates) =>
        set((state) => ({
          settings: {
            ...state.settings,
            promptLists: batchUpdateTreeFolders(state.settings.promptLists, updates)
          }
        })),

      reset: () => set({ settings: initialSettings })
    }),
    {
      name: 'settings-store',
      storage: createIndexedDBStorage(),
      skipHydration: true,
      partialize: (state) => ({ settings: state.settings })
    }
  )
)

// 注册重置回调
registerStoreReset(
  () => useSettingsStore.getState().reset(),
  () => useSettingsStore.persist.rehydrate()
)
