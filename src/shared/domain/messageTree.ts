/**
 * 消息树纯函数：索引、路径、分支与变更
 *
 * 所有变更函数返回新的 Conversation，不修改入参。
 */

import type { Diagnostic } from './common'
import type { ChatMessage, Conversation, MessageDraft, Topic } from './chat'

interface MessageIndex {
  byId: Map<string, ChatMessage>
  /** 父节点 id（根节点为 undefined）到有序子节点列表 */
  childrenByParent: Map<string | undefined, ChatMessage[]>
}

/** 构建消息索引；同级子节点按 branchIndex 升序 */
export function buildIndex(messages: readonly ChatMessage[]): MessageIndex {
  const byId = new Map<string, ChatMessage>()
  const childrenByParent = new Map<string | undefined, ChatMessage[]>()

  for (const message of messages) {
    byId.set(message.id, message)
    const siblings = childrenByParent.get(message.parentMessageId) ?? []
    siblings.push(message)
    childrenByParent.set(message.parentMessageId, siblings)
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => a.branchIndex - b.branchIndex || a.createdAt - b.createdAt)
  }

  return { byId, childrenByParent }
}

export function childMessages(index: MessageIndex, parentMessageId?: string): ChatMessage[] {
  return index.childrenByParent.get(parentMessageId) ?? []
}

/** 某父节点下下一个可用的分支序号 */
export function nextBranchIndex(index: MessageIndex, parentMessageId?: string): number {
  return childMessages(index, parentMessageId).reduce(
    (max, message) => Math.max(max, message.branchIndex + 1),
    0
  )
}

/** 从指定消息向上回溯到根，返回自根向下的路径 */
export function pathToMessage(index: MessageIndex, messageId?: string): ChatMessage[] {
  if (!messageId) return []

  const path: ChatMessage[] = []
  const visited = new Set<string>()
  let currentId: string | undefined = messageId

  while (currentId) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    const message = index.byId.get(currentId)
    if (!message) break
    path.unshift(message)
    currentId = message.parentMessageId
  }

  return path
}

/**
 * 解析当前叶子节点
 * 优先使用给定 id，若无效则沿每层分支序号最大的子节点向下寻找最深节点
 */
export function resolveLeafId(index: MessageIndex, preferredLeafId?: string): string | undefined {
  if (preferredLeafId && index.byId.has(preferredLeafId)) {
    return preferredLeafId
  }

  const roots = childMessages(index, undefined)
  if (roots.length === 0) return undefined

  let current = roots[roots.length - 1]
  const visited = new Set<string>([current.id])

  for (;;) {
    const children = childMessages(index, current.id)
    if (children.length === 0) return current.id
    const next = children[children.length - 1]
    if (visited.has(next.id)) return current.id
    visited.add(next.id)
    current = next
  }
}

/** 当前路径（自根到叶子） */
export function currentPath(conversation: Conversation): ChatMessage[] {
  const index = buildIndex(conversation.messages)
  return pathToMessage(index, resolveLeafId(index, conversation.leafMessageId))
}

/** nodeId 是否是 ancestorId 的后代（含自身） */
export function isDescendantOf(index: MessageIndex, ancestorId: string, nodeId: string): boolean {
  const visited = new Set<string>()
  let currentId: string | undefined = nodeId

  while (currentId) {
    if (currentId === ancestorId) return true
    if (visited.has(currentId)) return false
    visited.add(currentId)
    currentId = index.byId.get(currentId)?.parentMessageId
  }

  return false
}

/** 子树所有节点 id（含自身）；visited 守卫保证损伤数据成环时也能终止 */
export function subtreeIds(index: MessageIndex, messageId: string): string[] {
  const result: string[] = []
  const visited = new Set<string>()
  const stack = [messageId]

  while (stack.length > 0) {
    const current = stack.pop() as string
    if (visited.has(current)) continue
    visited.add(current)
    result.push(current)
    for (const child of childMessages(index, current)) {
      stack.push(child.id)
    }
  }

  return result
}

/**
 * 从指定消息开始沿"第一个子节点"向下找到叶子
 *
 * 用于切换分支：切到某个分支后，当前路径应显示该分支的完整链路
 * （迁移前的行为就是取 children[0] 一路到底）。
 */
export function firstLeafOf(index: MessageIndex, messageId: string): string {
  let currentId = messageId
  const visited = new Set<string>([currentId])

  for (;;) {
    const children = childMessages(index, currentId)
    if (children.length === 0) return currentId
    const next = children[0]
    if (visited.has(next.id)) return currentId
    visited.add(next.id)
    currentId = next.id
  }
}

