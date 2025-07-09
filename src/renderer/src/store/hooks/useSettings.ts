import { useCallback } from 'react'
import { useAppContext } from '../AppContext'
import { Settings, LLMConfig } from '../../types'
import { StorageService } from '../../utils/storage'

export function useSettings() {
  const { state, dispatch } = useAppContext()

  const updateSettings = useCallback(
    (newSettings: Partial<Settings>) => {
      const updatedSettings = { ...state.settings, ...newSettings }

      dispatch({
        type: 'UPDATE_SETTINGS',
        payload: updatedSettings
      })

      // 立即保存设置到存储
      StorageService.saveSettings(updatedSettings)
    },
    [state.settings, dispatch]
  )

  const addLLMConfig = useCallback(
    (config: LLMConfig) => {
      const currentConfigs = state.settings.llmConfigs || []
      const isFirstConfig = currentConfigs.length === 0

      // 如果是第一个配置，自动设为默认
      const newConfig = isFirstConfig ? { ...config, isDefault: true } : config
      const newConfigs = [...currentConfigs, newConfig]

      // 如果是第一个配置，更新defaultLLMId
      const updatedSettings: Partial<Settings> = {
        llmConfigs: newConfigs
      }

      if (isFirstConfig) {
        updatedSettings.defaultLLMId = newConfig.id
      }

      updateSettings(updatedSettings)
    },
    [state.settings.llmConfigs, updateSettings]
  )

  const updateLLMConfig = useCallback(
    (configId: string, updates: Partial<LLMConfig>) => {
      const newConfigs =
        state.settings.llmConfigs?.map((config) =>
          config.id === configId ? { ...config, ...updates } : config
        ) || []
      updateSettings({ llmConfigs: newConfigs })
    },
    [state.settings.llmConfigs, updateSettings]
  )

  const deleteLLMConfig = useCallback(
    (configId: string) => {
      const currentConfigs = state.settings.llmConfigs || []
      const newConfigs = currentConfigs.filter((config) => config.id !== configId)
      let newDefaultLLMId = state.settings.defaultLLMId

      // 如果删除的是默认配置，需要选择新的默认配置
      if (state.settings.defaultLLMId === configId) {
        if (newConfigs.length > 0) {
          // 选择第一个配置作为新的默认配置
          const newDefaultConfig = newConfigs[0]
          newDefaultLLMId = newDefaultConfig.id

          // 更新配置列表，设置新的默认配置
          newConfigs[0] = { ...newDefaultConfig, isDefault: true }
        } else {
          // 如果没有剩余配置，清除默认设置
          newDefaultLLMId = undefined
        }
      }

      updateSettings({
        llmConfigs: newConfigs,
        defaultLLMId: newDefaultLLMId
      })
    },
    [state.settings.llmConfigs, state.settings.defaultLLMId, updateSettings]
  )

  const setDefaultLLM = useCallback(
    (configId: string) => {
      const newConfigs =
        state.settings.llmConfigs?.map((config) => ({
          ...config,
          isDefault: config.id === configId
        })) || []

      updateSettings({
        llmConfigs: newConfigs,
        defaultLLMId: configId
      })
    },
    [state.settings.llmConfigs, updateSettings]
  )

  const resetSettings = useCallback(() => {
    const defaultSettings: Settings = {
      llmConfigs: [],
      defaultLLMId: undefined,
      fontSize: 'medium'
    }

    updateSettings(defaultSettings)
  }, [updateSettings])

  const exportSettings = useCallback(() => {
    return StorageService.exportData()
  }, [])

  const importSettings = useCallback(
    (dataString: string) => {
      const success = StorageService.importData(dataString)
      if (success) {
        // 重新加载状态
        const savedState = StorageService.loadAppState()
        if (savedState) {
          dispatch({ type: 'LOAD_STATE', payload: savedState })
        }
      }
      return success
    },
    [dispatch]
  )

  return {
    settings: state.settings,
    updateSettings,
    addLLMConfig,
    updateLLMConfig,
    deleteLLMConfig,
    setDefaultLLM,
    resetSettings,
    exportSettings,
    importSettings
  }
}
