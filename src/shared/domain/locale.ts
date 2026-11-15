/** 应用语言偏好。解析规则保持纯函数，系统信息由主进程提供。 */
export const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]
export type LanguagePreference = 'system' | SupportedLanguage

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === 'system' || value === 'zh-CN' || value === 'en-US'
}

export function resolveLanguage(
  preference: LanguagePreference,
  systemLanguages: readonly string[]
): SupportedLanguage {
  if (preference !== 'system') return preference
  for (const language of systemLanguages) {
    const base = language.trim().replaceAll('_', '-').split('-')[0].toLowerCase()
    if (base === 'zh') return 'zh-CN'
    if (base === 'en') return 'en-US'
  }
  return 'en-US'
}