/**
 * 校验会话不变量
 */
export function validateConversation(conversation: Conversation): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const index = buildIndex(conversation.messages)

  if (index.byId.size !== conversation.messages.length) {
    const seen = new Set<string>()
    for (const message of conversation.messages) {
      if (seen.has(message.id)) {
        diagnostics.push({
          code: 'chat.duplicate-id',
          message: `存在重复的消息 id：${message.id}`,
          entityId: message.id
        })
      }
      seen.add(message.id)
    }
  }

  for (const message of conversation.messages) {
    if (message.parentMessageId && !index.byId.has(message.parentMessageId)) {
      diagnostics.push({
        code: 'chat.missing-parent',
        message: `消息 ${message.id} 的父消息不存在`,
        entityId: message.id
      })
    }
    if (isCyclic(index, message.id)) {
      diagnostics.push({
        code: 'chat.cycle',
        message: `消息树存在循环引用：${message.id}`,
        entityId: message.id
      })
    }
  }

  for (const [parentId, siblings] of index.childrenByParent) {
    const seen = new Set<number>()
    for (const sibling of siblings) {
      if (seen.has(sibling.branchIndex)) {
        diagnostics.push({
          code: 'chat.branch-index-conflict',
          message: `父节点 ${parentId ?? '(root)'} 下存在重复分支序号 ${sibling.branchIndex}`,
          entityId: sibling.id
        })
      }
      seen.add(sibling.branchIndex)
    }
  }

  if (conversation.leafMessageId && !index.byId.has(conversation.leafMessageId)) {
    diagnostics.push({
      code: 'chat.leaf-not-found',
      message: `leafMessageId 指向不存在的消息：${conversation.leafMessageId}`,
      entityId: conversation.leafMessageId
    })
  }

  if (conversation.selectedMessageId && !index.byId.has(conversation.selectedMessageId)) {
    diagnostics.push({
      code: 'chat.selected-not-found',
      message: `selectedMessageId 指向不存在的消息：${conversation.selectedMessageId}`,
      entityId: conversation.selectedMessageId
    })
  }

  const topicStartIds = new Set<string>()
  for (const topic of conversation.topics) {
    if (!index.byId.has(topic.startMessageId)) {
      diagnostics.push({
        code: 'topic.start-not-found',
        message: `Topic「${topic.name}」的起始消息不存在`,
        entityId: topic.id
      })
    }
    if (topicStartIds.has(topic.startMessageId)) {
      diagnostics.push({
        code: 'topic.duplicate-start',
        message: `存在多个 Topic 以同一消息起始：${topic.startMessageId}`,
        entityId: topic.id
      })
    }
    topicStartIds.add(topic.startMessageId)

    if (topic.endMessageId) {
      if (!index.byId.has(topic.endMessageId)) {
        diagnostics.push({
          code: 'topic.end-not-found',
          message: `Topic「${topic.name}」的结束消息不存在`,
          entityId: topic.id
        })
      } else if (!isDescendantOf(index, topic.startMessageId, topic.endMessageId)) {
        diagnostics.push({
          code: 'topic.range-not-on-path',
          message: `Topic「${topic.name}」的结束消息不在起始消息的路径上`,
          entityId: topic.id
        })
      }
    }
  }

  return diagnostics
}

function isCyclic(index: MessageIndex, messageId: string): boolean {
  const visited = new Set<string>()
  let currentId: string | undefined = messageId

  while (currentId) {
    if (visited.has(currentId)) return true
    visited.add(currentId)
    currentId = index.byId.get(currentId)?.parentMessageId
  }

  return false
}

/**
 * 追加消息：自动分配 branchIndex，并将新消息设为当前路径终点
 */
export function appendMessage(
  conversation: Conversation,
  draft: MessageDraft,
  at: number
): { conversation: Conversation; message: ChatMessage } {
  const index = buildIndex(conversation.messages)
  const message: ChatMessage = {
    ...draft,
    branchIndex: nextBranchIndex(index, draft.parentMessageId),
    createdAt: at
  }

  return {
    conversation: {
      ...conversation,
      messages: [...conversation.messages, message],
      leafMessageId: message.id,
      updatedAt: at
    },
    message
  }
}

export function updateMessage(
  conversation: Conversation,
  messageId: string,
  patch: Partial<Omit<ChatMessage, 'id' | 'createdAt'>>,
  at: number
): Conversation {
  if (!conversation.messages.some((message) => message.id === messageId)) {
    return conversation
  }

  return {
    ...conversation,
    messages: conversation.messages.map((message) =>
      message.id === messageId ? { ...message, ...patch, updatedAt: at } : message
    ),
    updatedAt: at
  }
}

