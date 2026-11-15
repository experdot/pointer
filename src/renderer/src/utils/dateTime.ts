import dayjs, { type Dayjs } from 'dayjs'
import type { SupportedLanguage } from '@shared/domain/locale'
import { rendererI18n } from '../i18n'

type DateLike = number | string | Date | Dayjs | null | undefined

export function parseDateLike(value: DateLike): Dayjs | null {
  if (value == null) return null

  const parsed = dayjs.isDayjs(value) ? value : dayjs(value)
  return parsed.isValid() ? parsed : null
}

export function formatSemanticDateTime(
  value: DateLike,
  language = rendererI18n.language as SupportedLanguage
): string {
  const date = parseDateLike(value)
  if (!date) return '-'

  const now = dayjs()
  if (date.isAfter(now)) {
    return formatAbsoluteDate(date, now, language)
  }

  if (date.isSame(now, 'day')) {
    return date.format('HH:mm')
  }

  const dayDiff = now.startOf('day').diff(date.startOf('day'), 'day')
  if (dayDiff >= 1 && dayDiff <= 6) {
    return new Intl.RelativeTimeFormat(language, { numeric: 'always' }).format(-dayDiff, 'day')
  }

  return formatAbsoluteDate(date, now, language)
}

export function formatLongDateTime(
  value: DateLike,
  language = rendererI18n.language as SupportedLanguage
): string {
  const date = parseDateLike(value)
  if (!date) return ''

  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).format(date.toDate())
}

function formatAbsoluteDate(date: Dayjs, now: Dayjs, language: SupportedLanguage): string {
  return new Intl.DateTimeFormat(language, {
    month: 'short',
    day: 'numeric',
    ...(date.isSame(now, 'year') ? {} : { year: 'numeric' as const })
  }).format(date.toDate())
}
