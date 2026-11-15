/**
 * 设置 Store
 *
 * 配置树的修改用领域层纯函数计算，再整体提交给内核；
 * 本地先乐观更新以保证输入跟手，内核回推 settings.changed 后以权威结果覆盖。
 */

import { create } from 'zustand'
import type {
  ConfigFolder,
  ConfigTree,
  LLMConfig,
  ModelConfig,
  Settings,
  TreeMove,
  ConfigInsertPosition
} from '@shared/domain'
import {
  configInsertPosition,
  moveConfigNode,
  addConfigFolder,
  addConfigItem,
  clearConfigFolder,
  defaultSettings,
  removeConfigFolder,
  removeConfigItem,
  updateConfigFolder,
  updateConfigItem
} from '@shared/domain'
import type { SettingsSnapshot } from '@shared/contracts'
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

  addLLMConfig: (config: LLMConfig, position?: ConfigInsertPosition) => void
  updateLLMConfig: (id: string, changes: Partial<LLMConfig>) => void
  removeLLMConfig: (id: string) => void
  moveLLMNode: (move: TreeMove) => void
  addLLMConfigFolder: (folder: ConfigFolder, position?: ConfigInsertPosition) => void
  updateLLMConfigFolder: (id: string, changes: Partial<ConfigFolder>) => void
  removeLLMConfigFolder: (id: string) => void
  clearLLMConfigFolder: (id: string) => void

  addModelConfig: (config: ModelConfig, position?: ConfigInsertPosition) => void
  updateModelConfig: (id: string, changes: Partial<ModelConfig>) => void
  removeModelConfig: (id: string) => void
  moveModelNode: (move: TreeMove) => void
  addModelConfigFolder: (folder: ConfigFolder, position?: ConfigInsertPosition) => void
  updateModelConfigFolder: (id: string, changes: Partial<ConfigFolder>) => void
  removeModelConfigFolder: (id: string) => void
  clearModelConfigFolder: (id: string) => void

  /** 立即把待写入的设置提交给内核（切换账户/工作区前、窗口关闭前调用） */
  flush: () => Promise<void>
  accept: (snapshot: SettingsSnapshot) => void
  reset: () => void
}

type SettingsStore = SettingsState & SettingsActions

/** 设置落盘去抖，与迁移前的写入队列保持一致 */
const SETTINGS_WRITE_DELAY = 300

