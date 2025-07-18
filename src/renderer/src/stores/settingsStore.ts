import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { Settings, LLMConfig } from '../types/type'
import { createPersistConfig, handleStoreError } from './persistence/storeConfig'
import { INITIAL_SETTINGS } from './helpers/constants'

export interface SettingsState {
  settings: Settings
}

export interface SettingsActions {
  // 设置管理
  updateSettings: (updates: Partial<Settings>) => void
  resetSettings: () => void

  // LLM配置管理
  addLLMConfig: (config: LLMConfig) => void
  updateLLMConfig: (id: string, updates: Partial<LLMConfig>) => void
  deleteLLMConfig: (id: string) => void
  setDefaultLLM: (id: string) => void
  getLLMConfig: (id: string) => LLMConfig | undefined
  getDefaultLLMConfig: () => LLMConfig | undefined

  // 外观设置
  setFontSize: (size: 'small' | 'medium' | 'large') => void

  // 工具方法
  exportSettings: () => Settings
  importSettings: (settings: Settings) => void
  validateLLMConfig: (config: Partial<LLMConfig>) => boolean
}

const initialState: SettingsState = {
  settings: INITIAL_SETTINGS
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // 设置管理
      updateSettings: (updates) => {
        try {
          set((state) => {
            // 如果payload包含所有必需的设置字段，则完全替换；否则合并
            const isCompleteSettings =
              updates.llmConfigs !== undefined && updates.fontSize !== undefined

            if (isCompleteSettings) {
              state.settings = { ...updates } as Settings
            } else {
              state.settings = { ...state.settings, ...updates }
            }
          })
        } catch (error) {
          handleStoreError('settingsStore', 'updateSettings', error)
        }
      },

      resetSettings: () => {
        set((state) => {
          state.settings = INITIAL_SETTINGS
        })
      },

      // LLM配置管理
      addLLMConfig: (config) => {
        try {
          set((state) => {
            // 如果是第一个配置，自动设为默认
            if (state.settings.llmConfigs.length === 0) {
              state.settings.defaultLLMId = config.id
            }

            state.settings.llmConfigs.push(config)
          })
        } catch (error) {
          handleStoreError('settingsStore', 'addLLMConfig', error)
        }
      },

      updateLLMConfig: (id, updates) => {
        try {
          set((state) => {
            const configIndex = state.settings.llmConfigs.findIndex((c) => c.id === id)
            if (configIndex !== -1) {
              const updatedConfig = { ...state.settings.llmConfigs[configIndex], ...updates }
              state.settings.llmConfigs[configIndex] = updatedConfig
            }
          })
        } catch (error) {
          handleStoreError('settingsStore', 'updateLLMConfig', error)
        }
      },

      deleteLLMConfig: (id) => {
        try {
          set((state) => {
            state.settings.llmConfigs = state.settings.llmConfigs.filter((c) => c.id !== id)

            // 如果删除的是默认配置，选择新的默认配置
            if (state.settings.defaultLLMId === id) {
              if (state.settings.llmConfigs.length > 0) {
                state.settings.defaultLLMId = state.settings.llmConfigs[0].id
              } else {
                state.settings.defaultLLMId = undefined
              }
            }
          })
        } catch (error) {
          handleStoreError('settingsStore', 'deleteLLMConfig', error)
        }
      },

      setDefaultLLM: (id) => {
        try {
          set((state) => {
            state.settings.defaultLLMId = id
          })
        } catch (error) {
          handleStoreError('settingsStore', 'setDefaultLLM', error)
        }
      },

      getLLMConfig: (id) => {
        return get().settings.llmConfigs.find((c) => c.id === id)
      },

      getDefaultLLMConfig: () => {
        const { settings } = get()
        if (settings.defaultLLMId) {
          return settings.llmConfigs.find((c) => c.id === settings.defaultLLMId)
        }
        return settings.llmConfigs[0]
      },

      // 外观设置
      setFontSize: (size) => {
        try {
          set((state) => {
            state.settings.fontSize = size
          })
        } catch (error) {
          handleStoreError('settingsStore', 'setFontSize', error)
        }
      },

      // 工具方法
      exportSettings: () => {
        return get().settings
      },

      importSettings: (settings) => {
        try {
          set((state) => {
            state.settings = settings
          })
        } catch (error) {
          handleStoreError('settingsStore', 'importSettings', error)
        }
      },

      validateLLMConfig: (config) => {
        try {
          return !!(config.name && config.apiHost && config.apiKey && config.modelName)
        } catch (error) {
          handleStoreError('settingsStore', 'validateLLMConfig', error)
          return false
        }
      }
    })),
    createPersistConfig('settings-store', 1, (state) => ({
      settings: state.settings
    }))
  )
)
