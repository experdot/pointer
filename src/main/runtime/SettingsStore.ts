/**
 * 账户级设置
 *
 * API Key 以明文随 LLM 配置保存在 settings.json 中（保持与迁移前一致的简单机制）。
 */

import type { LLMConfig, Settings } from '@shared/domain'
import {
  defaultSettings,
  validateSettings,
  validateOrderKeys,
  repairDuplicateOrderKeys
} from '@shared/domain'
import type { PathResolver } from './paths'
import { readJson, writeJsonAtomic } from './fsx'
import { RuntimeError, type SettingsSnapshot } from '@shared/contracts'
import { SerialExecutor } from './SerialExecutor'

export class SettingsStore {
  private settings: Settings = defaultSettings()
  private revision = 0
  private readonly writes = new SerialExecutor()
  idle(): Promise<void> {
    return this.writes.idle()
  }
  snapshot(mutationId?: string): SettingsSnapshot {
    return { settings: this.get(), revision: this.revision, mutationId }
  }

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
    let repaired = false
    for (const tree of [this.settings.llmConfigs, this.settings.modelConfigs]) {
      const nodes = [...tree.folders, ...tree.items]
      const invalid = validateOrderKeys(nodes).filter((d) => d.code === 'tree.invalid-order-key')
      if (invalid.length)
        throw new RuntimeError('settings.invalid-order-key', '配置缺少有效的字符串排序键', invalid)
      const keys = repairDuplicateOrderKeys(nodes)
      for (const node of nodes) {
        const key = keys.get(node.id)
        if (key) {
          node.orderKey = key
          repaired = true
        }
      }
    }
    assertSettingsOrderKeys(this.settings)
    if (repaired) await writeJsonAtomic(this.paths.settingsFile(accountId), this.settings)
  }

  get(): Settings {
    return this.settings
  }

  replace(
    settings: Settings,
    baseRevision?: number,
    mutationId?: string
  ): Promise<SettingsSnapshot> {
    return this.writes.run(async () => {
      if (baseRevision !== undefined && baseRevision !== this.revision) {
        throw new RuntimeError('settings.conflict', '设置已更新，请重新应用修改', this.snapshot())
      }
      const incoming = normalizeSettings(settings)
      assertSettingsOrderKeys(incoming)

      // 不校验设置内容：半填状态的配置（还没填 baseUrl/modelName）必须能保存，
      // 否则"新建配置 → 刷新后消失"。这里只记录诊断，不拒绝写入。
      const diagnostics = validateSettings(incoming)
      if (diagnostics.length > 0) {
        console.warn('[runtime] 设置存在待完善项：', diagnostics.slice(0, 3))
      }

      await writeJsonAtomic(this.paths.settingsFile(this.accountId), incoming)
      this.settings = incoming
      this.revision++
      return this.snapshot(mutationId)
    })
  }
}

/** 配置可以尚未填完，但排序结构必须能被所有进程一致解释。 */
function assertSettingsOrderKeys(settings: Settings): void {
  const diagnostics = [
    ...validateOrderKeys([...settings.llmConfigs.folders, ...settings.llmConfigs.items]),
    ...validateOrderKeys([...settings.modelConfigs.folders, ...settings.modelConfigs.items])
  ]
  if (diagnostics.length)
    throw new RuntimeError('settings.invalid-order-key', '配置包含无效或重复的排序键', diagnostics)
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
