import { afterEach, describe, expect, it, vi } from 'vitest'
import dayjs from 'dayjs'
import { formatLongDateTime, formatSemanticDateTime } from './dateTime'

afterEach(() => vi.useRealTimers())
describe('日期语言', () => {
  it('已有 Dayjs 对象也按指定语言格式化，覆盖今天、过去、未来和跨年', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 15, 12, 0, 0))
    const yesterday = dayjs(new Date(2026, 10, 14, 11, 30, 0))
    expect(formatSemanticDateTime(yesterday, 'en-US')).toBe('1 day ago')
    expect(formatSemanticDateTime(yesterday, 'zh-CN')).toBe('1天前')
    expect(formatSemanticDateTime(yesterday.subtract(1, 'day'), 'en-US')).toBe('2 days ago')
    expect(formatSemanticDateTime(Date.now(), 'en-US')).toBe('12:00')
    expect(formatLongDateTime(yesterday, 'en-US')).toContain('November')
    expect(formatLongDateTime(yesterday, 'zh-CN')).toContain('11月')
    expect(formatSemanticDateTime(new Date(2027, 0, 2), 'en-US')).toContain('2027')
    expect(formatSemanticDateTime(new Date(2025, 0, 2), 'zh-CN')).toContain('2025')
    expect(formatSemanticDateTime('invalid')).toBe('-')
    expect(formatLongDateTime(null)).toBe('')
  })
})
