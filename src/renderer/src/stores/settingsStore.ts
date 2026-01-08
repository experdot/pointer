import { create } from 'zustand'
import * as db from '../utils/database'
import type {
  Settings,
  ConfigTree,
  ConfigFolder,
  ConfigItemBase,
  LLMConfig,
  ModelConfig
} from '../types/type'
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

  // 重置
  reset: () => Promise<void>
}

type SettingsStore = SettingsState & SettingsActions

// 持久化辅助函数
const persist = (settings: Settings): void => {
  db.putSettings(settings)
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: initialSettings,
  initialized: false,

  init: async () => {
    const settings = await db.getSettings()
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
    await db.clearSettings()
    set({ settings: initialSettings, initialized: false })
  }
}))
