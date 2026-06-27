import dayjs, { type Dayjs } from 'dayjs'
import 'dayjs/locale/zh-cn'

export type DateLike = number | string | Date | Dayjs | null | undefined

export function parseDateLike(value: DateLike): Dayjs | null {
  if (value == null) return null

  const parsed = dayjs.isDayjs(value) ? value.locale('zh-cn') : dayjs(value).locale('zh-cn')
  return parsed.isValid() ? parsed : null
}

export function formatSemanticDateTime(value: DateLike): string {
  const date = parseDateLike(value)
  if (!date) return '-'

  const now = dayjs().locale('zh-cn')
  if (date.isAfter(now)) {
    return formatAbsoluteDate(date, now)
  }

  if (date.isSame(now, 'day')) {
    return date.format('HH:mm')
  }

  const dayDiff = now.startOf('day').diff(date.startOf('day'), 'day')
  if (dayDiff >= 1 && dayDiff <= 6) {
    return `${dayDiff}天前`
  }

  return formatAbsoluteDate(date, now)
}

export function formatLongDateTime(value: DateLike): string {
  const date = parseDateLike(value)
  if (!date) return ''

  return date.format('YYYY年MM月DD日 dddd HH:mm:ss')
}

function formatAbsoluteDate(date: Dayjs, now: Dayjs): string {
  return date.isSame(now, 'year') ? date.format('MM月DD日') : date.format('YYYY年MM月DD日')
}
