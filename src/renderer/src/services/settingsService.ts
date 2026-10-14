/**
 * 设置服务
 *
 * 配置树的位置计算使用领域层纯函数，写入交给 settingsStore（内部走命令）。
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  ConfigFolder,
  ConfigItemBase,
  ConfigTree,
  LLMConfig,
  ModelConfig,
  Settings
} from '@shared/domain'
import { configChildren, configNextOrder } from '@shared/domain'
import { useSettingsStore } from '../stores/settingsStore'
import { useSettingsUIStore } from '../stores/settingsUIStore'
import { useTabsStore } from '../stores/tabsStore'

export interface LLMConfigInput {
  name: string
  baseUrl: string
  modelName: string
  apiKey?: string
}

export interface ModelConfigInput {
  name: string
  systemPrompt: string
  topP: number
  temperature: number
}

/** 计算插入位置：优先放在参考项之后 */
function prepareInsertPosition<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  afterItemId?: string
): { parentFolderId?: string; order: number } {
  if (!afterItemId) {
    return { order: configNextOrder(tree, undefined) }
  }

  const reference =
    tree.items.find((item) => item.id === afterItemId) ??
    tree.folders.find((folder) => folder.id === afterItemId)

  if (!reference) {
    return { order: configNextOrder(tree, undefined) }
  }

  const nextOrder = configChildren(tree, reference.parentFolderId)
    .filter((node) => node.id !== reference.id && node.order > reference.order)
    .reduce((min, node) => Math.min(min, node.order), Number.POSITIVE_INFINITY)

  return {
    parentFolderId: reference.parentFolderId,
    order: Number.isFinite(nextOrder) ? (reference.order + nextOrder) / 2 : reference.order + 1
  }
}

function resolvePosition<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  afterItemId: string | undefined,
  inFolderId: string | undefined
): { parentFolderId?: string; order: number } {
  if (!inFolderId) return prepareInsertPosition(tree, afterItemId)
  return { parentFolderId: inFolderId, order: configNextOrder(tree, inFolderId) }
}

// ==================== LLM 配置 ====================

export function createLLMConfig(
  data: LLMConfigInput,
  afterItemId?: string,
  inFolderId?: string
): LLMConfig {
  const store = useSettingsStore.getState()
  const position = resolvePosition(store.settings.llmConfigs, afterItemId, inFolderId)
  const id = uuidv4()

  const config: LLMConfig = {
    id,
    kind: 'item',
    name: data.name,
    baseUrl: data.baseUrl,
    apiKey: data.apiKey ?? '',
    modelName: data.modelName,
    parentFolderId: position.parentFolderId,
    order: position.order,
    createdAt: Date.now()
  }

  store.addLLMConfig(config)
  return config
}

export function updateLLMConfig(id: string, updates: Partial<LLMConfig>): void {
  useSettingsStore.getState().updateLLMConfig(id, updates)
}

export function deleteLLMConfig(id: string): void {
  const store = useSettingsStore.getState()
  store.removeLLMConfig(id)
  if (store.settings.defaultLLMId === id) store.setDefaultLLMId(undefined)
}

export function copyLLMConfig(config: LLMConfig): LLMConfig {
  return createLLMConfig(
    {
      name: `${config.name} 副本`,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      modelName: config.modelName
    },
    config.id
  )
}

export function createLLMConfigFolder(
  name?: string,
  afterItemId?: string,
  inFolderId?: string
): ConfigFolder {
  const store = useSettingsStore.getState()
  const position = resolvePosition(store.settings.llmConfigs, afterItemId, inFolderId)

  const folder: ConfigFolder = {
    id: uuidv4(),
    kind: 'folder',
    name: name || '新文件夹',
    parentFolderId: position.parentFolderId,
    order: position.order,
    createdAt: Date.now()
  }

  store.addLLMConfigFolder(folder)
  return folder
}

export function updateLLMConfigFolder(id: string, updates: Partial<ConfigFolder>): void {
  useSettingsStore.getState().updateLLMConfigFolder(id, updates)
}

