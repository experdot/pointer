import { create } from 'zustand'
import { persistence } from '../persistence/registry'
import type {
  Settings,
  ConfigTree,
  ConfigFolder,
  ConfigItemBase,
  LLMConfig,
  ModelConfig
} from '../types/type'
import type { ISettingsStore } from './interfaces/ui'
import {
  updateTreeItem,
  updateTreeFolder,
  removeTreeFolder,
  clearTreeFolder,
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
  modelConfigs: emptyTree<ModelConfig>()
}

interface SettingsState {
  settings: Settings
  initialized: boolean
}

interface SettingsActions {
  // 初始化
  init: () => Promise<void>

  // 基础设置
  setFontSize: (fontSize: Settings['fontSize']) => void
  setDefaultLLMId: (id: string | undefined) => void
  setDefaultModelConfigId: (id: string | undefined) => void
  setAutoCheckUpdate: (enabled: boolean) => void

  // LLM 配置
  addLLMConfig: (config: LLMConfig) => void
  updateLLMConfig: (id: string, changes: Partial<LLMConfig>) => void
  removeLLMConfig: (id: string) => void
  addLLMConfigFolder: (folder: ConfigFolder) => void
  updateLLMConfigFolder: (id: string, changes: Partial<ConfigFolder>) => void
  removeLLMConfigFolder: (id: string) => void
  clearLLMConfigFolder: (id: string) => void
  batchUpdateLLMConfigs: (updates: Array<{ id: string; changes: Partial<LLMConfig> }>) => void
  batchUpdateLLMConfigFolders: (
    updates: Array<{ id: string; changes: Partial<ConfigFolder> }>
  ) => void

  // Model 配置
  addModelConfig: (config: ModelConfig) => void
  updateModelConfig: (id: string, changes: Partial<ModelConfig>) => void
  removeModelConfig: (id: string) => void
  addModelConfigFolder: (folder: ConfigFolder) => void
  updateModelConfigFolder: (id: string, changes: Partial<ConfigFolder>) => void
  removeModelConfigFolder: (id: string) => void
  clearModelConfigFolder: (id: string) => void
  batchUpdateModelConfigs: (updates: Array<{ id: string; changes: Partial<ModelConfig> }>) => void
  batchUpdateModelConfigFolders: (
    updates: Array<{ id: string; changes: Partial<ConfigFolder> }>
  ) => void

  // 重置
  reset: () => Promise<void>
}

type SettingsStore = SettingsState & SettingsActions

