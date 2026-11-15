import type { LanguagePreference, SupportedLanguage } from '../domain/locale'

export interface LocaleSnapshot {
  preference: LanguagePreference
  language: SupportedLanguage
  systemLanguage: SupportedLanguage
  revision: number
}

/** 应用级语言契约不随工作区代际失效。三个进程共用同一判定。 */
export function isApplicationLocaleOperation(name: string): boolean {
  return name === 'app.locale.get' || name === 'app.locale.set'
}
