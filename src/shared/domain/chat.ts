/**
 * 会话领域模型（消息树 + Topic）
 */

import type { Timestamps } from './common'

export type MessageRole = 'user' | 'assistant' | 'system'

/** 附件引用。路径相对工作区根目录（如 .pointer/attachments/x.png），领域层不接触绝对路径 */
export interface AttachmentRef {
  id: string
  name: string
  mimeType: string
  size: number
  relativePath: string
  createdAt: number
}

/**
 * 消息节点
 *
 * 不变量：
 * - 同一父节点下 branchIndex 唯一
 * - parentMessageId 必须指向同一会话内的消息，或不设置（根消息）
 * - 树中不允许出现环
 */
export interface ChatMessage extends Timestamps {
  id: string
  role: MessageRole
  content: string
  reasoning?: string
  attachments?: AttachmentRef[]
  parentMessageId?: string
  branchIndex: number
  llmId?: string
  modelConfigId?: string
  starred?: boolean
  collapsed?: boolean
  hasError?: boolean
  title?: string
}

/**
 * Topic：对当前路径上一段连续消息的命名分组
 *
 * 不变量：endMessageId 必须是 startMessageId 的后代（或相等），二者都必须在同一路径上
 */
export interface Topic {
  id: string
  name: string
  startMessageId: string
  endMessageId?: string
  collapsed: boolean
}

export interface Conversation {
  pageId: string
  messages: ChatMessage[]
  topics: Topic[]
  /** 当前选择的消息路径终点 */
  leafMessageId?: string
  /** 当前选中的消息（用于滚动定位） */
  selectedMessageId?: string
  updatedAt?: number
}

export function emptyConversation(pageId: string): Conversation {
  return { pageId, messages: [], topics: [] }
}

/** 新建消息所需的最小信息，id 与时间戳由调用方提供 */
export interface MessageDraft {
  id: string
  role: MessageRole
  content: string
  parentMessageId?: string
  reasoning?: string
  attachments?: AttachmentRef[]
  llmId?: string
  modelConfigId?: string
  title?: string
  hasError?: boolean
}

export const ROLE_DISPLAY_NAMES: Record<MessageRole, string> = {
  user: 'User',
  assistant: 'Assistant',
  system: 'System'
}

/** 展示名到角色的映射（大小写不敏感，允许前后空白） */
export function roleFromDisplayName(value: string): MessageRole | undefined {
  const normalized = value.trim().toLowerCase()
  const entry = Object.entries(ROLE_DISPLAY_NAMES).find(
    ([, display]) => display.toLowerCase() === normalized
  )
  return entry?.[0] as MessageRole | undefined
}