export const useSettingsStore = create<SettingsStore>((set, get) => {
  let revision = 0
  let generation = 0
  let confirmed: Settings = defaultSettings()
  let pending: Array<{ id: string; apply: (settings: Settings) => Settings }> = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight: Promise<void> | null = null

  const accept = (snapshot: SettingsSnapshot): void => {
    if (snapshot.revision < revision) return
    revision = snapshot.revision
    confirmed = snapshot.settings
    const acknowledged = pending.findIndex((item) => item.id === snapshot.mutationId)
    if (acknowledged >= 0) pending = pending.slice(acknowledged + 1)
    set({
      settings: pending.reduce((value, item) => item.apply(value), confirmed),
      initialized: true
    })
  }

  const flush = async (): Promise<void> => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (inFlight) {
      await inFlight
      return flush()
    }
    if (!pending.length) return
    const epoch = generation
    const batch = [...pending]
    const mutationId = batch.at(-1)!.id
    const next = batch.reduce((value, item) => item.apply(value), confirmed)
    if (next === confirmed) {
      pending = pending.slice(batch.length)
      set({ settings: confirmed })
      return
    }
    inFlight = (async () => {
      try {
        const snapshot = await command('settings.replace', {
          settings: next,
          baseRevision: revision,
          mutationId
        })
        if (epoch === generation) accept(snapshot)
      } catch (error) {
        const conflict = error as { code?: string; details?: SettingsSnapshot }
        if (epoch === generation && conflict.code === 'settings.conflict' && conflict.details)
          accept(conflict.details)
        else throw error
      }
    })()
    try {
      await inFlight
    } finally {
      inFlight = null
    }
    if (epoch === generation && pending.length) await flush()
  }

  const mutate = (mutator: (settings: Settings, at: number) => Settings): void => {
    const at = Date.now()
    const apply = (settings: Settings): Settings => mutator(settings, at)
    const next = apply(get().settings)
    if (next === get().settings) return
    pending.push({ id: crypto.randomUUID(), apply })
    set({ settings: next, initialized: true })
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      void flush().catch((error) => console.warn('[settings] 保存失败，保留待保存修改：', error))
    }, SETTINGS_WRITE_DELAY)
  }

  const mutateLlmTree = (
    mutator: (tree: ConfigTree<LLMConfig>, at: number) => ConfigTree<LLMConfig>
  ): void => {
    mutate((settings, at) => {
      const llmConfigs = mutator(settings.llmConfigs, at)
      if (llmConfigs === settings.llmConfigs) return settings
      return {
        ...settings,
        llmConfigs,
        defaultLLMId: llmConfigs.items.some((item) => item.id === settings.defaultLLMId)
          ? settings.defaultLLMId
          : undefined
      }
    })
  }

  const mutateModelTree = (
    mutator: (tree: ConfigTree<ModelConfig>, at: number) => ConfigTree<ModelConfig>
  ): void => {
    mutate((settings, at) => {
      const modelConfigs = mutator(settings.modelConfigs, at)
      if (modelConfigs === settings.modelConfigs) return settings
      return {
        ...settings,
        modelConfigs,
        defaultModelConfigId: modelConfigs.items.some(
          (item) => item.id === settings.defaultModelConfigId
        )
          ? settings.defaultModelConfigId
          : undefined
      }
    })
  }

  return {
    settings: defaultSettings(),
    initialized: false,

    init: async () => {
      accept(await query('settings.get', undefined))
    },

    setFontSize: (fontSize) => mutate((settings) => ({ ...settings, fontSize })),
    setDefaultLLMId: (id) => mutate((settings) => ({ ...settings, defaultLLMId: id })),
    setDefaultModelConfigId: (id) =>
      mutate((settings) => ({ ...settings, defaultModelConfigId: id })),
    setAutoCheckUpdate: (enabled) =>
      mutate((settings) => ({ ...settings, autoCheckUpdate: enabled })),

    addLLMConfig: (config, position) =>
      mutateLlmTree((tree) =>
        addConfigItem(tree, {
          ...config,
          ...configInsertPosition(tree, position ?? { parentFolderId: config.parentFolderId })
        })
      ),
    moveLLMNode: (move) =>
      mutateLlmTree((tree, at) => {
        const result = moveConfigNode(tree, move, at)
        if (!result.ok) throw new Error(result.error.message)
        return result.tree
      }),
    updateLLMConfig: (id, changes) =>
      mutateLlmTree((tree, at) => updateConfigItem(tree, id, changes, at)),
    removeLLMConfig: (id) => mutateLlmTree((tree) => removeConfigItem(tree, id)),
    addLLMConfigFolder: (folder, position) =>
      mutateLlmTree((tree) =>
        addConfigFolder(tree, {
          ...folder,
          ...configInsertPosition(tree, position ?? { parentFolderId: folder.parentFolderId })
        })
      ),
    updateLLMConfigFolder: (id, changes) =>
      mutateLlmTree((tree, at) => updateConfigFolder(tree, id, changes, at)),
    removeLLMConfigFolder: (id) =>
      mutateLlmTree((tree, at) => removeConfigFolder(tree, id, 'promote', at)),
    clearLLMConfigFolder: (id) => mutateLlmTree((tree) => clearConfigFolder(tree, id)),

    addModelConfig: (config, position) =>
      mutateModelTree((tree) =>
        addConfigItem(tree, {
          ...config,
          ...configInsertPosition(tree, position ?? { parentFolderId: config.parentFolderId })
        })
      ),
    moveModelNode: (move) =>
      mutateModelTree((tree, at) => {
        const result = moveConfigNode(tree, move, at)
        if (!result.ok) throw new Error(result.error.message)
        return result.tree
      }),
    updateModelConfig: (id, changes) =>
      mutateModelTree((tree, at) => updateConfigItem(tree, id, changes, at)),
    removeModelConfig: (id) => mutateModelTree((tree) => removeConfigItem(tree, id)),
    addModelConfigFolder: (folder, position) =>
      mutateModelTree((tree) =>
        addConfigFolder(tree, {
          ...folder,
          ...configInsertPosition(tree, position ?? { parentFolderId: folder.parentFolderId })
        })
      ),
    updateModelConfigFolder: (id, changes) =>
      mutateModelTree((tree, at) => updateConfigFolder(tree, id, changes, at)),
    removeModelConfigFolder: (id) =>
      mutateModelTree((tree, at) => removeConfigFolder(tree, id, 'promote', at)),
    clearModelConfigFolder: (id) => mutateModelTree((tree) => clearConfigFolder(tree, id)),

    flush,
    accept,

    reset: () => {
      // 丢弃待写入内容，避免上一个账户的设置写到新账户
      generation++
      pending = []
      confirmed = defaultSettings()
      revision = 0
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      set({ settings: defaultSettings(), initialized: false })
    }
  }
})
