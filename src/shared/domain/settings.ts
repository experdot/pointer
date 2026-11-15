/**
 * 账户级设置领域模型
 *
 * API Key 以明文随 LLM 配置保存在 settings.json 中（保持与迁移前一致的简单机制）。
 */

import { describe } from '@shared/i18n/message'

import type { Diagnostic } from './common'
import type { ConfigItemBase, ConfigTree } from './configTree'
import { emptyConfigTree } from './configTree'
import { validateOrderKeys } from './ordering'

export interface LLMConfig extends ConfigItemBase {
  baseUrl: string
  apiKey: string
  modelName: string
}

export interface ModelConfig extends ConfigItemBase {
  systemPrompt: string
  topP: number
  temperature: number
}

type FontSize = 'small' | 'medium' | 'large'

export interface Settings {
  fontSize: FontSize
  llmConfigs: ConfigTree<LLMConfig>
  defaultLLMId?: string
  modelConfigs: ConfigTree<ModelConfig>
  defaultModelConfigId?: string
  autoCheckUpdate?: boolean
}

export function defaultSettings(): Settings {
  return {
    fontSize: 'medium',
    llmConfigs: emptyConfigTree<LLMConfig>(),
    modelConfigs: emptyConfigTree<ModelConfig>(),
    autoCheckUpdate: true
  }
}

/** 调用供应商所需的最小连接信息（含密钥），仅在内核层组装 */
export interface ProviderConnection {
  baseUrl: string
  apiKey: string
  modelName: string
}

export interface ModelParameters {
  systemPrompt: string
  topP: number
  temperature: number
}

export function validateSettings(settings: Settings): Diagnostic[] {
  const diagnostics: Diagnostic[] = [
    ...validateOrderKeys([...settings.llmConfigs.folders, ...settings.llmConfigs.items]),
    ...validateOrderKeys([...settings.modelConfigs.folders, ...settings.modelConfigs.items])
  ]
  const llmIds = new Set(settings.llmConfigs.items.map((item) => item.id))

  if (settings.defaultLLMId && !llmIds.has(settings.defaultLLMId)) {
    diagnostics.push({
      code: 'settings.default-llm-missing',
      ...describe('errors.settings.defaultLlmMissing'),
      entityId: settings.defaultLLMId
    })
  }

  const modelIds = new Set(settings.modelConfigs.items.map((item) => item.id))
  if (settings.defaultModelConfigId && !modelIds.has(settings.defaultModelConfigId)) {
    diagnostics.push({
      code: 'settings.default-model-missing',
      ...describe('errors.settings.defaultModelMissing'),
      entityId: settings.defaultModelConfigId
    })
  }

  for (const item of settings.llmConfigs.items) {
    if (!item.baseUrl.trim()) {
      diagnostics.push({
        code: 'settings.llm-base-url-required',
        ...describe('errors.settings.baseUrlRequired', { v0: String(item.name) }),
        entityId: item.id
      })
    }
    if (!item.modelName.trim()) {
      diagnostics.push({
        code: 'settings.llm-model-required',
        ...describe('errors.settings.modelRequired', { v0: String(item.name) }),
        entityId: item.id
      })
    }
  }

  for (const item of settings.modelConfigs.items) {
    if (item.temperature < 0 || item.temperature > 2) {
      diagnostics.push({
        code: 'settings.temperature-range',
        ...describe('errors.settings.temperatureRange', { v0: String(item.name) }),
        entityId: item.id
      })
    }
    if (item.topP <= 0 || item.topP > 1) {
      diagnostics.push({
        code: 'settings.top-p-range',
        ...describe('errors.settings.topPRange', { v0: String(item.name) }),
        entityId: item.id
      })
    }
  }

  return diagnostics
}
