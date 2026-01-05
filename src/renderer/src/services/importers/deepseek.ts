/**
 * DeepSeek 聊天记录导入器
 */

import { BaseImporter } from './base'
import type {
  DeepSeekExport,
  DeepSeekMappingNode,
  ParsedConversation,
  ParsedMessage
} from './types'

export class DeepSeekImporter extends BaseImporter {
  platform = 'deepseek' as const
  name = 'DeepSeek'
  description = '导入 DeepSeek 导出的聊天记录'

  /**
   * 检测是否为 DeepSeek 格式
   */
  detect(data: unknown): boolean {
    if (!Array.isArray(data)) return false
    if (data.length === 0) return true // 空数组也认为是有效的

    const first = data[0]
    if (typeof first !== 'object' || first === null) return false

    // DeepSeek 格式特征：有 mapping 且 mapping 中有 root 节点，但没有 current_node
    return (
      'mapping' in first &&
      typeof first.mapping === 'object' &&
      first.mapping !== null &&
      'root' in first.mapping &&
      !('current_node' in first)
    )
  }

  /**
   * 解析 DeepSeek 导出数据
   */
  parse(data: unknown): ParsedConversation[] {
    if (!Array.isArray(data)) return []
    return (data as DeepSeekExport[])
      .filter((conv) => conv && typeof conv === 'object' && conv.mapping)
      .map((conv) => this.parseConversation(conv))
  }

  /**
   * 解析单个对话
   */
  private parseConversation(conv: DeepSeekExport): ParsedConversation {
    const messages: ParsedMessage[] = []
    const mapping = conv.mapping

    // 遍历 mapping，转换消息
    for (const [id, node] of Object.entries(mapping)) {
      const msg = this.parseMessage(id, node)
      if (msg) {
        messages.push(msg)
      }
    }

    // 计算 branchIndex
    this.calculateBranchIndices(mapping, messages)

    // 找到根消息和叶子消息
    const rootMessage = this.findRootMessage(messages)
    const leafId = this.findLeafNode(mapping)

    return {
      id: conv.id || this.generateId(),
      title: conv.title || 'Untitled',
      platform: 'deepseek',
      createdAt: this.parseTimestamp(conv.inserted_at),
      updatedAt: this.parseTimestamp(conv.updated_at),
      messages,
      rootMessageId: rootMessage?.id,
      leafMessageId: leafId
    }
  }

  /**
   * 解析单条消息
   */
  private parseMessage(id: string, node: DeepSeekMappingNode): ParsedMessage | null {
    // 跳过 root 节点
    if (id === 'root' || !node.message) {
      return null
    }

    const msg = node.message

    // DeepSeek 使用 fragments 存储内容
    const fragment = msg.fragments?.[0]
    if (!fragment) {
      return null
    }

    // 根据 fragment type 确定角色
    const role = fragment.type === 'REQUEST' ? 'user' : 'assistant'

    // 确定父消息 ID（排除 root 节点）
    const parentMessageId = node.parent === 'root' ? undefined : node.parent || undefined

    return {
      id,
      role,
      content: fragment.content,
      createdAt: this.parseTimestamp(msg.inserted_at),
      parentMessageId,
      model: msg.model
    }
  }
}
