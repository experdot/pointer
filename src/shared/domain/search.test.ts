import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SEARCH_OPTIONS,
  buildSnippet,
  compileMatcher,
  groupMatches,
  withinTimeRange
} from './search'
import type { SearchOptions, SearchPageInfo } from './search'

function options(patch: Partial<SearchOptions> = {}): SearchOptions {
  return { ...DEFAULT_SEARCH_OPTIONS, ...patch }
}

describe('匹配器', () => {
  it('默认忽略大小写并返回全部命中', () => {
    const matcher = compileMatcher('hello', options())
    expect(matcher('Hello hello HELLO')).toEqual([
      { start: 0, end: 5 },
      { start: 6, end: 11 },
      { start: 12, end: 17 }
    ])
  })

  it('可区分大小写', () => {
    const matcher = compileMatcher('hello', options({ matchCase: true }))
    expect(matcher('Hello hello')).toEqual([{ start: 6, end: 11 }])
  })

  it('整词匹配不命中子串', () => {
    const matcher = compileMatcher('cat', options({ matchWholeWord: true }))
    expect(matcher('cat catalog the cat')).toEqual([
      { start: 0, end: 3 },
      { start: 16, end: 19 }
    ])
  })

  it('支持正则，非法正则返回空结果', () => {
    const matcher = compileMatcher('\\d+', options({ useRegex: true }))
    expect(matcher('a1b22')).toEqual([
      { start: 1, end: 2 },
      { start: 3, end: 5 }
    ])

    expect(compileMatcher('[', options({ useRegex: true }))('anything')).toEqual([])
    expect(compileMatcher('   ', options())('anything')).toEqual([])
  })

  it('中文按字面匹配', () => {
    const matcher = compileMatcher('架构', options())
    expect(matcher('重构架构与架构图')).toEqual([
      { start: 2, end: 4 },
      { start: 5, end: 7 }
    ])
  })
})

describe('片段提取', () => {
  it('保留命中位置并压缩换行', () => {
    const text = '前置内容'.repeat(20) + '\n命中\n' + '后置'.repeat(20)
    const range = { start: 81, end: 83 }
    const snippet = buildSnippet(text, range, 10)

    expect(snippet.snippet).not.toContain('\n')
    expect(snippet.snippet.slice(snippet.matchStart, snippet.matchEnd)).toBe('命中')
    expect(snippet.contentStart).toBe(81)
  })
})

it('时间范围按消息创建时间过滤', () => {
  const now = 10 * 24 * 60 * 60 * 1000
  expect(withinTimeRange(now - 1000, 'week', now)).toBe(true)
  expect(withinTimeRange(now - 8 * 24 * 60 * 60 * 1000, 'week', now)).toBe(false)
})

describe('结果分组', () => {
  it('按页面与消息两级分组并按时间倒序排列页面', () => {
    const matches = ['p1', 'p2'].map((pageId, index) => ({
      pageId,
      messageId: 'm' + index,
      role: 'user' as const,
      createdAt: index === 0 ? 5 : 9,
      snippet: '架构',
      matchStart: 0,
      matchEnd: 2,
      contentStart: 0,
      contentEnd: 2,
      occurrenceIndexInMessage: 0
    }))

    const info = new Map<string, SearchPageInfo>([
      ['p1', { title: '页面一', createdAt: 1 }],
      ['p2', { title: '页面二', createdAt: 2 }]
    ])
    const groups = groupMatches(matches, info)

    expect(groups.map((group) => group.pageTitle)).toEqual(['页面二', '页面一'])
    expect(groups[0].messageGroups).toHaveLength(1)
  })
})