// 持久化辅助函数
const persist = (settings: Settings): void => {
  persistence.settings.put(settings)
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: initialSettings,
  initialized: false,

  init: async () => {
    const settings = await persistence.settings.get()
    set({
      settings: settings ? { ...initialSettings, ...settings } : initialSettings,
      initialized: true
    })
  },

  // 基础设置
  setFontSize: (fontSize) => {
    set((state) => {
      const settings = { ...state.settings, fontSize }
      persist(settings)
      return { settings }
    })
  },

  setDefaultLLMId: (id) => {
    set((state) => {
      const settings = { ...state.settings, defaultLLMId: id }
      persist(settings)
      return { settings }
    })
  },

  setDefaultModelConfigId: (id) => {
    set((state) => {
      const settings = { ...state.settings, defaultModelConfigId: id }
      persist(settings)
      return { settings }
    })
  },

  setAutoCheckUpdate: (enabled) => {
    set((state) => {
      const settings = { ...state.settings, autoCheckUpdate: enabled }
      persist(settings)
      return { settings }
    })
  },

  // LLM 配置
  addLLMConfig: (config) => {
    set((state) => {
      const settings = {
        ...state.settings,
        llmConfigs: addTreeItem(state.settings.llmConfigs, config)
      }
      persist(settings)
      return { settings }
    })
  },

  updateLLMConfig: (id, updates) => {
    set((state) => {
      const settings = {
        ...state.settings,
        llmConfigs: updateTreeItem(state.settings.llmConfigs, id, updates)
      }
      persist(settings)
      return { settings }
    })
  },

  removeLLMConfig: (id) => {
    set((state) => {
      const settings = {
        ...state.settings,
        llmConfigs: removeTreeItem(state.settings.llmConfigs, id)
      }
      persist(settings)
      return { settings }
    })
  },

  addLLMConfigFolder: (folder) => {
    set((state) => {
      const settings = {
        ...state.settings,
        llmConfigs: addTreeFolder(state.settings.llmConfigs, folder)
      }
      persist(settings)
      return { settings }
    })
  },

  updateLLMConfigFolder: (id, updates) => {
    set((state) => {
      const settings = {
        ...state.settings,
        llmConfigs: updateTreeFolder(
          state.settings.llmConfigs,
          id,
          updates
        ) as ConfigTree<LLMConfig>
      }
      persist(settings)
      return { settings }
    })
  },

  removeLLMConfigFolder: (id) => {
    set((state) => {
      const settings = {
        ...state.settings,
        llmConfigs: removeTreeFolder(state.settings.llmConfigs, id)
      }
      persist(settings)
      return { settings }
    })
  },

  clearLLMConfigFolder: (id) => {
    set((state) => {
      const settings = {
        ...state.settings,
        llmConfigs: clearTreeFolder(state.settings.llmConfigs, id)
      }
      persist(settings)
      return { settings }
    })
  },

  batchUpdateLLMConfigs: (updates) => {
    set((state) => {
      const settings = {
        ...state.settings,
        llmConfigs: batchUpdateTreeItems(state.settings.llmConfigs, updates)
      }
      persist(settings)
      return { settings }
    })
  },

  batchUpdateLLMConfigFolders: (updates) => {
    set((state) => {
      const settings = {
        ...state.settings,
        llmConfigs: batchUpdateTreeFolders(state.settings.llmConfigs, updates)
      }
      persist(settings)
      return { settings }
    })
  },

  // Model 配置
  addModelConfig: (config) => {
    set((state) => {
      const settings = {
        ...state.settings,
        modelConfigs: addTreeItem(state.settings.modelConfigs, config)
      }
      persist(settings)
      return { settings }
    })
  },

  updateModelConfig: (id, updates) => {
    set((state) => {
      const settings = {
        ...state.settings,
        modelConfigs: updateTreeItem(state.settings.modelConfigs, id, updates)
      }
      persist(settings)
      return { settings }
    })
  },

  removeModelConfig: (id) => {
    set((state) => {
      const settings = {
        ...state.settings,
        modelConfigs: removeTreeItem(state.settings.modelConfigs, id)
      }
      persist(settings)
      return { settings }
    })
  },

  addModelConfigFolder: (folder) => {
    set((state) => {
      const settings = {
        ...state.settings,
        modelConfigs: addTreeFolder(state.settings.modelConfigs, folder)
      }
      persist(settings)
      return { settings }
    })
  },

  updateModelConfigFolder: (id, updates) => {
    set((state) => {
      const settings = {
        ...state.settings,
        modelConfigs: updateTreeFolder(
          state.settings.modelConfigs,
          id,
          updates
        ) as ConfigTree<ModelConfig>
      }
      persist(settings)
      return { settings }
    })
  },

  removeModelConfigFolder: (id) => {
    set((state) => {
      const settings = {
        ...state.settings,
        modelConfigs: removeTreeFolder(state.settings.modelConfigs, id)
      }
      persist(settings)
      return { settings }
    })
  },

  clearModelConfigFolder: (id) => {
    set((state) => {
      const settings = {
        ...state.settings,
        modelConfigs: clearTreeFolder(state.settings.modelConfigs, id)
      }
      persist(settings)
      return { settings }
    })
  },

  batchUpdateModelConfigs: (updates) => {
    set((state) => {
      const settings = {
        ...state.settings,
        modelConfigs: batchUpdateTreeItems(state.settings.modelConfigs, updates)
      }
      persist(settings)
      return { settings }
    })
  },

  batchUpdateModelConfigFolders: (updates) => {
    set((state) => {
      const settings = {
        ...state.settings,
        modelConfigs: batchUpdateTreeFolders(state.settings.modelConfigs, updates)
      }
      persist(settings)
      return { settings }
    })
  },

  reset: async () => {
    // Only reset memory state, don't clear persistence data
    set({ settings: initialSettings, initialized: false })
  }
}))

/**
 * 获取设置 Store 的接口实现
 */
export function getSettingsStoreInterface(): ISettingsStore {
  const store = useSettingsStore
  return {
    get initialized() {
      return store.getState().initialized
    },
    get settings() {
      return store.getState().settings
    },
    init: () => store.getState().init(),
    reset: () => store.getState().reset(),
    setFontSize: (size) => store.getState().setFontSize(size),
    setDefaultLLMId: (id) => store.getState().setDefaultLLMId(id),
    setDefaultModelConfigId: (id) => store.getState().setDefaultModelConfigId(id),
    setAutoCheckUpdate: (enabled) => store.getState().setAutoCheckUpdate(enabled),
    addLLMConfig: (config) => store.getState().addLLMConfig(config),
    updateLLMConfig: (id, changes) => store.getState().updateLLMConfig(id, changes),
    removeLLMConfig: (id) => store.getState().removeLLMConfig(id),
    addLLMConfigFolder: (folder) => store.getState().addLLMConfigFolder(folder),
    updateLLMConfigFolder: (id, changes) => store.getState().updateLLMConfigFolder(id, changes),
    removeLLMConfigFolder: (id) => store.getState().removeLLMConfigFolder(id),
    clearLLMConfigFolder: (id) => store.getState().clearLLMConfigFolder(id),
    addModelConfig: (config) => store.getState().addModelConfig(config),
    updateModelConfig: (id, changes) => store.getState().updateModelConfig(id, changes),
    removeModelConfig: (id) => store.getState().removeModelConfig(id),
    addModelConfigFolder: (folder) => store.getState().addModelConfigFolder(folder),
    updateModelConfigFolder: (id, changes) => store.getState().updateModelConfigFolder(id, changes),
    removeModelConfigFolder: (id) => store.getState().removeModelConfigFolder(id),
    clearModelConfigFolder: (id) => store.getState().clearModelConfigFolder(id),
    batchUpdateLLMConfigs: (updates) => store.getState().batchUpdateLLMConfigs(updates),
    batchUpdateLLMConfigFolders: (updates) => store.getState().batchUpdateLLMConfigFolders(updates),
    batchUpdateModelConfigs: (updates) => store.getState().batchUpdateModelConfigs(updates),
    batchUpdateModelConfigFolders: (updates) =>
      store.getState().batchUpdateModelConfigFolders(updates)
  }
}
