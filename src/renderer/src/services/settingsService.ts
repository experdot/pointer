import { v4 as uuidv4 } from 'uuid'
import type {
  Settings,
  ConfigTree,
  ConfigFolder,
  ConfigItemBase,
  LLMConfig,
  ModelConfig,
  PromptListConfig
} from '../types/type'
import { useSettingsStore } from '../stores/settingsStore'
import { useTabsStore } from '../stores/tabsStore'

// ==================== 通用树操作 ====================

// 计算新项目的插入位置
function prepareInsertPosition<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  afterItemId?: string
): { parentFolderId: string | undefined; order: number } {
  let referenceItem: T | ConfigFolder | undefined
  if (afterItemId) {
    referenceItem =
      tree.items.find((item) => item.id === afterItemId) ||
      tree.folders.find((f) => f.id === afterItemId)
  }

  let parentFolderId: string | undefined
  let newOrder: number

  if (referenceItem) {
    parentFolderId = referenceItem.parentFolderId
    newOrder = (referenceItem.order ?? 0) + 1
  } else {
    parentFolderId = undefined
    newOrder = 0
  }

  return { parentFolderId, order: newOrder }
}

// ==================== LLM 配置 ====================

export function createLLMConfig(
  data: Omit<LLMConfig, 'id' | 'createdAt' | 'order' | 'parentFolderId'>,
  afterItemId?: string
): LLMConfig {
  const store = useSettingsStore.getState()
  const { parentFolderId, order } = prepareInsertPosition(store.settings.llmConfigs, afterItemId)

  const config: LLMConfig = {
    ...data,
    id: uuidv4(),
    parentFolderId,
    order,
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

  // 如果删除的是默认配置，清除默认值
  if (store.settings.defaultLLMId === id) {
    store.setDefaultLLMId(undefined)
  }
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

export function createLLMConfigFolder(name?: string, afterItemId?: string): ConfigFolder {
  const store = useSettingsStore.getState()
  const { parentFolderId, order } = prepareInsertPosition(store.settings.llmConfigs, afterItemId)

  const folder: ConfigFolder = {
    type: 'folder',
    id: uuidv4(),
    name: name || '新文件夹',
    parentFolderId,
    expanded: true,
    order,
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

export function toggleLLMConfigFolderExpanded(id: string): void {
  const store = useSettingsStore.getState()
  const folder = store.settings.llmConfigs.folders.find((f) => f.id === id)
  if (folder) {
    store.updateLLMConfigFolder(id, { expanded: !folder.expanded })
  }
}

// ==================== Model 配置 ====================

export function createModelConfig(
  data: Omit<ModelConfig, 'id' | 'createdAt' | 'order' | 'parentFolderId'>,
  afterItemId?: string
): ModelConfig {
  const store = useSettingsStore.getState()
  const { parentFolderId, order } = prepareInsertPosition(store.settings.modelConfigs, afterItemId)

  const config: ModelConfig = {
    ...data,
    id: uuidv4(),
    parentFolderId,
    order,
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

  if (store.settings.defaultModelConfigId === id) {
    store.setDefaultModelConfigId(undefined)
  }
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

export function createModelConfigFolder(name?: string, afterItemId?: string): ConfigFolder {
  const store = useSettingsStore.getState()
  const { parentFolderId, order } = prepareInsertPosition(store.settings.modelConfigs, afterItemId)

  const folder: ConfigFolder = {
    type: 'folder',
    id: uuidv4(),
    name: name || '新文件夹',
    parentFolderId,
    expanded: true,
    order,
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

export function toggleModelConfigFolderExpanded(id: string): void {
  const store = useSettingsStore.getState()
  const folder = store.settings.modelConfigs.folders.find((f) => f.id === id)
  if (folder) {
    store.updateModelConfigFolder(id, { expanded: !folder.expanded })
  }
}

// ==================== 提示词列表 ====================

export function createPromptList(
  data: Omit<PromptListConfig, 'id' | 'createdAt' | 'order' | 'parentFolderId'>,
  afterItemId?: string
): PromptListConfig {
  const store = useSettingsStore.getState()
  const { parentFolderId, order } = prepareInsertPosition(store.settings.promptLists, afterItemId)

  const config: PromptListConfig = {
    ...data,
    id: uuidv4(),
    parentFolderId,
    order,
    createdAt: Date.now()
  }

  store.addPromptList(config)
  return config
}

export function updatePromptList(id: string, updates: Partial<PromptListConfig>): void {
  useSettingsStore.getState().updatePromptList(id, updates)
}

export function deletePromptList(id: string): void {
  useSettingsStore.getState().removePromptList(id)
}

export function copyPromptList(config: PromptListConfig): PromptListConfig {
  return createPromptList(
    {
      name: `${config.name} 副本`,
      description: config.description,
      prompts: [...config.prompts]
    },
    config.id
  )
}

export function createPromptListFolder(name?: string, afterItemId?: string): ConfigFolder {
  const store = useSettingsStore.getState()
  const { parentFolderId, order } = prepareInsertPosition(store.settings.promptLists, afterItemId)

  const folder: ConfigFolder = {
    type: 'folder',
    id: uuidv4(),
    name: name || '新文件夹',
    parentFolderId,
    expanded: true,
    order,
    createdAt: Date.now()
  }

  store.addPromptListFolder(folder)
  return folder
}

export function updatePromptListFolder(id: string, updates: Partial<ConfigFolder>): void {
  useSettingsStore.getState().updatePromptListFolder(id, updates)
}

export function deletePromptListFolder(id: string): void {
  useSettingsStore.getState().removePromptListFolder(id)
}

export function togglePromptListFolderExpanded(id: string): void {
  const store = useSettingsStore.getState()
  const folder = store.settings.promptLists.folders.find((f) => f.id === id)
  if (folder) {
    store.updatePromptListFolder(id, { expanded: !folder.expanded })
  }
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

// ==================== 设置页面 ====================

let pendingSettingsTab: string | undefined

export function openSettings(tab?: string): void {
  pendingSettingsTab = tab
  const tabsStore = useTabsStore.getState()
  tabsStore.openTab({
    id: 'settings',
    type: 'settings',
    title: '设置',
    closable: true
  })
}

export function consumePendingSettingsTab(): string | undefined {
  const tab = pendingSettingsTab
  pendingSettingsTab = undefined
  return tab
}
