/**
 * Pointer（老版本）聊天记录导入器
 */

import { BaseImporter } from './base'
import type { ParsedConversation, ParsedMessage } from './types'

// Pointer 导出格式类型定义
interface PointerMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content?: string
  timestamp?: number
  children?: string[]
  parentId?: string
  modelId?: string
  isStreaming?: boolean
  reasoning_content?: string
  attachments?: unknown[]
}

interface PointerPage {
  id: string
  title: string
  type?: string
  createdAt: number
  updatedAt?: number
  order?: number
  messages?: PointerMessage[]
  messageMap?: Record<string, PointerMessage>
  currentPath?: string[]
}

interface PointerExport {
  type: 'chats-only'
  pages: PointerPage[]
}

function isBlankText(value: string | undefined): boolean {
  return value === undefined || value.trim().length === 0
}

export class PointerImporter extends BaseImporter {
  platform = 'custom' as const
  name = 'Pointer（老版本）'
  description = '导入老版本 Pointer 导出的聊天记录'

  /**
   * 检测是否为 Pointer 格式
   */
  detect(data: unknown): boolean {
    if (typeof data !== 'object' || data === null) return false

    const obj = data as Record<string, unknown>

    // Pointer 格式特征：type === 'chats-only' 且有 pages 数组
    return obj.type === 'chats-only' && Array.isArray(obj.pages)
  }

  /**
   * 解析 Pointer 导出数据
   */
  parse(data: unknown): ParsedConversation[] {
    const exportData = data as PointerExport
    if (!exportData.pages || !Array.isArray(exportData.pages)) {
      return []
    }

    return exportData.pages
      .filter(
        (page) =>
          page && typeof page === 'object' && (Array.isArray(page.messages) || !!page.messageMap)
      )
      .map((page) => this.parseConversation(page))
  }

  private buildMessageSource(page: PointerPage): PointerMessage[] {
    const messages = Array.isArray(page.messages) ? page.messages : []

    if (messages.length === 0) {
      return page.messageMap ? Object.values(page.messageMap) : []
    }

    if (!page.messageMap) {
      return messages
    }

    return messages.map((msg) => this.mergeMessage(msg, page.messageMap?.[msg.id]))
  }

  private mergeMessage(primary: PointerMessage, fallback?: PointerMessage): PointerMessage {
    if (!fallback) {
      return primary
    }

    return {
      ...fallback,
      ...primary,
      content: isBlankText(primary.content)
        ? (fallback.content ?? primary.content)
        : primary.content,
      reasoning_content: isBlankText(primary.reasoning_content)
        ? (fallback.reasoning_content ?? primary.reasoning_content)
        : primary.reasoning_content,
      parentId: primary.parentId ?? fallback.parentId,
      children: primary.children ?? fallback.children,
      timestamp: primary.timestamp ?? fallback.timestamp,
      modelId: primary.modelId ?? fallback.modelId
    }
  }

  /**
   * 解析单个对话
   */
  private parseConversation(page: PointerPage): ParsedConversation {
    const messages: ParsedMessage[] = []

    // 构建父子关系映射（从 children 转换为 parentMessageId）
    const parentMap = new Map<string, string>()
    const messageSource = this.buildMessageSource(page)

    // 第一遍：构建 children -> parent 映射
    for (const msg of messageSource) {
      if (msg.children && msg.children.length > 0) {
        for (const childId of msg.children) {
          parentMap.set(childId, msg.id)
        }
      }
    }

    // 构建 mapping 结构用于计算 branchIndex
    const mapping: Record<string, { children: string[] }> = {}
    for (const msg of messageSource) {
      mapping[msg.id] = { children: msg.children || [] }
    }

    // 第二遍：解析消息
    for (const msg of messageSource) {
      const parsedMsg = this.parseMessage(msg, parentMap)
      if (parsedMsg) {
        messages.push(parsedMsg)
      }
    }

    // 计算 branchIndex
    this.calculateBranchIndices(mapping, messages)

    // 叶子消息从 currentPath 获取，或者找没有子消息的消息
    let leafMessageId: string | undefined
    if (page.currentPath && page.currentPath.length > 0) {
      const currentLeafId = page.currentPath[page.currentPath.length - 1]
      leafMessageId = mapping[currentLeafId] ? currentLeafId : undefined
    }

    if (!leafMessageId) {
      leafMessageId = this.findLeafNode(mapping)
    }

    return {
      id: page.id || this.generateId(),
      title: page.title || 'Untitled',
      platform: 'custom',
      createdAt: page.createdAt ?? Date.now(),
      updatedAt: page.updatedAt,
      messages,
      leafMessageId
    }
  }

  /**
   * 解析单条消息
   */
  private parseMessage(msg: PointerMessage, parentMap: Map<string, string>): ParsedMessage | null {
    if (!msg.id || !msg.role) {
      return null
    }

    // 从 parentMap 获取父消息 ID，如果没有则使用消息自带的 parentId
    const parentMessageId = parentMap.get(msg.id) || msg.parentId

    return {
      id: msg.id,
      role: msg.role,
      content: msg.content ?? '',
      reasoning_content: msg.reasoning_content,
      createdAt: this.parseTimestamp(msg.timestamp),
      parentMessageId,
      model: msg.modelId
    }
  }
}
