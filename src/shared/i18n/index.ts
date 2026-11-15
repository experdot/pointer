import { createInstance, type i18n } from 'i18next'
import type { SupportedLanguage } from '../domain/locale'
import { en, zh, type TranslationKey } from './resources'

export type { TranslationKey } from './resources'
export type TranslationValues = Record<string, string | number>
export type Translate = (key: TranslationKey, values?: TranslationValues) => string

/** 每个进程/内核实例持有独立语言状态；资源随产物打包，不访问网络。 */
export function createI18n(language: SupportedLanguage): { instance: i18n; t: Translate } {
  const instance = createInstance()
  void instance.init({
    lng: language,
    fallbackLng: 'en-US',
    supportedLngs: ['zh-CN', 'en-US'],
    load: 'currentOnly',
    keySeparator: false,
    initAsync: false,
    resources: { 'zh-CN': { translation: zh }, 'en-US': { translation: en } },
    interpolation: { escapeValue: false }
  })
  const t: Translate = (key, values) => instance.t(key, values ?? {})
  return { instance, t }
}
