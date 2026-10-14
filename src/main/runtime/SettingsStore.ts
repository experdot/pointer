/**
 * 账户级设置与密钥
 *
 * API Key 使用 Electron safeStorage 加密后单独保存；
 * 领域层的 Settings 只暴露 hasApiKey 标记，密钥不进入渲染进程。
 */

import { safeStorage } from 'electron'
import type { LLMConfig, Settings } from '../../shared/domain'
import { defaultSettings, validateSettings } from '../../shared/domain'
import { RuntimeError } from '../../shared/contracts'
import type { PathResolver } from './paths'
import { readJson, writeJsonAtomic } from './fsx'

const SECRETS_VERSION = 1

interface SecretsFile {
  version: number
  /** llmId -> base64(safeStorage 加密内容) */
  keys: Record<string, string>
}

export class SettingsStore {
  private settings: Settings = defaultSettings()
  private secrets: SecretsFile = { version: SECRETS_VERSION, keys: {} }

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

    const secrets = await readJson<SecretsFile>(this.paths.secretsFile(accountId))
    this.secrets = {
      version: secrets?.version ?? SECRETS_VERSION,
      keys: secrets?.keys ?? {}
    }
  }

  get(): Settings {
    return {
      ...this.settings,
      llmConfigs: {
        ...this.settings.llmConfigs,
        items: this.settings.llmConfigs.items.map((item) => this.withSecretFlag(item))
      }
    }
  }

  async replace(settings: Settings): Promise<Settings> {
    const incoming = normalizeSettings(settings)
    // hasApiKey 由密钥存储决定；顺带清掉旧版本遗留的明文字段
    const sanitized: Settings = {
      ...incoming,
      llmConfigs: {
        ...incoming.llmConfigs,
        items: incoming.llmConfigs.items.map((item) => {
          const rest = { ...(item as LLMConfig & { hasApiKey?: boolean; apiKey?: string }) }
          delete rest.hasApiKey
          delete rest.apiKey
          return rest as LLMConfig
        })
      }
    }

    // 迁移前不校验设置内容：半填状态的配置（还没填 baseUrl/modelName）必须能保存，
    // 否则"新建配置 → 刷新后消失"。这里只记录诊断，不拒绝写入。
    const diagnostics = validateSettings(sanitized)
    if (diagnostics.length > 0) {
      console.warn('[runtime] 设置存在待完善项：', diagnostics.slice(0, 3))
    }

    this.settings = sanitized
    await writeJsonAtomic(this.paths.settingsFile(this.accountId), this.settings)
    return this.get()
  }

  async setApiKey(llmId: string, apiKey: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new RuntimeError('secrets.unavailable', '当前系统不支持安全存储，无法保存 API Key')
    }
    const encrypted = safeStorage.encryptString(apiKey).toString('base64')
    this.secrets = { ...this.secrets, keys: { ...this.secrets.keys, [llmId]: encrypted } }
    await writeJsonAtomic(this.paths.secretsFile(this.accountId), this.secrets)
  }

  async deleteApiKey(llmId: string): Promise<void> {
    const keys = { ...this.secrets.keys }
    delete keys[llmId]
    this.secrets = { ...this.secrets, keys }
    await writeJsonAtomic(this.paths.secretsFile(this.accountId), this.secrets)
  }

  /** 内核内部使用：取出解密后的密钥 */
  getApiKey(llmId: string): string {
    const encoded = this.secrets.keys[llmId]
    if (!encoded) return ''
    try {
      return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
    } catch (error) {
      console.warn('[runtime] 密钥解密失败：', error)
      return ''
    }
  }

  private withSecretFlag(item: LLMConfig): LLMConfig {
    return { ...item, hasApiKey: Boolean(this.secrets.keys[item.id]) }
  }
}

function normalizeSettings(file: Settings | null): Settings {
  const defaults = defaultSettings()
  if (!file) return defaults

  return {
    fontSize: file.fontSize ?? defaults.fontSize,
    llmConfigs: {
      items: file.llmConfigs?.items ?? [],
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
