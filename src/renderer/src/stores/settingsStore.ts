/**
 * 设置 Store
 *
 * 配置树的修改用领域层纯函数计算，再整体提交给内核；
 * 本地先乐观更新以保证输入跟手，内核回推 settings.changed 后以权威结果覆盖。
 */

import { create } from 'zustand'
import type { ConfigFolder, ConfigTree, LLMConfig, ModelConfig, Settings } from '@shared/domain'
import {
  addConfigFolder,
  addConfigItem,
  batchUpdateConfigFolders,
  batchUpdateConfigItems,
  clearConfigFolder,
  defaultSettings,
  removeConfigFolder,
  removeConfigItem,
  updateConfigFolder,
  updateConfigItem
} from '@shared/domain'
import { command, query } from '../runtime/client'

interface SettingsState {
  settings: Settings
  initialized: boolean
}

interface SettingsActions {
  init: () => Promise<void>

  setFontSize: (fontSize: Settings['fontSize']) => void
  setDefaultLLMId: (id: string | undefined) => void
  setDefaultModelConfigId: (id: string | undefined) => void
  setAutoCheckUpdate: (enabled: boolean) => void

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

  /** 立即把待写入的设置提交给内核（切换账户/工作区前、窗口关闭前调用） */
  flush: () => void
  reset: () => void
}

type SettingsStore = SettingsState & SettingsActions

/** 设置落盘去抖，与迁移前的写入队列保持一致 */
const SETTINGS_WRITE_DELAY = 300

export const useSettingsStore = create<SettingsStore>((set, get) => {
  /**
   * 待写入的设置文档
   *
   * 迁移前的设置写入有 300ms 去抖；迁移后每个按键都直接走
   * "命令 → 内核写盘（fsync） → 事件回推"，输入时明显卡顿。
   * 这里恢复去抖：内存立即更新，落盘合并到一次。
   */
  let pending: Settings | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = (): void => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const next = pending
    pending = null
    if (!next) return

    void command('settings.replace', { settings: next }).catch((error) => {
      console.warn('[settings] 保存失败：', error)
    })
  }

  /** 乐观更新内存状态，落盘去抖合并 */
  const commit = (settings: Settings): void => {
    set({ settings, initialized: true })
    pending = settings
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, SETTINGS_WRITE_DELAY)
  }

  const mutate = (mutator: (settings: Settings, at: number) => Settings): void => {
    commit(mutator(get().settings, Date.now()))
  }

  const mutateLlmTree = (
    mutator: (tree: ConfigTree<LLMConfig>, at: number) => ConfigTree<LLMConfig>
  ): void => {
    mutate((settings, at) => ({ ...settings, llmConfigs: mutator(settings.llmConfigs, at) }))
  }

  const mutateModelTree = (
    mutator: (tree: ConfigTree<ModelConfig>, at: number) => ConfigTree<ModelConfig>
  ): void => {
    mutate((settings, at) => ({ ...settings, modelConfigs: mutator(settings.modelConfigs, at) }))
  }

  return {
    settings: defaultSettings(),
    initialized: false,

    init: async () => {
      const settings = await query('settings.get', undefined)
      set({ settings, initialized: true })
    },

    setFontSize: (fontSize) => mutate((settings) => ({ ...settings, fontSize })),
    setDefaultLLMId: (id) => mutate((settings) => ({ ...settings, defaultLLMId: id })),
    setDefaultModelConfigId: (id) =>
      mutate((settings) => ({ ...settings, defaultModelConfigId: id })),
    setAutoCheckUpdate: (enabled) =>
      mutate((settings) => ({ ...settings, autoCheckUpdate: enabled })),

    addLLMConfig: (config) => mutateLlmTree((tree) => addConfigItem(tree, config)),
    updateLLMConfig: (id, changes) =>
      mutateLlmTree((tree, at) => updateConfigItem(tree, id, changes, at)),
    removeLLMConfig: (id) => mutateLlmTree((tree) => removeConfigItem(tree, id)),
    addLLMConfigFolder: (folder) => mutateLlmTree((tree) => addConfigFolder(tree, folder)),
    updateLLMConfigFolder: (id, changes) =>
      mutateLlmTree((tree, at) => updateConfigFolder(tree, id, changes, at)),
    removeLLMConfigFolder: (id) =>
      mutateLlmTree((tree, at) => removeConfigFolder(tree, id, 'promote', at)),
    clearLLMConfigFolder: (id) => mutateLlmTree((tree) => clearConfigFolder(tree, id)),
    batchUpdateLLMConfigs: (updates) =>
      mutateLlmTree((tree, at) => batchUpdateConfigItems(tree, updates, at)),
    batchUpdateLLMConfigFolders: (updates) =>
      mutateLlmTree((tree, at) => batchUpdateConfigFolders(tree, updates, at)),

    addModelConfig: (config) => mutateModelTree((tree) => addConfigItem(tree, config)),
    updateModelConfig: (id, changes) =>
      mutateModelTree((tree, at) => updateConfigItem(tree, id, changes, at)),
    removeModelConfig: (id) => mutateModelTree((tree) => removeConfigItem(tree, id)),
    addModelConfigFolder: (folder) => mutateModelTree((tree) => addConfigFolder(tree, folder)),
    updateModelConfigFolder: (id, changes) =>
      mutateModelTree((tree, at) => updateConfigFolder(tree, id, changes, at)),
    removeModelConfigFolder: (id) =>
      mutateModelTree((tree, at) => removeConfigFolder(tree, id, 'promote', at)),
    clearModelConfigFolder: (id) => mutateModelTree((tree) => clearConfigFolder(tree, id)),
    batchUpdateModelConfigs: (updates) =>
      mutateModelTree((tree, at) => batchUpdateConfigItems(tree, updates, at)),
    batchUpdateModelConfigFolders: (updates) =>
      mutateModelTree((tree, at) => batchUpdateConfigFolders(tree, updates, at)),

    flush,

    reset: () => {
      // 丢弃待写入内容，避免上一个账户的设置写到新账户
      pending = null
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      set({ settings: defaultSettings(), initialized: false })
    }
  }
})
