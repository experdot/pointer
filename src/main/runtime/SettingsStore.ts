/**
 * 账户级设置
 *
 * API Key 以明文随 LLM 配置保存在 settings.json 中（保持与迁移前一致的简单机制）。
 */

import type { LLMConfig, Settings } from '@shared/domain'
import { defaultSettings, validateSettings } from '@shared/domain'
import type { PathResolver } from './paths'
import { readJson, writeJsonAtomic } from './fsx'

export class SettingsStore {
  private settings: Settings = defaultSettings()

  constructor(
    private readonly paths: PathResolver,
    private accountId: string
  ) {}

  get account(): string {
    return this.accountId
  }

  async load(accountId: string): Promise<void> {
    this.accountId = accountId
    const file = await readJson<Settings>(this.paths.settingsFile(accountId))
    this.settings = normalizeSettings(file)
  }

  get(): Settings {
    return this.settings
  }

  async replace(settings: Settings): Promise<Settings> {
    const incoming = normalizeSettings(settings)

    // 不校验设置内容：半填状态的配置（还没填 baseUrl/modelName）必须能保存，
    // 否则"新建配置 → 刷新后消失"。这里只记录诊断，不拒绝写入。
    const diagnostics = validateSettings(incoming)
    if (diagnostics.length > 0) {
      console.warn('[runtime] 设置存在待完善项：', diagnostics.slice(0, 3))
    }

    this.settings = incoming
    await writeJsonAtomic(this.paths.settingsFile(this.accountId), this.settings)
    return this.get()
  }
}

function normalizeSettings(file: Settings | null): Settings {
  const defaults = defaultSettings()
  if (!file) return defaults

  return {
    fontSize: file.fontSize ?? defaults.fontSize,
    llmConfigs: {
      items: (file.llmConfigs?.items ?? []).map((item) => normalizeLLMConfig(item)),
      folders: file.llmConfigs?.folders ?? []
    },
    defaultLLMId: file.defaultLLMId,
    modelConfigs: {
      items: file.modelConfigs?.items ?? [],
      folders: file.modelConfigs?.folders ?? []
    },
    defaultModelConfigId: file.defaultModelConfigId,
    autoCheckUpdate: file.autoCheckUpdate ?? defaults.autoCheckUpdate
  }
}

/** 补齐 LLM 配置字段（历史数据可能没有 apiKey），并清掉旧的 hasApiKey 标记 */
function normalizeLLMConfig(item: LLMConfig): LLMConfig {
  const rest = { ...(item as LLMConfig & { hasApiKey?: boolean; apiKey?: string }) }
  delete rest.hasApiKey
  return { ...rest, apiKey: typeof rest.apiKey === 'string' ? rest.apiKey : '' }
}
