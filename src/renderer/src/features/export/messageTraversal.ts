/**
 * 导出用的消息遍历
 *
 * 「某条消息的子树」「某个 Topic 区间内的消息」这两类遍历在导出插件、TXT 格式与选择器面板里
 * 各写过一份，这里统一成纯函数。
 */

import type { ChatMessage } from '@shared/domain'

/**
 * 从 startMessageId 起按深度优先收集子树消息（含起始消息）
 *
 * 遇到 endMessageId 即停止该分支；消息不存在或成环时会被跳过。
 */
export function collectSubtreeMessages(
  messages: readonly ChatMessage[],
  startMessageId: string,
  endMessageId?: string
): ChatMessage[] {
  const messageMap = new Map(messages.map((message) => [message.id, message]))
  const result: ChatMessage[] = []
  const visited = new Set<string>()

  const collect = (id: string): void => {
    if (visited.has(id)) return
    visited.add(id)

    const message = messageMap.get(id)
    if (!message) return

    result.push(message)
    if (endMessageId && id === endMessageId) return

    for (const child of messages) {
      if (child.parentMessageId === id) collect(child.id)
    }
  }

  collect(startMessageId)
  return result
}

/** 同 collectSubtreeMessages，但只返回消息 id */
export function collectSubtreeIds(
  messages: readonly ChatMessage[],
  startMessageId: string,
  endMessageId?: string
): string[] {
  return collectSubtreeMessages(messages, startMessageId, endMessageId).map((message) => message.id)
}

/**
 * 收集某个 Topic 直接包含的消息
 *
 * 与 collectSubtreeMessages 的区别：落到另一个 Topic 的起点就停，避免把子话题的消息算进来。
 */
export function getDirectTopicMessages(
  messages: readonly ChatMessage[],
  startMessageId: string,
  endMessageId: string | undefined,
  allTopicStartIds: ReadonlySet<string>
): ChatMessage[] {
  const messageMap = new Map(messages.map((message) => [message.id, message]))
  const result: ChatMessage[] = []
  const visited = new Set<string>()

  const collect = (id: string): void => {
    if (visited.has(id)) return
    visited.add(id)

    const message = messageMap.get(id)
    if (!message) return

    result.push(message)
    if (endMessageId && id === endMessageId) return

    for (const child of messages) {
      if (child.parentMessageId !== id) continue
      // 子消息若开启了新话题，则不属于当前话题
      if (allTopicStartIds.has(child.id) && child.id !== startMessageId) continue
      collect(child.id)
    }
  }

  collect(startMessageId)
  return result
}
