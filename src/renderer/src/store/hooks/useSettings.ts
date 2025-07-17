import { useCallback } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'
import { Settings, LLMConfig } from '../../types/type'
import { StorageService } from '../../services/storageService'

export function useSettings() {
  const settingsStore = useSettingsStore()

  const updateSettings = useCallback(
    (newSettings: Partial<Settings>) => {
      settingsStore.updateSettings(newSettings)
      // 立即保存设置到存储
      StorageService.saveSettings(settingsStore.settings)
    },
    [settingsStore]
  )

  const addLLMConfig = useCallback(
    (config: LLMConfig) => {
      settingsStore.addLLMConfig(config)
      StorageService.saveSettings(settingsStore.settings)
    },
    [settingsStore]
  )

  const updateLLMConfig = useCallback(
    (id: string, updates: Partial<LLMConfig>) => {
      settingsStore.updateLLMConfig(id, updates)
      StorageService.saveSettings(settingsStore.settings)
    },
    [settingsStore]
  )

  const deleteLLMConfig = useCallback(
    (id: string) => {
      settingsStore.deleteLLMConfig(id)
      StorageService.saveSettings(settingsStore.settings)
    },
    [settingsStore]
  )

  const setDefaultLLM = useCallback(
    (id: string) => {
      settingsStore.setDefaultLLM(id)
      StorageService.saveSettings(settingsStore.settings)
    },
    [settingsStore]
  )

  const setFontSize = useCallback(
    (size: 'small' | 'medium' | 'large') => {
      settingsStore.setFontSize(size)
      StorageService.saveSettings(settingsStore.settings)
    },
    [settingsStore]
  )

  const getLLMConfig = useCallback(
    (id: string) => {
      return settingsStore.getLLMConfig(id)
    },
    [settingsStore]
  )

  const getDefaultLLMConfig = useCallback(() => {
    return settingsStore.getDefaultLLMConfig()
  }, [settingsStore])

  const validateLLMConfig = useCallback(
    (config: Partial<LLMConfig>) => {
      return settingsStore.validateLLMConfig(config)
    },
    [settingsStore]
  )

  const resetSettings = useCallback(() => {
    settingsStore.resetSettings()
    StorageService.saveSettings(settingsStore.settings)
  }, [settingsStore])

  const exportSettings = useCallback(() => {
    return settingsStore.exportSettings()
  }, [settingsStore])

  const importSettings = useCallback(
    (settings: Settings) => {
      settingsStore.importSettings(settings)
      StorageService.saveSettings(settingsStore.settings)
    },
    [settingsStore]
  )

  return {
    settings: settingsStore.settings,
    updateSettings,
    addLLMConfig,
    updateLLMConfig,
    deleteLLMConfig,
    setDefaultLLM,
    setFontSize,
    getLLMConfig,
    getDefaultLLMConfig,
    validateLLMConfig,
    resetSettings,
    exportSettings,
    importSettings
  }
}
