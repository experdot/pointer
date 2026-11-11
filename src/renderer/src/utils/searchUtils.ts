import type { SearchOptions as DomainSearchOptions } from '@shared/domain'

/** 会话内查找与全局搜索共用的输入防抖延迟 */
export const SEARCH_DEBOUNCE_MS = 500

export interface SearchMatch {
  messageId: string
  startOffset: number
  endOffset: number
  globalIndex: number
}

/**
 * 会话内查找只暴露三个开关
 *
 * 匹配算法本身复用领域层的 compileMatcher（与全局搜索同一份实现），
 * 角色/时间/文件夹等过滤条件固定为「不过滤」。
 */
export type SearchOptions = Pick<DomainSearchOptions, 'matchCase' | 'useRegex' | 'matchWholeWord'>

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
