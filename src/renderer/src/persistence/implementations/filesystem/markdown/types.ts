/**
 * Markdown persistence types
 */

import type { ChatMessage, Topic, FileAttachment } from '../../../../types/type'
import type { PageRecord, MessagesRecord } from '../../../interfaces'

/**
 * Combined page file structure (same as JSON version)
 */
export interface PageFile extends PageRecord {
  messages: MessagesRecord['messages']
  topics: MessagesRecord['topics']
  leafMessageId?: string
  selectedMessageId?: string
}

/**
 * Parsed message header from markdown
 */
export interface ParsedMessageHeader {
  role: 'user' | 'assistant' | 'system'
  id: string
}

/**
 * Parsed message metadata from XML comment
 */
export interface ParsedMessageMeta {
  time: number
  llmId?: string
  modelConfigId?: string
  parentMessageId?: string
  branchIndex?: number
  starred?: boolean
  collapsed?: boolean
  hasError?: boolean
  title?: string
  attachments?: FileAttachment[]
}

/**
 * Parsed page metadata from XML comment
 */
export interface ParsedPageMeta {
  id: string
  name: string
  starred?: boolean
  parentFolderId?: string
  order?: number
  createdAt: number
  updatedAt?: number
  leafMessageId?: string
  selectedMessageId?: string
  topics: Topic[]
}

/**
 * Intermediate parsed message structure
 */
export interface ParsedMessage {
  header: ParsedMessageHeader
  meta: ParsedMessageMeta
  content: string
  reasoningContent?: string
}

/**
 * Role display names in markdown
 */
export const ROLE_DISPLAY_NAMES: Record<ChatMessage['role'], string> = {
  user: 'User',
  assistant: 'Assistant',
  system: 'System'
}

/**
 * Role from display name
 */
export const DISPLAY_NAME_TO_ROLE: Record<string, ChatMessage['role']> = {
  User: 'user',
  Assistant: 'assistant',
  System: 'system'
}
