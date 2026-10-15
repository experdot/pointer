/**
 * 第三方聊天记录解析
 *
 * 纯解析：输入导出文件内容，输出统一的会话结构（含分支序号）。
 * 写盘由内核层完成。
 */

import type { ChatMessage, MessageRole } from './chat'

export type ImportFormat = 'openai' | 'deepseek' | 'pointer'

export interface ImportedConversation {
  id: string
  title: string
  createdAt: number
  updatedAt?: number
  messages: ChatMessage[]
  leafMessageId?: string
}

interface ImportParseResult {
  format: ImportFormat
  conversations: ImportedConversation[]
  errors: string[]
}

// ==================== 通用工具 ====================

interface RawMessage {
  id: string
  role: MessageRole
  content: string
  reasoning?: string
  createdAt: number
  parentMessageId?: string
  llmId?: string
}

/** 外部导出中的角色统一为领域角色；tool 等三值之外的未知值归并为 assistant */
function normalizeRole(value: unknown): MessageRole {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (normalized === 'user' || normalized === 'assistant' || normalized === 'system') {
    return normalized
  }
  return 'assistant'
}

/** 按父节点分组后顺序分配 branchIndex */
function withBranchIndexes(messages: RawMessage[]): ChatMessage[] {
  const byParent = new Map<string | undefined, RawMessage[]>()
  for (const message of messages) {
    const siblings = byParent.get(message.parentMessageId) ?? []
    siblings.push(message)
    byParent.set(message.parentMessageId, siblings)
  }

  const branchById = new Map<string, number>()
  for (const siblings of byParent.values()) {
    siblings
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt)
      .forEach((message, index) => branchById.set(message.id, index))
  }

  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    reasoning: message.reasoning,
    createdAt: message.createdAt,
    parentMessageId: message.parentMessageId,
    branchIndex: branchById.get(message.id) ?? 0,
    llmId: message.llmId
  }))
}

function timestampToMillis(value: unknown, now: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // 兼容秒级时间戳
    return value < 1e12 ? Math.round(value * 1000) : Math.round(value)
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return now
}

function joinParts(parts: unknown): string {
  if (!Array.isArray(parts)) return ''
  return parts.filter((part): part is string => typeof part === 'string').join('\n')
}

/** 沿 children 向下寻找最深的有效叶子节点 */
function findLeafNode(
  childrenById: Map<string, string[]>,
  skip: ReadonlySet<string> = new Set()
): string | undefined {
  const roots = [...childrenById.keys()].filter((id) => !skip.has(id))
  let current: string | undefined

  for (const id of roots) {
    const isChild = [...childrenById.values()].some((children) => children.includes(id))
    if (!isChild) {
      current = id
      break
    }
  }

  if (!current) return undefined

  let currentId = current
  const visited = new Set<string>([currentId])
  for (;;) {
    const children = (childrenById.get(currentId) ?? []).filter((id) => !skip.has(id))
    if (children.length === 0) return currentId
    const next = children[children.length - 1]
    if (visited.has(next)) return currentId
    visited.add(next)
    currentId = next
  }
}

// ==================== 格式检测 ====================

export function detectFormat(payload: unknown): ImportFormat | null {
  if (Array.isArray(payload)) {
    const first = payload[0] as Record<string, unknown> | undefined
    if (!first || typeof first !== 'object') return null
    if ('mapping' in first && 'current_node' in first) return 'openai'
    if ('mapping' in first && typeof first.mapping === 'object' && first.mapping !== null) {
      // 缺少 current_node 的 OpenAI 导出也会落到这里按 deepseek 处理（已知误判风险，暂不修）
      return 'deepseek'
    }
    return null
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (record.type === 'chats-only' && Array.isArray(record.pages)) return 'pointer'
  }

  return null
}

export function parseImport(
  payload: unknown,
  format: ImportFormat | undefined,
  now: number
): ImportParseResult {
  const resolved = format ?? detectFormat(payload)
  if (!resolved) {
    return { format: 'pointer', conversations: [], errors: ['无法识别的导出格式'] }
  }

  switch (resolved) {
    case 'openai':
      return parseOpenAI(payload as OpenAIExport[], now)
    case 'deepseek':
      return parseDeepSeek(payload as DeepSeekExport[], now)
    case 'pointer':
      return parsePointer(payload as PointerExport, now)
  }
}

