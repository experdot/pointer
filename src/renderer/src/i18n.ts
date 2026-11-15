import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { createI18n, type Translate } from '@shared/i18n'
import type { SupportedLanguage } from '@shared/domain/locale'

export const { instance: rendererI18n, t } = createI18n('zh-CN')

export function useI18n(): { t: Translate; language: SupportedLanguage } {
  const { t: translate, i18n } = useTranslation(undefined, { i18n: rendererI18n })
  const localized: Translate = useCallback(
    (key, values) => translate(key, values ?? {}),
    [translate]
  )
  return { t: localized, language: i18n.language as SupportedLanguage }
}
