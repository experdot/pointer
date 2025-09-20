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

  // 检查是否是今天
  if (now.isSame(target, 'day')) {
    // 当天显示具体时间（精确到秒）
    return target.format('HH:mm:ss')
  }

  // 检查是否是昨天
  if (now.subtract(1, 'day').isSame(target, 'day')) {
    return `昨天 ${target.format('HH:mm')}`
  }

  // 检查是否是今年
  if (now.isSame(target, 'year')) {
    // 同年显示月日和时间
    return target.format('MM月DD日 HH:mm')
  }

  // 不同年份显示完整日期时间
  return target.format('YYYY年MM月DD日 HH:mm')
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