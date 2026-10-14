/**
 * 账户级设置
 *
 * API Key 以明文随 LLM 配置保存在 settings.json 中（保持与迁移前一致的简单机制）。
 * 兼容：早期版本的密钥加密存在 secrets.json，首次加载时解密一次并写回明文。
 */

import { safeStorage } from 'electron'
import type { LLMConfig, Settings } from '../../shared/domain'
import { defaultSettings, validateSettings } from '../../shared/domain'
import type { PathResolver } from './paths'
import { readJson, writeJsonAtomic } from './fsx'

interface LegacySecretsFile {
  version?: number
  /** llmId -> base64(safeStorage 加密内容) */
  keys?: Record<string, string>
}

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
    await this.migrateLegacySecrets(accountId)
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

  /**
   * 一次性迁移：把 secrets.json 里加密的密钥解密后写回 settings.json 明文。
   * 迁移后不再读写 secrets.json（旧文件保留不删，可手动清理）。
   */
  private async migrateLegacySecrets(accountId: string): Promise<void> {
    const secrets = await readJson<LegacySecretsFile>(this.paths.secretsFile(accountId))
    if (!secrets?.keys || Object.keys(secrets.keys).length === 0) return
    if (!safeStorage.isEncryptionAvailable()) return

    let changed = false
    const items = this.settings.llmConfigs.items.map((item) => {
      if (item.apiKey) return item
      const encoded = secrets.keys?.[item.id]
      if (!encoded) return item
      try {
        const apiKey = safeStorage.decryptString(Buffer.from(encoded, 'base64'))
        if (!apiKey) return item
        changed = true
        return { ...item, apiKey }
      } catch (error) {
        console.warn('[runtime] 历史密钥解密失败：', error)
        return item
      }
    })

    if (!changed) return
    this.settings = { ...this.settings, llmConfigs: { ...this.settings.llmConfigs, items } }
    await writeJsonAtomic(this.paths.settingsFile(accountId), this.settings)
    console.info('[runtime] 已将历史加密密钥迁移为明文保存')
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
