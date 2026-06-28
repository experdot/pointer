import { v4 as uuidv4 } from 'uuid'
import type {
  Settings,
  ConfigTree,
  ConfigFolder,
  ConfigItemBase,
  LLMConfig,
  ModelConfig
} from '../types/type'
import { stores } from '../stores/registry'

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
  afterItemId?: string,
  inFolderId?: string
): LLMConfig {
  const { settings } = stores
  let parentFolderId: string | undefined
  let order: number

  if (inFolderId) {
    parentFolderId = inFolderId
    const itemsInFolder = [
      ...settings.settings.llmConfigs.items.filter((i) => i.parentFolderId === inFolderId),
      ...settings.settings.llmConfigs.folders.filter((f) => f.parentFolderId === inFolderId)
    ]
    order = itemsInFolder.length > 0 ? Math.max(...itemsInFolder.map((i) => i.order ?? 0)) + 1 : 0
  } else {
    const position = prepareInsertPosition(settings.settings.llmConfigs, afterItemId)
    parentFolderId = position.parentFolderId
    order = position.order
  }

  const config: LLMConfig = {
    ...data,
    id: uuidv4(),
    parentFolderId,
    order,
    createdAt: Date.now()
  }

  settings.addLLMConfig(config)
  return config
}

export function updateLLMConfig(id: string, updates: Partial<LLMConfig>): void {
  stores.settings.updateLLMConfig(id, updates)
}

export function deleteLLMConfig(id: string): void {
  const { settings } = stores
  settings.removeLLMConfig(id)

  // 如果删除的是默认配置，清除默认值
  if (settings.settings.defaultLLMId === id) {
    settings.setDefaultLLMId(undefined)
  }
}

export function copyLLMConfig(config: LLMConfig): LLMConfig {
  return createLLMConfig(
    {
      type: 'item',
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
  const { settings } = stores
  let parentFolderId: string | undefined
  let order: number

  if (inFolderId) {
    parentFolderId = inFolderId
    const itemsInFolder = [
      ...settings.settings.llmConfigs.items.filter((i) => i.parentFolderId === inFolderId),
      ...settings.settings.llmConfigs.folders.filter((f) => f.parentFolderId === inFolderId)
    ]
    order = itemsInFolder.length > 0 ? Math.max(...itemsInFolder.map((i) => i.order ?? 0)) + 1 : 0
  } else {
    const position = prepareInsertPosition(settings.settings.llmConfigs, afterItemId)
    parentFolderId = position.parentFolderId
    order = position.order
  }

  const folder: ConfigFolder = {
    type: 'folder',
    id: uuidv4(),
    name: name || '新文件夹',
    parentFolderId,
    expanded: true,
    order,
    createdAt: Date.now()
  }

  settings.addLLMConfigFolder(folder)
  return folder
}

export function updateLLMConfigFolder(id: string, updates: Partial<ConfigFolder>): void {
  stores.settings.updateLLMConfigFolder(id, updates)
}

export function deleteLLMConfigFolder(id: string): void {
  stores.settings.removeLLMConfigFolder(id)
}

export function clearLLMConfigFolder(id: string): void {
  stores.settings.clearLLMConfigFolder(id)
}

export function toggleLLMConfigFolderExpanded(id: string): void {
  const { settings } = stores
  const folder = settings.settings.llmConfigs.folders.find((f) => f.id === id)
  if (folder) {
    settings.updateLLMConfigFolder(id, { expanded: !folder.expanded })
  }
}

// ==================== Model 配置 ====================

export function createModelConfig(
  data: Omit<ModelConfig, 'id' | 'createdAt' | 'order' | 'parentFolderId'>,
  afterItemId?: string,
  inFolderId?: string
): ModelConfig {
  const { settings } = stores
  let parentFolderId: string | undefined
  let order: number

  if (inFolderId) {
    parentFolderId = inFolderId
    const itemsInFolder = [
      ...settings.settings.modelConfigs.items.filter((i) => i.parentFolderId === inFolderId),
      ...settings.settings.modelConfigs.folders.filter((f) => f.parentFolderId === inFolderId)
    ]
    order = itemsInFolder.length > 0 ? Math.max(...itemsInFolder.map((i) => i.order ?? 0)) + 1 : 0
  } else {
    const position = prepareInsertPosition(settings.settings.modelConfigs, afterItemId)
    parentFolderId = position.parentFolderId
    order = position.order
  }

  const config: ModelConfig = {
    ...data,
    id: uuidv4(),
    parentFolderId,
    order,
    createdAt: Date.now()
  }

  settings.addModelConfig(config)
  return config
}

export function updateModelConfig(id: string, updates: Partial<ModelConfig>): void {
  stores.settings.updateModelConfig(id, updates)
}

export function deleteModelConfig(id: string): void {
  const { settings } = stores
  settings.removeModelConfig(id)

  if (settings.settings.defaultModelConfigId === id) {
    settings.setDefaultModelConfigId(undefined)
  }
}

export function copyModelConfig(config: ModelConfig): ModelConfig {
  return createModelConfig(
    {
      type: 'item',
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
  const { settings } = stores
  let parentFolderId: string | undefined
  let order: number

  if (inFolderId) {
    parentFolderId = inFolderId
    const itemsInFolder = [
      ...settings.settings.modelConfigs.items.filter((i) => i.parentFolderId === inFolderId),
      ...settings.settings.modelConfigs.folders.filter((f) => f.parentFolderId === inFolderId)
    ]
    order = itemsInFolder.length > 0 ? Math.max(...itemsInFolder.map((i) => i.order ?? 0)) + 1 : 0
  } else {
    const position = prepareInsertPosition(settings.settings.modelConfigs, afterItemId)
    parentFolderId = position.parentFolderId
    order = position.order
  }

  const folder: ConfigFolder = {
    type: 'folder',
    id: uuidv4(),
    name: name || '新文件夹',
    parentFolderId,
    expanded: true,
    order,
    createdAt: Date.now()
  }

  settings.addModelConfigFolder(folder)
  return folder
}

export function updateModelConfigFolder(id: string, updates: Partial<ConfigFolder>): void {
  stores.settings.updateModelConfigFolder(id, updates)
}

export function deleteModelConfigFolder(id: string): void {
  stores.settings.removeModelConfigFolder(id)
}

export function clearModelConfigFolder(id: string): void {
  stores.settings.clearModelConfigFolder(id)
}

export function toggleModelConfigFolderExpanded(id: string): void {
  const { settings } = stores
  const folder = settings.settings.modelConfigs.folders.find((f) => f.id === id)
  if (folder) {
    settings.updateModelConfigFolder(id, { expanded: !folder.expanded })
  }
}

// ==================== 基础设置 ====================

export function setFontSize(fontSize: Settings['fontSize']): void {
  stores.settings.setFontSize(fontSize)
}

export function setDefaultLLMId(id: string | undefined): void {
  stores.settings.setDefaultLLMId(id)
}

export function setDefaultModelConfigId(id: string | undefined): void {
  stores.settings.setDefaultModelConfigId(id)
}

// ==================== 设置页面 ====================

let pendingSettingsTab: string | undefined

export function openSettings(tab?: string): void {
  pendingSettingsTab = tab
  stores.tab.openTab({
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
