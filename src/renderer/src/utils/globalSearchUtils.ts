import type {
  ChatMessage,
  GlobalSearchMatch,
  GlobalSearchMessageGroup,
  GlobalSearchOptions,
  GlobalSearchResultGroup,
  PageFolder
} from '../types/type'
import type { PageRecord, MessagesRecord } from './database'
import { createSearchPattern } from './searchUtils'
import { useFoldersStore } from '../stores/foldersStore'

/** 上下文长度（匹配前后各多少字符） */
const CONTEXT_LENGTH = 40

/** 内容预览长度 */
const CONTENT_PREVIEW_LENGTH = 50

/**
 * 获取页面的文件夹路径
 */
function getFolderPath(parentFolderId: string | undefined, folders: PageFolder[]): string | undefined {
  if (!parentFolderId) return undefined

  const pathParts: string[] = []
  let currentId: string | undefined = parentFolderId

  while (currentId) {
    const folder = folders.find((f) => f.id === currentId)
    if (!folder) break
    pathParts.unshift(folder.name)
    currentId = folder.parentFolderId
  }

  return pathParts.length > 0 ? pathParts.join(' / ') : undefined
}

/** 每个页面最多显示的匹配数 */
const MAX_MATCHES_PER_PAGE = 50

/**
 * 检查消息是否在时间范围内
 */
function isInTimeRange(createdAt: number, timeRange: GlobalSearchOptions['timeRange']): boolean {
  if (timeRange === 'all') return true

  const now = Date.now()
  const messageTime = createdAt

  switch (timeRange) {
    case 'today': {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      return messageTime >= todayStart.getTime()
    }
    case 'week': {
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000
      return messageTime >= weekAgo
    }
    case 'month': {
      const monthAgo = now - 30 * 24 * 60 * 60 * 1000
      return messageTime >= monthAgo
    }
    default:
      return true
  }
}

/**
 * 提取匹配文本的上下文片段
 */
function extractSnippet(
  content: string,
  matchIndex: number,
  matchLength: number
): { snippet: string; matchStart: number; matchEnd: number } {
  const start = Math.max(0, matchIndex - CONTEXT_LENGTH)
  const end = Math.min(content.length, matchIndex + matchLength + CONTEXT_LENGTH)

  let snippet = content.slice(start, end)

  // 添加省略号
  if (start > 0) {
    snippet = '...' + snippet
  }
  if (end < content.length) {
    snippet = snippet + '...'
  }

  // 计算匹配在 snippet 中的位置
  const matchStart = matchIndex - start + (start > 0 ? 3 : 0)
  const matchEnd = matchStart + matchLength

  // 替换换行符为空格
  snippet = snippet.replace(/\n/g, ' ')

  return { snippet, matchStart, matchEnd }
}

/**
 * 在单个页面的消息中搜索，返回按消息分组的结果
 */
function searchInMessages(
  messages: ChatMessage[],
  pattern: RegExp,
  pageId: string,
  options: GlobalSearchOptions
): GlobalSearchMessageGroup[] {
  const messageGroups: GlobalSearchMessageGroup[] = []
  let totalMatchCount = 0

  for (const message of messages) {
    // 角色筛选
    if (options.roleFilter !== 'all' && message.role !== options.roleFilter) {
      continue
    }

    // 时间筛选
    if (!isInTimeRange(message.createdAt, options.timeRange)) {
      continue
    }

    const content = message.content
    if (!content) continue

    // 重置正则表达式的 lastIndex
    pattern.lastIndex = 0

    const matches: GlobalSearchMatch[] = []
    let match: RegExpExecArray | null

    while (
      (match = pattern.exec(content)) !== null &&
      totalMatchCount < MAX_MATCHES_PER_PAGE
    ) {
      const { snippet, matchStart, matchEnd } = extractSnippet(
        content,
        match.index,
        match[0].length
      )

      matches.push({
        messageId: message.id,
        pageId,
        role: message.role,
        snippet,
        matchStart,
        matchEnd,
        contentStart: match.index,
        contentEnd: match.index + match[0].length,
        createdAt: message.createdAt
      })

      totalMatchCount++

      // 防止零长度匹配导致无限循环
      if (match[0].length === 0) {
        pattern.lastIndex++
      }
    }

    // 如果该消息有匹配项，创建消息分组
    if (matches.length > 0) {
      // 提取内容预览（去除换行，截取前 N 个字符）
      const contentPreview = content
        .replace(/\n/g, ' ')
        .slice(0, CONTENT_PREVIEW_LENGTH)
        .trim()

      messageGroups.push({
        messageId: message.id,
        pageId,
        role: message.role,
        title: message.title,
        contentPreview,
        createdAt: message.createdAt,
        matches,
        expanded: false
      })
    }

    if (totalMatchCount >= MAX_MATCHES_PER_PAGE) break
  }

  return messageGroups
}

export interface GlobalSearchResult {
  groups: GlobalSearchResultGroup[]
  totalCount: number
}

/**
 * 执行全局搜索
 */
export async function performGlobalSearch(
  query: string,
  options: GlobalSearchOptions,
  pages: PageRecord[],
  loadMessages: (pageId: string) => Promise<MessagesRecord>
): Promise<GlobalSearchResult> {
  if (!query.trim()) {
    return { groups: [], totalCount: 0 }
  }

  const pattern = createSearchPattern(query, {
    matchCase: options.matchCase,
    useRegex: options.useRegex,
    matchWholeWord: options.matchWholeWord
  })

  if (!pattern) {
    return { groups: [], totalCount: 0 }
  }

  const groups: GlobalSearchResultGroup[] = []
  let totalCount = 0

  // 获取所有文件夹用于计算路径
  const folders = useFoldersStore.getState().folders

  // 并行加载所有页面的消息
  const messagePromises = pages.map(async (page) => {
    try {
      const record = await loadMessages(page.id)
      return { page, record }
    } catch {
      return { page, record: null }
    }
  })

  const results = await Promise.all(messagePromises)

  for (const { page, record } of results) {
    if (!record?.messages.length) continue

    const messageGroups = searchInMessages(record.messages, pattern, page.id, options)

    if (messageGroups.length > 0) {
      // 计算该页面的总匹配数
      const pageMatchCount = messageGroups.reduce((sum, mg) => sum + mg.matches.length, 0)

      groups.push({
        pageId: page.id,
        pageTitle: page.title,
        createdAt: page.createdAt,
        folderPath: getFolderPath(page.parentFolderId, folders),
        messageGroups,
        expanded: false
      })
      totalCount += pageMatchCount
    }
  }

  // 按匹配数量排序，匹配多的在前
  groups.sort((a, b) => {
    const aCount = a.messageGroups.reduce((sum, mg) => sum + mg.matches.length, 0)
    const bCount = b.messageGroups.reduce((sum, mg) => sum + mg.matches.length, 0)
    return bCount - aCount
  })

  return { groups, totalCount }
}
