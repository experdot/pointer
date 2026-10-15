/**
 * 检索领域模型与匹配算法
 *
 * 匹配与片段提取是纯函数；命中的存储与索引由内核层负责。
 */

import type { ChatMessage, MessageRole } from './chat'

type RoleFilter = 'all' | 'user' | 'assistant'
type TimeRange = 'all' | 'today' | 'week' | 'month'

export interface SearchOptions {
  matchCase: boolean
  useRegex: boolean
  matchWholeWord: boolean
  roleFilter: RoleFilter
  timeRange: TimeRange
  folderIds?: string[]
}

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  matchCase: false,
  useRegex: false,
  matchWholeWord: false,
  roleFilter: 'all',
  timeRange: 'all'
}

interface MatchRange {
  start: number
  end: number
}

type Matcher = (text: string) => MatchRange[]

const MAX_MATCHES_PER_MESSAGE = 100

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const WORD_CHAR = '[\\p{L}\\p{N}_]'

/**
 * 编译匹配器；正则非法时返回永不命中的匹配器
 */
export function compileMatcher(query: string, options: SearchOptions): Matcher {
  const trimmed = query.trim()
  if (!trimmed) return () => []

  let source = options.useRegex ? trimmed : escapeRegExp(trimmed)
  if (options.matchWholeWord) {
    source = `(?<!${WORD_CHAR})(?:${source})(?!${WORD_CHAR})`
  }

  const flags = options.matchCase ? 'gu' : 'giu'

  let regex: RegExp
  try {
    regex = new RegExp(source, flags)
  } catch {
    return () => []
  }

  return (text: string): MatchRange[] => {
    const ranges: MatchRange[] = []
    regex.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex++
        continue
      }
      ranges.push({ start: match.index, end: match.index + match[0].length })
      if (ranges.length >= MAX_MATCHES_PER_MESSAGE) break
    }

    return ranges
  }
}

interface Snippet {
  snippet: string
  /** 命中片段在 snippet 中的位置 */
  matchStart: number
  matchEnd: number
  /** 命中在原始文本中的位置 */
  contentStart: number
  contentEnd: number
}

/**
 * 截取命中附近的文本片段
 * 换行统一替换为空格，替换为 1:1 字符映射，因此索引保持有效
 */
export function buildSnippet(text: string, range: MatchRange, radius = 60): Snippet {
  const start = Math.max(0, range.start - radius)
  const end = Math.min(text.length, range.end + radius)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  const body = text.slice(start, end).replace(/\n/g, ' ')

  return {
    snippet: `${prefix}${body}${suffix}`,
    matchStart: prefix.length + (range.start - start),
    matchEnd: prefix.length + (range.end - start),
    contentStart: range.start,
    contentEnd: range.end
  }
}

export function withinTimeRange(createdAt: number, range: TimeRange, now: number): boolean {
  if (range === 'all') return true

  const dayMs = 24 * 60 * 60 * 1000
  const elapsed = now - createdAt

  switch (range) {
    case 'today': {
      const startOfToday = new Date(now)
      startOfToday.setHours(0, 0, 0, 0)
      return createdAt >= startOfToday.getTime()
    }
    case 'week':
      return elapsed <= 7 * dayMs
    case 'month':
      return elapsed <= 30 * dayMs
  }
}

export interface SearchMatch {
  pageId: string
  messageId: string
  role: MessageRole
  snippet: string
  matchStart: number
  matchEnd: number
  contentStart: number
  contentEnd: number
  /** 该命中文本在消息内的出现序号（0 起） */
  occurrenceIndexInMessage: number
  createdAt: number
}

interface SearchParams {
  pageId: string
  messages: readonly ChatMessage[]
  matcher: Matcher
  options: SearchOptions
  now: number
}

/** 在单个会话内执行匹配 */
export function searchConversation({
  pageId,
  messages,
  matcher,
  options,
  now
}: SearchParams): SearchMatch[] {
  const results: SearchMatch[] = []

  for (const message of messages) {
    if (options.roleFilter !== 'all' && message.role !== options.roleFilter) continue
    if (!withinTimeRange(message.createdAt, options.timeRange, now)) continue
    if (!message.content) continue

    const ranges = matcher(message.content)
    ranges.forEach((range, occurrence) => {
      const snippet = buildSnippet(message.content, range)
      results.push({
        pageId,
        messageId: message.id,
        role: message.role,
        snippet: snippet.snippet,
        matchStart: snippet.matchStart,
        matchEnd: snippet.matchEnd,
        contentStart: snippet.contentStart,
        contentEnd: snippet.contentEnd,
        occurrenceIndexInMessage: occurrence,
        createdAt: message.createdAt
      })
    })
  }

  return results
}

export interface SearchMessageGroup {
  pageId: string
  messageId: string
  role: MessageRole
  title?: string
  contentPreview: string
  createdAt: number
  matches: SearchMatch[]
}

export interface SearchPageGroup {
  pageId: string
  pageTitle: string
  createdAt: number
  folderPath?: string
  messageGroups: SearchMessageGroup[]
}

export interface SearchPageInfo {
  title: string
  createdAt: number
  folderPath?: string
  contentPreviewById?: Map<string, string>
  titleByMessageId?: Map<string, string>
}

/** 按页面 → 消息两级分组 */
export function groupMatches(
  matches: readonly SearchMatch[],
  pageInfo: ReadonlyMap<string, SearchPageInfo>
): SearchPageGroup[] {
  const byPage = new Map<string, Map<string, SearchMatch[]>>()

  for (const match of matches) {
    const messages = byPage.get(match.pageId) ?? new Map<string, SearchMatch[]>()
    const list = messages.get(match.messageId) ?? []
    list.push(match)
    messages.set(match.messageId, list)
    byPage.set(match.pageId, messages)
  }

  const groups: SearchPageGroup[] = []

  for (const [pageId, messageMap] of byPage) {
    const info = pageInfo.get(pageId)
    const messageGroups: SearchMessageGroup[] = []

    for (const [messageId, messageMatches] of messageMap) {
      const first = messageMatches[0]
      messageGroups.push({
        pageId,
        messageId,
        role: first.role,
        title: info?.titleByMessageId?.get(messageId),
        contentPreview: info?.contentPreviewById?.get(messageId) ?? first.snippet,
        createdAt: first.createdAt,
        matches: messageMatches
      })
    }

    messageGroups.sort((a, b) => a.createdAt - b.createdAt)

    groups.push({
      pageId,
      pageTitle: info?.title ?? pageId,
      createdAt: info?.createdAt ?? 0,
      folderPath: info?.folderPath,
      messageGroups
    })
  }

  groups.sort((a, b) => b.createdAt - a.createdAt)
  return groups
}
