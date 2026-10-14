/**
 * 账户级设置领域模型
 *
 * API Key 以明文随 LLM 配置保存在 settings.json 中（保持与迁移前一致的简单机制）。
 */

import type { Diagnostic } from './common'
import type { ConfigItemBase, ConfigTree } from './configTree'
import { emptyConfigTree } from './configTree'

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

export type FontSize = 'small' | 'medium' | 'large'

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
  const diagnostics: Diagnostic[] = []
  const llmIds = new Set(settings.llmConfigs.items.map((item) => item.id))

  if (settings.defaultLLMId && !llmIds.has(settings.defaultLLMId)) {
    diagnostics.push({
      code: 'settings.default-llm-missing',
      message: '默认 LLM 配置不存在',
      entityId: settings.defaultLLMId
    })
  }

  const modelIds = new Set(settings.modelConfigs.items.map((item) => item.id))
  if (settings.defaultModelConfigId && !modelIds.has(settings.defaultModelConfigId)) {
    diagnostics.push({
      code: 'settings.default-model-missing',
      message: '默认模型配置不存在',
      entityId: settings.defaultModelConfigId
    })
  }

  for (const item of settings.llmConfigs.items) {
    if (!item.baseUrl.trim()) {
      diagnostics.push({
        code: 'settings.llm-base-url-required',
        message: `LLM 配置「${item.name}」缺少 API 地址`,
        entityId: item.id
      })
    }
    if (!item.modelName.trim()) {
      diagnostics.push({
        code: 'settings.llm-model-required',
        message: `LLM 配置「${item.name}」缺少模型名`,
        entityId: item.id
      })
    }
  }

  for (const item of settings.modelConfigs.items) {
    if (item.temperature < 0 || item.temperature > 2) {
      diagnostics.push({
        code: 'settings.temperature-range',
        message: `模型配置「${item.name}」的 temperature 应在 0~2 之间`,
        entityId: item.id
      })
    }
    if (item.topP <= 0 || item.topP > 1) {
      diagnostics.push({
        code: 'settings.top-p-range',
        message: `模型配置「${item.name}」的 topP 应在 (0, 1] 之间`,
        entityId: item.id
      })
    }
  }

  return diagnostics
}