// ==================== OpenAI / ChatGPT ====================

interface OpenAIMessage {
  id: string
  author: { role: string }
  content: { parts?: unknown[] } | null
  create_time: number | null
  metadata?: { is_visually_hidden_from_conversation?: boolean; model_slug?: string }
}

interface OpenAIMappingNode {
  id: string
  parent: string | null
  children: string[]
  message: OpenAIMessage | null
}

interface OpenAIExport {
  title?: string
  conversation_id?: string
  id?: string
  create_time?: number
  update_time?: number
  mapping: Record<string, OpenAIMappingNode>
  current_node?: string
}

function parseOpenAI(payload: OpenAIExport[], now: number): ImportParseResult {
  const errors: string[] = []
  const conversations: ImportedConversation[] = []

  if (!Array.isArray(payload)) {
    return { format: 'openai', conversations: [], errors: ['导出文件不是数组'] }
  }

  for (const conversation of payload) {
    if (!conversation?.mapping) {
      errors.push('跳过缺少 mapping 的对话')
      continue
    }

    const mapping = conversation.mapping
    const skipped = new Set<string>()
    const parentOf = new Map<string, string | undefined>()

    for (const [id, node] of Object.entries(mapping)) {
      const message = node.message
      const content = joinParts(message?.content?.parts)
      const hidden = message?.metadata?.is_visually_hidden_from_conversation === true
      // 未知角色归并为 assistant 后，空消息按空 assistant 跳过
      const role = normalizeRole(message?.author.role)
      const emptyAssistant = role === 'assistant' && !content
      const emptySystem = role === 'system' && !content

      if (!message || hidden || emptyAssistant || emptySystem) {
        skipped.add(id)
        parentOf.set(id, node.parent ?? undefined)
      }
    }

    const resolveParent = (parentId: string | null | undefined): string | undefined => {
      if (!parentId || parentId === 'client-created-root') return undefined
      let current: string | undefined = parentId
      while (current && skipped.has(current)) {
        current = parentOf.get(current)
      }
      return current
    }

    const raw: RawMessage[] = []
    const childrenById = new Map<string, string[]>()

    for (const [id, node] of Object.entries(mapping)) {
      if (skipped.has(id)) continue
      const message = node.message
      if (!message) continue

      childrenById.set(id, node.children ?? [])
      raw.push({
        id,
        role: normalizeRole(message.author.role),
        content: joinParts(message.content?.parts),
        createdAt: timestampToMillis(message.create_time, now),
        parentMessageId: resolveParent(node.parent),
        llmId: message.metadata?.model_slug
      })
    }

    const leafMessageId =
      conversation.current_node && !skipped.has(conversation.current_node)
        ? conversation.current_node
        : findLeafNode(childrenById, skipped)

    conversations.push({
      id: conversation.conversation_id ?? conversation.id ?? `openai-${conversations.length}`,
      title: conversation.title?.trim() || '未命名对话',
      createdAt: timestampToMillis(conversation.create_time, now),
      updatedAt: conversation.update_time
        ? timestampToMillis(conversation.update_time, now)
        : undefined,
      messages: withBranchIndexes(raw),
      leafMessageId
    })
  }

  return { format: 'openai', conversations, errors }
}

// ==================== DeepSeek ====================

interface DeepSeekNode {
  id: string
  parent: string | null
  children: string[]
  message: {
    model?: string
    inserted_at?: string
    fragments?: Array<{ type: 'REQUEST' | 'RESPONSE'; content: string }>
  } | null
}

interface DeepSeekExport {
  id?: string
  title?: string
  inserted_at?: string
  updated_at?: string
  mapping: Record<string, DeepSeekNode>
}