/**
 * 删除消息及其整个子树
 * 同时修正 leaf/selected 指向，并清理受影响的 Topic 边界
 */
export function deleteMessage(
  conversation: Conversation,
  messageId: string,
  at: number
): Conversation {
  const index = buildIndex(conversation.messages)
  const target = index.byId.get(messageId)
  if (!target) return conversation

  const removed = new Set(subtreeIds(index, messageId))
  const messages = conversation.messages.filter((message) => !removed.has(message.id))
  const nextIndex = buildIndex(messages)

  const leafMessageId =
    conversation.leafMessageId && !removed.has(conversation.leafMessageId)
      ? conversation.leafMessageId
      : fallbackLeafAfterDelete(index, target, removed, nextIndex)

  const topics = conversation.topics
    .filter((topic) => !removed.has(topic.startMessageId))
    .map((topic) =>
      topic.endMessageId && removed.has(topic.endMessageId)
        ? { ...topic, endMessageId: undefined }
        : topic
    )

  return {
    ...conversation,
    messages,
    topics,
    leafMessageId,
    selectedMessageId:
      conversation.selectedMessageId && !removed.has(conversation.selectedMessageId)
        ? conversation.selectedMessageId
        : undefined,
    updatedAt: at
  }
}

/**
 * 删除子树后选择新的叶子
 *
 * 与迁移前一致：优先回退到"被删除消息的前一个兄弟分支"的叶子，
 * 没有前一个兄弟时回退到父消息。
 */
function fallbackLeafAfterDelete(
  index: MessageIndex,
  target: ChatMessage,
  removed: ReadonlySet<string>,
  nextIndex: MessageIndex
): string | undefined {
  const siblings = childMessages(index, target.parentMessageId)
  const deletedIndex = siblings.findIndex((message) => message.id === target.id)
  const remaining = siblings.filter((message) => !removed.has(message.id))

  if (remaining.length === 0) return target.parentMessageId

  const targetIndex = Math.min(Math.max(0, deletedIndex - 1), remaining.length - 1)
  return firstLeafOf(nextIndex, remaining[targetIndex].id)
}

/** 切换当前路径：将 leaf 指向指定消息 */
export function setLeaf(
  conversation: Conversation,
  messageId: string | undefined,
  at: number
): Conversation {
  const index = buildIndex(conversation.messages)
  return {
    ...conversation,
    leafMessageId: resolveLeafId(index, messageId),
    updatedAt: at
  }
}

export function setSelected(
  conversation: Conversation,
  messageId: string | undefined
): Conversation {
  return { ...conversation, selectedMessageId: messageId }
}

/**
 * 切换分支
 *
 * 与迁移前一致：leaf 指向该分支链路最深的叶子，同时把 selected 设为被点击的消息
 * （用于切换后滚动定位）。
 */
export function switchBranchToMessage(
  conversation: Conversation,
  messageId: string,
  at: number
): Conversation {
  const index = buildIndex(conversation.messages)
  if (!index.byId.has(messageId)) return conversation

  return {
    ...conversation,
    leafMessageId: firstLeafOf(index, messageId),
    selectedMessageId: messageId,
    updatedAt: at
  }
}

/** 批量给多条消息打同一个补丁（一次写入，避免逐条重写会话文件） */
export function updateMessages(
  conversation: Conversation,
  messageIds: readonly string[],
  patch: Partial<Omit<ChatMessage, 'id' | 'createdAt'>>,
  at: number
): Conversation {
  const targets = new Set(messageIds)
  if (targets.size === 0) return conversation

  let changed = false
  const messages = conversation.messages.map((message) => {
    if (!targets.has(message.id)) return message
    changed = true
    return { ...message, ...patch, updatedAt: at }
  })

  return changed ? { ...conversation, messages, updatedAt: at } : conversation
}

/** 归一化同级分支序号（删除后可能出现空洞） */
export function normalizeSiblingIndexes(conversation: Conversation, at: number): Conversation {
  const index = buildIndex(conversation.messages)
  const orderById = new Map<string, number>()

  for (const siblings of index.childrenByParent.values()) {
    siblings.forEach((message, position) => orderById.set(message.id, position))
  }

  let changed = false
  const messages = conversation.messages.map((message) => {
    const order = orderById.get(message.id)
    if (order === undefined || order === message.branchIndex) return message
    changed = true
    return { ...message, branchIndex: order, updatedAt: at }
  })

  return changed ? { ...conversation, messages, updatedAt: at } : conversation
}

