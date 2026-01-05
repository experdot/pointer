import type { ChatMessage } from '../types/type'

export interface SearchMatch {
  messageId: string
  startOffset: number
  endOffset: number
  globalIndex: number
}

export interface SearchOptions {
  matchCase: boolean
  useRegex: boolean
  matchWholeWord: boolean
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 根据搜索选项创建正则表达式
 */
export function createSearchPattern(query: string, options: SearchOptions): RegExp | null {
  if (!query) return null

  try {
    let pattern = options.useRegex ? query : escapeRegExp(query)

    if (options.matchWholeWord) {
      pattern = `\\b${pattern}\\b`
    }

    return new RegExp(pattern, options.matchCase ? 'g' : 'gi')
  } catch {
    // 无效的正则表达式
    return null
  }
}

/**
 * 在消息列表中查找所有匹配项
 */
export function findAllMatches(
  messages: ChatMessage[],
  query: string,
  options: SearchOptions
): SearchMatch[] {
  const pattern = createSearchPattern(query, options)
  if (!pattern) return []

  const matches: SearchMatch[] = []
  let globalIndex = 0

  for (const message of messages) {
    const content = message.content
    let match: RegExpExecArray | null

    // 重置 lastIndex
    pattern.lastIndex = 0

    while ((match = pattern.exec(content)) !== null) {
      matches.push({
        messageId: message.id,
        startOffset: match.index,
        endOffset: match.index + match[0].length,
        globalIndex: globalIndex++
      })

      // 防止零长度匹配导致无限循环
      if (match[0].length === 0) {
        pattern.lastIndex++
      }
    }
  }

  return matches
}

/**
 * 验证正则表达式是否有效
 */
export function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}
