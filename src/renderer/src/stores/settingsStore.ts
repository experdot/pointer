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
  batchUpdatePromptLists: (updates: Array<{ id: string; updates: Partial<PromptListConfig> }>) => void
  batchUpdatePromptListFolders: (
    updates: Array<{ id: string; updates: Partial<ConfigFolder> }>
  ) => void

  // 重置
  reset: () => void
}

type SettingsStore = SettingsState & SettingsActions

// 通用树操作辅助函数
function updateTreeItem<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  id: string,
  updates: Partial<T>
): ConfigTree<T> {
  return {
    ...tree,
    items: tree.items.map((item) =>
      item.id === id ? { ...item, ...updates, updatedAt: Date.now() } : item
    )
  }
}

function updateTreeFolder(
  tree: ConfigTree<ConfigItemBase>,
  id: string,
  updates: Partial<ConfigFolder>
): ConfigTree<ConfigItemBase> {
  return {
    ...tree,
    folders: tree.folders.map((f) =>
      f.id === id ? { ...f, ...updates, updatedAt: Date.now() } : f
    )
  }
}

function removeTreeFolder<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  id: string
): ConfigTree<T> {
  // 递归获取所有子文件夹 ID
  const getAllSubFolderIds = (folderId: string): string[] => {
    const subFolders = tree.folders.filter((f) => f.parentFolderId === folderId)
    return subFolders.flatMap((f) => [f.id, ...getAllSubFolderIds(f.id)])
  }
  const allFolderIds = [id, ...getAllSubFolderIds(id)]

  // 获取根目录现有项目的最大 order
  const rootItems = tree.items.filter((item) => !item.parentFolderId)
  const maxOrder = rootItems.reduce((max, item) => Math.max(max, item.order ?? 0), -1)

  // 移动项目到根目录并更新 order
  let orderOffset = 0
  const updatedItems = tree.items.map((item) => {
    if (item.parentFolderId && allFolderIds.includes(item.parentFolderId)) {
      orderOffset++
      return { ...item, parentFolderId: undefined, order: maxOrder + orderOffset }
    }
    return item
  })

  return {
    items: updatedItems,
    folders: tree.folders.filter((f) => !allFolderIds.includes(f.id))
  }
}

function batchUpdateTreeItems<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  updates: Array<{ id: string; updates: Partial<T> }>
): ConfigTree<T> {
  return {
    ...tree,
    items: tree.items.map((item) => {
      const update = updates.find((u) => u.id === item.id)
      return update ? { ...item, ...update.updates, updatedAt: Date.now() } : item
    })
  }
}

function batchUpdateTreeFolders<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  updates: Array<{ id: string; updates: Partial<ConfigFolder> }>
): ConfigTree<T> {
  return {
    ...tree,
    folders: tree.folders.map((f) => {
      const update = updates.find((u) => u.id === f.id)
      return update ? { ...f, ...update.updates, updatedAt: Date.now() } : f
    })
  }
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: initialSettings,

      // 基础设置
      setFontSize: (fontSize) =>
        set((state) => ({ settings: { ...state.settings, fontSize } })),

      setDefaultLLMId: (id) =>
        set((state) => ({ settings: { ...state.settings, defaultLLMId: id } })),

      setDefaultModelConfigId: (id) =>
        set((state) => ({ settings: { ...state.settings, defaultModelConfigId: id } })),

      // LLM 配置
      addLLMConfig: (config) =>
        set((state) => ({
          settings: {
            ...state.settings,
            llmConfigs: {
              ...state.settings.llmConfigs,
              items: [...state.settings.llmConfigs.items, config]
            }
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
            llmConfigs: {
              ...state.settings.llmConfigs,
              items: state.settings.llmConfigs.items.filter((c) => c.id !== id)
            }
          }
        })),

      addLLMConfigFolder: (folder) =>
        set((state) => ({
          settings: {
            ...state.settings,
            llmConfigs: {
              ...state.settings.llmConfigs,
              folders: [...state.settings.llmConfigs.folders, folder]
            }
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
            modelConfigs: {
              ...state.settings.modelConfigs,
              items: [...state.settings.modelConfigs.items, config]
            }
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
            modelConfigs: {
              ...state.settings.modelConfigs,
              items: state.settings.modelConfigs.items.filter((c) => c.id !== id)
            }
          }
        })),

      addModelConfigFolder: (folder) =>
        set((state) => ({
          settings: {
            ...state.settings,
            modelConfigs: {
              ...state.settings.modelConfigs,
              folders: [...state.settings.modelConfigs.folders, folder]
            }
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
            promptLists: {
              ...state.settings.promptLists,
              items: [...state.settings.promptLists.items, config]
            }
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
            promptLists: {
              ...state.settings.promptLists,
              items: state.settings.promptLists.items.filter((c) => c.id !== id)
            }
          }
        })),

      addPromptListFolder: (folder) =>
        set((state) => ({
          settings: {
            ...state.settings,
            promptLists: {
              ...state.settings.promptLists,
              folders: [...state.settings.promptLists.folders, folder]
            }
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