// ==================== Topic 变更 ====================

interface CreateTopicInput {
  id: string
  name: string
  startMessageId: string
  endMessageId?: string
}

/** 创建 Topic，区间必须落在同一路径上 */
export function createTopic(
  conversation: Conversation,
  input: CreateTopicInput,
  at: number
): Conversation {
  const index = buildIndex(conversation.messages)
  if (!index.byId.has(input.startMessageId)) return conversation
  if (input.endMessageId && !isDescendantOf(index, input.startMessageId, input.endMessageId)) {
    return conversation
  }

  const topic: Topic = {
    id: input.id,
    name: input.name,
    startMessageId: input.startMessageId,
    endMessageId: input.endMessageId,
    collapsed: false
  }

  return { ...conversation, topics: [...conversation.topics, topic], updatedAt: at }
}

export function updateTopic(
  conversation: Conversation,
  topicId: string,
  patch: Partial<Pick<Topic, 'name' | 'endMessageId' | 'collapsed'>>,
  at: number
): Conversation {
  const index = buildIndex(conversation.messages)

  return {
    ...conversation,
    topics: conversation.topics.map((topic) => {
      if (topic.id !== topicId) return topic
      const nextEnd = patch.endMessageId !== undefined ? patch.endMessageId : topic.endMessageId
      if (nextEnd && !isDescendantOf(index, topic.startMessageId, nextEnd)) {
        return { ...topic, ...patch, endMessageId: undefined }
      }
      return { ...topic, ...patch }
    }),
    updatedAt: at
  }
}

export function deleteTopic(conversation: Conversation, topicId: string, at: number): Conversation {
  return {
    ...conversation,
    topics: conversation.topics.filter((t) => t.id !== topicId),
    updatedAt: at
  }
}

/** 依据当前路径计算每个 Topic 的实际消息范围 */
export interface TopicGroup {
  topicId: string
  name: string
  startMessageId: string
  endMessageId: string
  messageIds: string[]
  collapsed: boolean
}

export function computeTopicGroups(
  topics: readonly Topic[],
  path: readonly ChatMessage[]
): TopicGroup[] {
  if (path.length === 0 || topics.length === 0) return []

  const indexOf = new Map<string, number>()
  path.forEach((message, position) => indexOf.set(message.id, position))

  const valid = topics
    .filter((topic) => indexOf.has(topic.startMessageId))
    .map((topic) => ({ topic, startIndex: indexOf.get(topic.startMessageId) as number }))
    .sort((a, b) => a.startIndex - b.startIndex)

  const groups: TopicGroup[] = []

  valid.forEach(({ topic, startIndex }, position) => {
    const explicitEnd =
      topic.endMessageId && indexOf.has(topic.endMessageId)
        ? (indexOf.get(topic.endMessageId) as number)
        : undefined
    const nextStart =
      position + 1 < valid.length ? valid[position + 1].startIndex - 1 : path.length - 1
    const endIndex = Math.max(startIndex, explicitEnd ?? nextStart)

    groups.push({
      topicId: topic.id,
      name: topic.name,
      startMessageId: topic.startMessageId,
      endMessageId: path[endIndex].id,
      messageIds: path.slice(startIndex, endIndex + 1).map((message) => message.id),
      collapsed: topic.collapsed
    })
  })

  return groups
}

/** 折叠的 Topic 只保留首条消息 */
export function filterByTopicCollapse(
  messages: readonly ChatMessage[],
  groups: readonly TopicGroup[]
): ChatMessage[] {
  const hidden = new Set<string>()

  for (const group of groups) {
    if (group.collapsed && group.messageIds.length > 1) {
      group.messageIds.slice(1).forEach((id) => hidden.add(id))
    }
  }

  return messages.filter((message) => !hidden.has(message.id))
}

export function findTopicByStartMessageId(
  topics: readonly Topic[],
  messageId: string
): Topic | undefined {
  return topics.find((topic) => topic.startMessageId === messageId)
}

export function getMessageTopicInfo(
  groups: readonly TopicGroup[],
  messageId: string
): { topicId: string; topicName: string; topicMessageId: string } | null {
  for (const group of groups) {
    if (group.messageIds.includes(messageId)) {
      return {
        topicId: group.topicId,
        topicName: group.name,
        topicMessageId: group.startMessageId
      }
    }
  }

  return null
}
