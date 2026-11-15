import { useI18n } from '@renderer/i18n'
import type { TranslationKey } from '@shared/i18n/resources'

/** 用于缓存的树节点等 React 内容，语言变化不需要重建整个数据结构。 */
export function LocalizedText({
  translationKey
}: {
  translationKey: TranslationKey
}): React.JSX.Element {
  const { t } = useI18n()
  return <>{t(translationKey)}</>
}
