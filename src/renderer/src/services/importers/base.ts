/**
 * 第三方聊天数据导入 - 基础转换器类
 */

import type {
  ConversationImporter,
  ImportPlatform,
  ParsedConversation,
  ParsedMessage
} from './types'

export abstract class BaseImporter implements ConversationImporter {
  abstract platform: ImportPlatform
  abstract name: string
  abstract description: string

  abstract detect(data: unknown): boolean
  abstract parse(data: unknown): ParsedConversation[]

  /**
   * 生成唯一 ID
   */
  protected generateId(): string {
    return crypto.randomUUID()
  }

  /**
   * 解析时间戳
   * 支持：Unix 时间戳（秒/毫秒）、ISO 8601 字符串
   */
  protected parseTimestamp(value: number | string | null | undefined): number {
    if (value === null || value === undefined) {
      return Date.now()
    }

    if (typeof value === 'number') {
      // Unix timestamp: 判断是秒还是毫秒
      // 如果小于 1e12，认为是秒；否则是毫秒
      return value > 1e12 ? value : value * 1000
    }

    if (typeof value === 'string') {
      const parsed = new Date(value).getTime()
      return isNaN(parsed) ? Date.now() : parsed
    }

    return Date.now()
  }

  /**
   * 计算分支索引
   * 当一个父节点有多个子节点时，为每个子节点分配 branchIndex
   */
  protected calculateBranchIndices(
    mapping: Record<string, { children: string[] }>,
    messages: ParsedMessage[]
  ): void {
    // 创建 ID 到消息的映射
    const messageMap = new Map<string, ParsedMessage>()
    messages.forEach((m) => messageMap.set(m.id, m))

    // 遍历 mapping，为有多个子节点的父节点设置 branchIndex
    for (const node of Object.values(mapping)) {
      if (node.children.length > 1) {
        node.children.forEach((childId, index) => {
          const childMsg = messageMap.get(childId)
          if (childMsg) {
            childMsg.branchIndex = index
          }
        })
      }
    }
  }

  /**
   * 找到叶子节点（没有子节点的消息）
   */
  protected findLeafNode(mapping: Record<string, { children: string[] }>): string | undefined {
    for (const [id, node] of Object.entries(mapping)) {
      if (node.children.length === 0 && id !== 'root' && id !== 'client-created-root') {
        return id
      }
    }
    return undefined
  }

  /**
   * 查找根消息（没有父消息的可见消息）
   */
  protected findRootMessage(messages: ParsedMessage[]): ParsedMessage | undefined {
    return messages.find((m) => !m.parentMessageId && !m.hidden)
  }
}