export function deleteLLMConfigFolder(id: string): void {
  useSettingsStore.getState().removeLLMConfigFolder(id)
}

export function clearLLMConfigFolder(id: string): void {
  useSettingsStore.getState().clearLLMConfigFolder(id)
}

export function toggleLLMConfigFolderExpanded(id: string): void {
  const folder = useSettingsStore
    .getState()
    .settings.llmConfigs.folders.find((item) => item.id === id)
  if (!folder) return
  useSettingsStore.getState().updateLLMConfigFolder(id, { expanded: !folder.expanded })
}

// ==================== 模型配置 ====================

export function createModelConfig(
  data: ModelConfigInput,
  afterItemId?: string,
  inFolderId?: string
): ModelConfig {
  const store = useSettingsStore.getState()
  const position = resolvePosition(store.settings.modelConfigs, afterItemId, inFolderId)

  const config: ModelConfig = {
    id: uuidv4(),
    kind: 'item',
    name: data.name,
    systemPrompt: data.systemPrompt,
    topP: data.topP,
    temperature: data.temperature,
    parentFolderId: position.parentFolderId,
    order: position.order,
    createdAt: Date.now()
  }

  store.addModelConfig(config)
  return config
}

export function updateModelConfig(id: string, updates: Partial<ModelConfig>): void {
  useSettingsStore.getState().updateModelConfig(id, updates)
}

export function deleteModelConfig(id: string): void {
  const store = useSettingsStore.getState()
  store.removeModelConfig(id)
  if (store.settings.defaultModelConfigId === id) store.setDefaultModelConfigId(undefined)
}

export function copyModelConfig(config: ModelConfig): ModelConfig {
  return createModelConfig(
    {
      name: `${config.name} 副本`,
      systemPrompt: config.systemPrompt,
      topP: config.topP,
      temperature: config.temperature
    },
    config.id
  )
}

export function createModelConfigFolder(
  name?: string,
  afterItemId?: string,
  inFolderId?: string
): ConfigFolder {
  const store = useSettingsStore.getState()
  const position = resolvePosition(store.settings.modelConfigs, afterItemId, inFolderId)

  const folder: ConfigFolder = {
    id: uuidv4(),
    kind: 'folder',
    name: name || '新文件夹',
    parentFolderId: position.parentFolderId,
    order: position.order,
    createdAt: Date.now()
  }

  store.addModelConfigFolder(folder)
  return folder
}

export function updateModelConfigFolder(id: string, updates: Partial<ConfigFolder>): void {
  useSettingsStore.getState().updateModelConfigFolder(id, updates)
}

export function deleteModelConfigFolder(id: string): void {
  useSettingsStore.getState().removeModelConfigFolder(id)
}

export function clearModelConfigFolder(id: string): void {
  useSettingsStore.getState().clearModelConfigFolder(id)
}

export function toggleModelConfigFolderExpanded(id: string): void {
  const folder = useSettingsStore
    .getState()
    .settings.modelConfigs.folders.find((item) => item.id === id)
  if (!folder) return
  useSettingsStore.getState().updateModelConfigFolder(id, { expanded: !folder.expanded })
}

// ==================== 基础设置 ====================

export function setFontSize(fontSize: Settings['fontSize']): void {
  useSettingsStore.getState().setFontSize(fontSize)
}

export function setDefaultLLMId(id: string | undefined): void {
  useSettingsStore.getState().setDefaultLLMId(id)
}

export function setDefaultModelConfigId(id: string | undefined): void {
  useSettingsStore.getState().setDefaultModelConfigId(id)
}

export function setAutoCheckUpdate(enabled: boolean): void {
  useSettingsStore.getState().setAutoCheckUpdate(enabled)
}

// ==================== 设置面板 ====================

export function openSettings(tab?: string): void {
  useSettingsUIStore.getState().requestTab(tab)
  useTabsStore.getState().openTab({
    id: 'settings',
    type: 'settings',
    title: '设置',
    closable: true
  })
}

export function consumePendingSettingsTab(): string | undefined {
  return useSettingsUIStore.getState().consumePendingTab()
}
