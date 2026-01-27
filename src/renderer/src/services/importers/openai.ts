/**
 * OpenAI / ChatGPT 聊天记录导入器
 */

import { BaseImporter } from './base'
import type { OpenAIExport, OpenAIMappingNode, ParsedConversation, ParsedMessage } from './types'

export class OpenAIImporter extends BaseImporter {
  platform = 'openai' as const
  name = 'OpenAI / ChatGPT'
  description = '导入 ChatGPT 导出的 conversations.json'

  /**
   * 检测是否为 OpenAI 格式
   */
  detect(data: unknown): boolean {
    if (!Array.isArray(data)) return false
    if (data.length === 0) return true // 空数组也认为是有效的

    const first = data[0]
    if (typeof first !== 'object' || first === null) return false

    // OpenAI 格式特征：有 mapping 和 current_node 字段
    return 'mapping' in first && 'current_node' in first
  }

  /**
   * 解析 OpenAI 导出数据
   */
  parse(data: unknown): ParsedConversation[] {
    if (!Array.isArray(data)) return []
    return (data as OpenAIExport[])
      .filter((conv) => conv && typeof conv === 'object' && conv.mapping)
      .map((conv) => this.parseConversation(conv))
  }

  /**
   * 解析单个对话
   */
  private parseConversation(conv: OpenAIExport): ParsedConversation {
    const messages: ParsedMessage[] = []
    const mapping = conv.mapping

    // 第一遍：识别需要跳过的节点，并建立父节点重映射
    const skippedNodes = new Set<string>()
    const parentRemap = new Map<string, string | undefined>()

    for (const [id, node] of Object.entries(mapping)) {
      if (this.shouldSkipNode(node)) {
        skippedNodes.add(id)
        // 记录被跳过节点的父节点，用于重映射
        parentRemap.set(id, node.parent || undefined)
      }
    }

    // 解析函数：查找有效的父节点（跳过被过滤的节点）
    const findValidParent = (parentId: string | null | undefined): string | undefined => {
      if (!parentId || parentId === 'client-created-root') return undefined

      // 如果父节点被跳过，继续向上查找
      let currentParent: string | undefined = parentId
      while (currentParent && skippedNodes.has(currentParent)) {
        currentParent = parentRemap.get(currentParent)
      }

      return currentParent
    }

    // 第二遍：解析消息，使用重映射的父节点
    for (const [id, node] of Object.entries(mapping)) {
      if (skippedNodes.has(id)) continue

      const msg = this.parseMessageNode(id, node, findValidParent)
      if (msg) {
        messages.push(msg)
      }
    }

    // 计算 branchIndex
    this.calculateBranchIndices(mapping, messages)

    // 找到根消息
    const rootMessage = this.findRootMessage(messages)

    // 找到有效的叶子节点（current_node 可能指向被跳过的节点）
    let leafMessageId: string | undefined = conv.current_node
    if (leafMessageId && skippedNodes.has(leafMessageId)) {
      // 如果 current_node 被跳过，尝试找到它的最后一个有效子节点
      leafMessageId = this.findValidLeaf(mapping, leafMessageId, skippedNodes)
    }

    return {
      id: conv.conversation_id || conv.id || this.generateId(),
      title: conv.title || 'Untitled',
      platform: 'openai',
      createdAt: this.parseTimestamp(conv.create_time),
      updatedAt: this.parseTimestamp(conv.update_time),
      messages,
      leafMessageId
    }
  }

  /**
   * 判断节点是否应该被跳过
   */
  private shouldSkipNode(node: OpenAIMappingNode): boolean {
    if (!node.message) return true

    const msg = node.message

    // 跳过隐藏的消息
    if (msg.metadata?.is_visually_hidden_from_conversation) {
      return true
    }

    // 获取消息内容
    const content = msg.content?.parts?.join('\n') || ''

    // 跳过空内容的 system 消息
    if (!content && msg.author.role === 'system') {
      return true
    }

    // 跳过空内容的 assistant 消息（通常是 OpenAI 的占位符节点）
    if (!content && msg.author.role === 'assistant') {
      return true
    }

    return false
  }

  /**
   * 解析单条消息节点
   */
  private parseMessageNode(
    id: string,
    node: OpenAIMappingNode,
    findValidParent: (parentId: string | null | undefined) => string | undefined
  ): ParsedMessage | null {
    if (!node.message) return null

    const msg = node.message
    const content = msg.content?.parts?.join('\n') || ''
    const parentMessageId = findValidParent(node.parent)

    return {
      id,
      role: msg.author.role,
      content,
      createdAt: this.parseTimestamp(msg.create_time),
      parentMessageId,
      model: msg.metadata?.model_slug
    }
  }

  /**
   * 查找有效的叶子节点
   */
  private findValidLeaf(
    mapping: Record<string, OpenAIMappingNode>,
    nodeId: string,
    skippedNodes: Set<string>
  ): string | undefined {
    const node = mapping[nodeId]
    if (!node) return undefined

    // 如果当前节点未被跳过，返回它
    if (!skippedNodes.has(nodeId)) {
      return nodeId
    }

    // 否则，在子节点中查找
    if (node.children && node.children.length > 0) {
      for (const childId of node.children) {
        const result = this.findValidLeaf(mapping, childId, skippedNodes)
        if (result) return result
      }
    }

    return undefined
  }
}
