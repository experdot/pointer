import { describe, expect, it } from 'vitest'
import { nameKey } from './common'
import {
  MAX_FILE_BASE_LENGTH,
  sanitizeFileName,
  stripPageFileExtension,
  uniqueName,
  uniquePageFileName,
  isPageFileName
} from './naming'

describe('文件名清洗', () => {
  it('替换非法字符并折叠空白', () => {
    expect(sanitizeFileName('a/b:c*d?')).toBe('a b c d')
    expect(sanitizeFileName('  多余   空格  ')).toBe('多余 空格')
  })

  it('规避 Windows 保留名与非法结尾', () => {
    expect(sanitizeFileName('con')).toBe('_con')
    expect(sanitizeFileName('CON')).toBe('_CON')
    expect(sanitizeFileName('结尾...')).toBe('结尾')
    expect(sanitizeFileName('...')).toBe('untitled')
    expect(sanitizeFileName('')).toBe('untitled')
  })

  it('带扩展名的保留名同样规避，普通名不受影响', () => {
    expect(sanitizeFileName('aux.txt')).toBe('_aux.txt')
    expect(sanitizeFileName('COM1.bak')).toBe('_COM1.bak')
    expect(sanitizeFileName('nul.log')).toBe('_nul.log')
    expect(sanitizeFileName('nul.')).toBe('_nul')
    expect(sanitizeFileName('console')).toBe('console')
    expect(sanitizeFileName('com0.txt')).toBe('com0.txt')
  })

  it('截断后不会留下结尾点', () => {
    expect(sanitizeFileName(`${'a'.repeat(79)}.x`)).toBe('a'.repeat(79))
  })

  it('限制基础名长度', () => {
    expect(sanitizeFileName('a'.repeat(200))).toHaveLength(MAX_FILE_BASE_LENGTH)
  })
})

describe('唯一命名', () => {
  it('显示名称按 (n) 递增', () => {
    const taken = new Set([nameKey('页面'), nameKey('页面 (1)')])
    expect(uniqueName(taken, '页面')).toBe('页面 (2)')
    expect(uniqueName(new Set(), '页面')).toBe('页面')
  })

  it('文件名带扩展名参与唯一性判断', () => {
    const taken = new Set([nameKey('未命名.pointer.md')])
    expect(uniquePageFileName(taken, '未命名')).toBe('未命名 (1).pointer.md')
  })

  it('大小写不同的既有名称视为占用', () => {
    expect(uniqueName(new Set([nameKey('Notes')]), 'notes')).toBe('notes (1)')
  })

  it('重名很多时依次递增，不依赖时钟兜底', () => {
    const taken = new Set(
      Array.from({ length: 5 }, (_, index) => nameKey(index === 0 ? '页面' : `页面 (${index})`))
    )
    expect(uniqueName(taken, '页面')).toBe('页面 (5)')
  })
})

describe('扩展名识别', () => {
  it('识别与剥离页面扩展名', () => {
    expect(isPageFileName('a.pointer.md')).toBe(true)
    expect(isPageFileName('a.md')).toBe(false)
    expect(stripPageFileExtension('a.pointer.md')).toBe('a')
    expect(stripPageFileExtension('a.md')).toBe('a.md')
  })
})
