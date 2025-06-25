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
      const newConfigs = [...(state.settings.llmConfigs || []), config]
      updateSettings({ llmConfigs: newConfigs })
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
      const newConfigs = state.settings.llmConfigs?.filter((config) => config.id !== configId) || []
      let newDefaultLLMId = state.settings.defaultLLMId

      // 如果删除的是默认配置，清除默认设置
      if (state.settings.defaultLLMId === configId) {
        newDefaultLLMId = undefined
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
      theme: 'light',
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
