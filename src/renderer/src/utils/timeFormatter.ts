import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import relativeTime from 'dayjs/plugin/relativeTime'

// 配置dayjs
dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

/**
 * 格式化时间戳为相对时间
 * @param timestamp 时间戳（毫秒）
 * @returns 相对时间字符串
 */
export const formatRelativeTime = (timestamp: number): string => {
  const now = dayjs()
  const target = dayjs(timestamp)
  const diffMs = now.diff(target)
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffMonths = now.diff(target, 'month')
  const diffYears = now.diff(target, 'year')

  // 小于1分钟
  if (diffMinutes < 1) {
    return '刚刚'
  }

  // 小于1小时
  if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`
  }

  // 小于1天
  if (diffHours < 24) {
    return `${diffHours}小时前`
  }

  // 1天
  if (diffDays === 1) {
    return '1天前'
  }

  // 小于7天
  if (diffDays < 7) {
    return `${diffDays}天前`
  }

  // 小于1个月
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks}周前`
  }

  // 小于1年
  if (diffMonths < 12) {
    return `${diffMonths}个月前`
  }

  // 1年或以上
  return `${diffYears}年前`
}

/**
 * 格式化时间戳为具体日期时间（用于tooltip）
 * @param timestamp 时间戳（毫秒）
 * @returns 格式化的日期时间字符串
 */
export const formatExactDateTime = (timestamp: number): string => {
  return dayjs(timestamp).format('YYYY年MM月DD日 HH:mm:ss')
}

/**
 * 格式化时间戳为简短的时间格式（仅时间）
 * @param timestamp 时间戳（毫秒）
 * @returns HH:mm 格式的时间字符串
 */
export const formatTimeOnly = (timestamp: number): string => {
  return dayjs(timestamp).format('HH:mm')
}

/**
 * 格式化时间戳为日期格式
 * @param timestamp 时间戳（毫秒）
 * @returns YYYY-MM-DD 格式的日期字符串
 */
export const formatDateOnly = (timestamp: number): string => {
  return dayjs(timestamp).format('YYYY-MM-DD')
}