function parseDeepSeek(payload: DeepSeekExport[], now: number): ImportParseResult {
  const errors: string[] = []
  const conversations: ImportedConversation[] = []

  if (!Array.isArray(payload)) {
    return { format: 'deepseek', conversations: [], errors: ['导出文件不是数组'] }
  }

  for (const conversation of payload) {
    if (!conversation?.mapping) {
      errors.push('跳过缺少 mapping 的对话')
      continue
    }

    const raw: RawMessage[] = []
    const childrenById = new Map<string, string[]>()

    for (const [id, node] of Object.entries(conversation.mapping)) {
      if (id === 'root' || !node.message) continue
      const fragment = node.message.fragments?.[0]
      if (!fragment) continue

      childrenById.set(id, node.children ?? [])
      raw.push({
        id,
        role: fragment.type === 'REQUEST' ? 'user' : 'assistant',
        content: fragment.content,
        createdAt: timestampToMillis(node.message.inserted_at, now),
        // 注意：父节点若不在保留集合内（缺消息/缺片段），这里不做跨节点重映射，
        // 下游会以 orphan 诊断呈现；如需修复可参考 OpenAI 的 resolveParent 思路
        parentMessageId: node.parent === 'root' ? undefined : (node.parent ?? undefined),
        llmId: node.message.model
      })
    }

    conversations.push({
      id: conversation.id ?? `deepseek-${conversations.length}`,
      title: conversation.title?.trim() || '未命名对话',
      createdAt: timestampToMillis(conversation.inserted_at, now),
      updatedAt: conversation.updated_at
        ? timestampToMillis(conversation.updated_at, now)
        : undefined,
      messages: withBranchIndexes(raw),
      leafMessageId: findLeafNode(childrenById)
    })
  }

  return { format: 'deepseek', conversations, errors }
}

// ==================== Pointer 旧版导出 ====================

interface PointerMessage {
  id: string
  role: string
  content?: string
  reasoning_content?: string
  timestamp?: number
  children?: string[]
  parentId?: string
  modelId?: string
}

interface PointerPage {
  id: string
  title?: string
  createdAt?: number
  updatedAt?: number
  messages?: PointerMessage[]
  messageMap?: Record<string, PointerMessage>
  currentPath?: string[]
}

interface PointerExport {
  type: 'chats-only'
  pages: PointerPage[]
}

function parsePointer(payload: PointerExport, now: number): ImportParseResult {
  const errors: string[] = []
  const conversations: ImportedConversation[] = []

  if (!payload?.pages || !Array.isArray(payload.pages)) {
    return { format: 'pointer', conversations: [], errors: ['导出文件缺少 pages 数组'] }
  }

  for (const page of payload.pages) {
    const source = page.messages?.length
      ? page.messages.map((message) => ({ ...page.messageMap?.[message.id], ...message }))
      : Object.values(page.messageMap ?? {})

    if (source.length === 0) {
      errors.push(`跳过空对话：${page.title ?? page.id}`)
      continue
    }

    const parentMap = new Map<string, string>()
    for (const message of source) {
      for (const childId of message.children ?? []) {
        parentMap.set(childId, message.id)
      }
    }

    const childrenById = new Map<string, string[]>()
    const raw: RawMessage[] = []

    for (const message of source) {
      if (!message.id || !message.role) continue
      childrenById.set(message.id, message.children ?? [])
      raw.push({
        id: message.id,
        role: normalizeRole(message.role),
        content: message.content ?? '',
        reasoning: message.reasoning_content,
        createdAt: timestampToMillis(message.timestamp, now),
        parentMessageId: parentMap.get(message.id) ?? message.parentId,
        llmId: message.modelId
      })
    }

    const lastPathId = page.currentPath?.[page.currentPath.length - 1]
    conversations.push({
      id: page.id,
      title: page.title?.trim() || '未命名对话',
      createdAt: page.createdAt ?? now,
      updatedAt: page.updatedAt,
      messages: withBranchIndexes(raw),
      leafMessageId:
        lastPathId && childrenById.has(lastPathId) ? lastPathId : findLeafNode(childrenById)
    })
  }

  return { format: 'pointer', conversations, errors }
}
