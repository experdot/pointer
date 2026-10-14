/**
 * 会话大纲
 */

import type { ChatMessage, MessageRole } from './chat'
import type { TopicGroup } from './messageTree'

export interface OutlineNode {
  id: string
  title: string
  /** topic：Topic 起始节点；title：带标题的消息；untitled：无标题消息 */
  type: 'topic' | 'title' | 'untitled'
  messageId: string
  topicId?: string
  role?: MessageRole
  children?: OutlineNode[]
  collapsed?: boolean
}

/** 取消息内容的前若干字符作为标题 */
export function contentPreview(content: string, maxLength = 30): string {
  const text = content.replace(/\n/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

/**
 * 计算大纲：Topic 作为顶级节点，其下挂载消息节点；
 * 不在任何 Topic 内的消息直接作为顶级节点
 */
export function computeOutline(
  topicGroups: readonly TopicGroup[],
  path: readonly ChatMessage[]
): OutlineNode[] {
  const outline: OutlineNode[] = []
  const pathById = new Map(path.map((message) => [message.id, message]))
  const ownerByMessageId = new Map<string, OutlineNode>()

  // 第一遍：建立 Topic 节点，并标记其覆盖的消息归属
  for (const group of topicGroups) {
    const startMessage = pathById.get(group.startMessageId)
    if (!startMessage) continue

    const topicNode: OutlineNode = {
      id: `topic-${group.topicId}`,
      title: group.name,
      type: 'topic',
      messageId: group.startMessageId,
      topicId: group.topicId,
      role: startMessage.role,
      children: [],
      collapsed: group.collapsed
    }

    for (const messageId of group.messageIds) {
      ownerByMessageId.set(messageId, topicNode)
    }
  }

  // 第二遍：按路径顺序输出，Topic 起始消息作为顶级节点
  for (const message of path) {
    const node: OutlineNode = message.title
      ? {
          id: `title-${message.id}`,
          title: message.title,
          type: 'title',
          messageId: message.id,
          role: message.role
        }
      : {
          id: `untitled-${message.id}`,
          title: contentPreview(message.content),
          type: 'untitled',
          messageId: message.id,
          role: message.role
        }

    const owner = ownerByMessageId.get(message.id)
    if (!owner) {
      outline.push(node)
      continue
    }

    if (owner.messageId === message.id) {
      outline.push(owner)
    }
    owner.children?.push(node)
  }

  return outline
}
