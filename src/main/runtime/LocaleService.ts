import { join } from 'node:path'
import { isLanguagePreference, resolveLanguage } from '@shared/domain/locale'
import type { LanguagePreference } from '@shared/domain/locale'
import type { LocaleSnapshot } from '@shared/contracts/locale'
import { RuntimeError } from '@shared/contracts'
import { createI18n } from '@shared/i18n'
import { msg } from '@shared/i18n/message'
import { readJson, writeJsonAtomic } from './fsx'
import { SerialExecutor } from './SerialExecutor'

export class LocaleService {
  private preference: LanguagePreference = 'system'
  private revision = 0
  private systemLanguage = resolveLanguage('system', [])
  private readonly writes = new SerialExecutor()
  private readonly file: string
  readonly translations = createI18n('en-US')

  constructor(
    appDataPath: string,
    private readonly systemLanguages: () => string[]
  ) {
    this.file = join(appDataPath, 'app-preferences.json')
    this.applyLanguage()
  }

  async load(): Promise<void> {
    const saved = await readJson<{ language?: unknown }>(this.file).catch((error) => {
      // 损坏的非业务偏好回退系统语言，磁盘访问错误仍需报告。
      if (error instanceof SyntaxError) return null
      throw error
    })
    this.preference = isLanguagePreference(saved?.language) ? saved.language : 'system'
    this.applyLanguage()
  }

  snapshot(): LocaleSnapshot {
    return {
      preference: this.preference,
      language: this.preference === 'system' ? this.systemLanguage : this.preference,
      systemLanguage: this.systemLanguage,
      revision: this.revision
    }
  }

  set(preference: LanguagePreference): Promise<LocaleSnapshot> {
    return this.writes.run(async () => {
      if (!isLanguagePreference(preference))
        throw new RuntimeError('locale.invalid', msg('errors.locale.invalid'))
      await writeJsonAtomic(this.file, { language: preference })
      this.preference = preference
      this.revision++
      this.applyLanguage()
      return this.snapshot()
    })
  }

  private applyLanguage(): void {
    this.systemLanguage = resolveLanguage('system', this.systemLanguages())
    void this.translations.instance.changeLanguage(this.snapshot().language)
  }

  idle(): Promise<void> {
    return this.writes.idle()
  }
}
