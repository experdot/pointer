import { v4 as uuidv4 } from 'uuid'
import { stores } from '../stores/registry'
import type { ChatMessage, Topic, TopicGroup, OutlineNode } from '../types/type'

// ==================== 预构建索引 ====================

interface MessageMaps {
  messageMap: Map<string, ChatMessage>
  childrenMap: Map<string | undefined, ChatMessage[]>
}

function buildMessageMaps(messages: ChatMessage[]): MessageMaps {
  const messageMap = new Map<string, ChatMessage>()
  const childrenMap = new Map<string | undefined, ChatMessage[]>()

  for (const msg of messages) {
    messageMap.set(msg.id, msg)
    const parentId = msg.parentMessageId
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId)!.push(msg)
  }

  // 对每个 children 数组按 branchIndex 排序
  for (const children of childrenMap.values()) {
    children.sort((a, b) => (a.branchIndex ?? 0) - (b.branchIndex ?? 0))
  }

  return { messageMap, childrenMap }
}

// ==================== 消息 CRUD ====================

export async function addMessage(
  pageId: string,
  message: Omit<ChatMessage, 'id' | 'createdAt'>
): Promise<ChatMessage> {
  const newMessage: ChatMessage = {
    ...message,
    id: uuidv4(),
    createdAt: Date.now()
  }

  await stores.message.addMessage(pageId, newMessage)
  return newMessage
}

export async function updateMessage(
  pageId: string,
  messageId: string,
  updates: Partial<ChatMessage>
): Promise<void> {
  await stores.message.updateMessage(pageId, messageId, updates)
}

export async function deleteMessage(pageId: string, messageId: string): Promise<void> {
  const record = stores.message.get(pageId)
  if (!record) return

  const { messageMap, childrenMap } = buildMessageMaps(record.messages)

  // 获取要删除的消息及其所有子消息 - O(N) 而非 O(N²)
  const idsToDelete = getDescendantIds(childrenMap, messageId)
  idsToDelete.add(messageId)

  const deletedMsg = messageMap.get(messageId)

  // 计算新的 leafMessageId
  let leafMessageId = record.leafMessageId
  if (leafMessageId && idsToDelete.has(leafMessageId)) {
    // 获取原始的 siblings（包含被删除的消息）
    const allSiblings = childrenMap.get(deletedMsg?.parentMessageId) ?? []
    // 找到被删除消息在兄弟中的位置
    const deletedIndex = allSiblings.findIndex((m) => m.id === messageId)
    // 过滤掉要删除的消息
    const remainingSiblings = allSiblings.filter((m) => !idsToDelete.has(m.id))

    if (remainingSiblings.length > 0) {
      // 优先选择上一个分支（index - 1），否则选择下一个
      const targetIndex = Math.min(Math.max(0, deletedIndex - 1), remainingSiblings.length - 1)
      const targetSibling = remainingSiblings[targetIndex]

      const remainingMessages = record.messages.filter((m) => !idsToDelete.has(m.id))
      const { childrenMap: remainingChildrenMap } = buildMessageMaps(remainingMessages)
      leafMessageId = findLeafFromMessage(remainingChildrenMap, targetSibling.id)
    } else {
      leafMessageId = deletedMsg?.parentMessageId
    }
  }

  // 计算新的 rootMessageId
  let rootMessageId = record.rootMessageId
  if (rootMessageId && idsToDelete.has(rootMessageId)) {
    const rootMessages = (childrenMap.get(undefined) ?? []).filter((m) => !idsToDelete.has(m.id))
    rootMessageId = rootMessages.length > 0 ? rootMessages[0].id : undefined
  }

  await stores.message.update(pageId, (r) => ({
    ...r,
    messages: r.messages.filter((m) => !idsToDelete.has(m.id)),
    leafMessageId,
    rootMessageId
  }))
}

// ==================== 分支操作 ====================

export function getChildMessages(
  messages: ChatMessage[],
  parentId: string | undefined
): ChatMessage[] {
  return messages
    .filter((m) => m.parentMessageId === parentId)
    .sort((a, b) => (a.branchIndex ?? 0) - (b.branchIndex ?? 0))
}

function getDescendantIds(
  childrenMap: Map<string | undefined, ChatMessage[]>,
  messageId: string
): Set<string> {
  const ids = new Set<string>()
  const stack = [messageId]

  while (stack.length > 0) {
    const currentId = stack.pop()!
    const children = childrenMap.get(currentId) ?? []
    for (const child of children) {
      ids.add(child.id)
      stack.push(child.id)
    }
  }

  return ids
}

export function getNextBranchIndex(messages: ChatMessage[], parentId: string | undefined): number {
  const children = getChildMessages(messages, parentId)
  if (children.length === 0) return 0
  return Math.max(...children.map((c) => c.branchIndex ?? 0)) + 1
}

export async function switchBranch(pageId: string, messageId: string): Promise<void> {
  const record = stores.message.get(pageId)
  if (!record) return

  const { childrenMap } = buildMessageMaps(record.messages)
  const leafId = findLeafFromMessage(childrenMap, messageId)
  await stores.message.updateSession(pageId, {
    leafMessageId: leafId,
    selectedMessageId: messageId
  })
}

function findLeafFromMessage(
  childrenMap: Map<string | undefined, ChatMessage[]>,
  messageId: string
): string {
  const children = childrenMap.get(messageId) ?? []
  if (children.length === 0) return messageId
  return findLeafFromMessage(childrenMap, children[0].id)
}

// ==================== 路径计算 ====================

export function getMessagePath(messages: ChatMessage[], leafId: string | undefined): ChatMessage[] {
  if (!leafId) return []

  // 预构建 Map - O(N) 一次性
  const messageMap = new Map(messages.map((m) => [m.id, m]))

  const path: ChatMessage[] = []
  let currentId: string | undefined = leafId

  while (currentId) {
    const message = messageMap.get(currentId) // O(1) 而非 O(N)
    if (!message) break
    path.push(message) // O(1) 而非 O(N) 的 unshift
    currentId = message.parentMessageId
  }

  return path.reverse() // 一次 reverse O(N) 比多次 unshift O(N²) 快
}

export function getCurrentPath(pageId: string): ChatMessage[] {
  const record = stores.message.get(pageId)
  if (!record) return []
  return getMessagePath(record.messages, record.leafMessageId)
}

// ==================== 辅助函数 ====================

export function getMessages(pageId: string): ChatMessage[] {
  return stores.message.get(pageId)?.messages ?? []
}

// ==================== 消息折叠 ====================

export async function toggleMessageCollapsed(pageId: string, messageId: string): Promise<void> {
  const record = stores.message.get(pageId)
  const message = record?.messages.find((m) => m.id === messageId)
  if (message) {
    await updateMessage(pageId, messageId, { collapsed: !message.collapsed })
  }
}

export async function setMessagesCollapsed(
  pageId: string,
  messageIds: string[],
  collapsed: boolean
): Promise<void> {
  await stores.message.update(pageId, (record) => ({
    ...record,
    messages: record.messages.map((m) =>
      messageIds.includes(m.id) ? { ...m, collapsed, updatedAt: Date.now() } : m
    )
  }))
}

// ==================== Title 操作 ====================

/**
 * 更新消息标题
 */
export async function updateMessageTitle(
  pageId: string,
  messageId: string,
  title: string
): Promise<void> {
  await updateMessage(pageId, messageId, { title: title || undefined, updatedAt: Date.now() })
}

// ==================== Topic 操作 ====================

/**
 * 创建新的 Topic
 */
export async function createTopic(
  pageId: string,
  name: string,
  startMessageId: string,
  endMessageId?: string
): Promise<Topic> {
  const topic: Topic = {
    id: uuidv4(),
    name,
    startMessageId,
    endMessageId,
    collapsed: false
  }
  await stores.message.addTopic(pageId, topic)
  return topic
}

/**
 * 更新 Topic
 */
export async function updateTopic(
  pageId: string,
  topicId: string,
  updates: Partial<Omit<Topic, 'id'>>
): Promise<void> {
  await stores.message.updateTopic(pageId, topicId, updates)
}

/**
 * 删除 Topic
 */
export async function deleteTopic(pageId: string, topicId: string): Promise<void> {
  await stores.message.deleteTopic(pageId, topicId)
}

/**
 * 切换 Topic 折叠状态
 */
export async function toggleTopicCollapse(pageId: string, topicId: string): Promise<void> {
  const topics = stores.message.getTopics(pageId)
  const topic = topics.find((t) => t.id === topicId)
  if (topic) {
    await stores.message.updateTopic(pageId, topicId, {
      collapsed: !topic.collapsed
    })
  }
}

/**
 * 设置 Topic 折叠状态
 */
export async function setTopicCollapsed(
  pageId: string,
  topicId: string,
  collapsed: boolean
): Promise<void> {
  await stores.message.updateTopic(pageId, topicId, { collapsed })
}

/**
 * 获取页面的所有 Topics
 */
export function getTopics(pageId: string): Topic[] {
  return stores.message.getTopics(pageId)
}

// ==================== Topic 分组计算 ====================

/**
 * 计算 Topic 分组
 * 基于独立的 Topic 实体和当前消息路径，计算每个 Topic 的实际消息范围
 *
 * @param topics - 页面的所有 Topics
 * @param currentPath - 当前路径的消息列表（从根到叶子）
 * @returns 在当前路径上有效的 TopicGroup 列表
 */
export function computeTopicGroups(topics: Topic[], currentPath: ChatMessage[]): TopicGroup[] {
  if (currentPath.length === 0 || topics.length === 0) return []

  // 构建消息 ID 到索引的映射
  const messageIndexMap = new Map<string, number>()
  for (let i = 0; i < currentPath.length; i++) {
    messageIndexMap.set(currentPath[i].id, i)
  }

  // 筛选出 startMessageId 在当前路径上的 Topics，并按路径顺序排序
  const validTopics = topics
    .filter((t) => messageIndexMap.has(t.startMessageId))
    .map((t) => ({
      topic: t,
      startIndex: messageIndexMap.get(t.startMessageId)!
    }))
    .sort((a, b) => a.startIndex - b.startIndex)

  if (validTopics.length === 0) return []

  const groups: TopicGroup[] = []

  for (let i = 0; i < validTopics.length; i++) {
    const { topic, startIndex } = validTopics[i]
    let endIndex: number

    if (topic.endMessageId && messageIndexMap.has(topic.endMessageId)) {
      // 有明确的 endMessageId 且在路径上
      endIndex = messageIndexMap.get(topic.endMessageId)!
    } else {
      // 找下一个 Topic 作为结束边界
      if (i + 1 < validTopics.length) {
        endIndex = validTopics[i + 1].startIndex - 1
      } else {
        endIndex = currentPath.length - 1 // 默认到末尾
      }
    }

    // 确保 endIndex >= startIndex
    endIndex = Math.max(startIndex, endIndex)

    // 收集消息 ID
    const messageIds: string[] = []
    for (let k = startIndex; k <= endIndex; k++) {
      messageIds.push(currentPath[k].id)
    }

    groups.push({
      topicId: topic.id,
      startMessageId: topic.startMessageId,
      endMessageId: currentPath[endIndex].id,
      name: topic.name,
      messageIds,
      collapsed: topic.collapsed
    })
  }

  return groups
}

/**
 * 根据 Topic 折叠状态过滤消息
 * 返回应该显示的消息（折叠的 Topic 只显示第一条消息）
 */
export function filterMessagesByTopicCollapse(
  messages: ChatMessage[],
  topicGroups: TopicGroup[]
): ChatMessage[] {
  const collapsedMessageIds = new Set<string>()

  for (const group of topicGroups) {
    if (group.collapsed && group.messageIds.length > 1) {
      // 折叠状态下，隐藏除第一条外的所有消息
      for (let i = 1; i < group.messageIds.length; i++) {
        collapsedMessageIds.add(group.messageIds[i])
      }
    }
  }

  return messages.filter((m) => !collapsedMessageIds.has(m.id))
}

/**
 * 计算大纲
 * 基于 TopicGroup 和消息的 title，形成结构
 *
 * @param topicGroups - 计算好的 TopicGroup 列表
 * @param currentPath - 当前路径的消息列表
 * @returns OutlineNode 结构
 */
export function computeOutline(
  topicGroups: TopicGroup[],
  currentPath: ChatMessage[]
): OutlineNode[] {
  const outline: OutlineNode[] = []
  let currentTopicNode: OutlineNode | null = null

  // 构建消息 ID 到消息的映射
  const messageMap = new Map<string, ChatMessage>()
  for (const msg of currentPath) {
    messageMap.set(msg.id, msg)
  }

  // 构建 Topic startMessageId 到 TopicGroup 的映射
  const topicGroupMap = new Map<string, TopicGroup>()
  for (const group of topicGroups) {
    topicGroupMap.set(group.startMessageId, group)
  }

  // 遍历当前路径
  for (const msg of currentPath) {
    const topicGroup = topicGroupMap.get(msg.id)

    // 处理 Topic 节点
    if (topicGroup) {
      const topicNode: OutlineNode = {
        id: `topic-${topicGroup.topicId}`,
        title: topicGroup.name,
        type: 'topic',
        messageId: msg.id,
        topicId: topicGroup.topicId,
        role: msg.role,
        children: [],
        collapsed: topicGroup.collapsed
      }

      // 所有 Topic 都是顶级节点
      outline.push(topicNode)
      currentTopicNode = topicNode

      // 如果 Topic 起始消息同时有 title，将 title 作为第一个子节点
      if (msg.title) {
        const titleNode: OutlineNode = {
          id: `title-${msg.id}`,
          title: msg.title,
          type: 'title',
          messageId: msg.id,
          role: msg.role
        }
        topicNode.children!.push(titleNode)
      }
    } else if (msg.title) {
      // 处理带标题的消息节点（不是 Topic 起始消息）
      const titleNode: OutlineNode = {
        id: `title-${msg.id}`,
        title: msg.title,
        type: 'title',
        messageId: msg.id,
        role: msg.role
      }

      if (currentTopicNode) {
        // 添加到当前 Topic 的 children
        currentTopicNode.children!.push(titleNode)
      } else {
        // 没有 Topic 时直接添加到根
        outline.push(titleNode)
      }
    }
  }

  return outline
}

/**
 * 获取消息所属的 Topic 信息
 */
export function getMessageTopicInfo(
  topicGroups: TopicGroup[],
  messageId: string
): { topicId: string; topicName: string; topicMessageId: string } | null {
  for (const group of topicGroups) {
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

/**
 * 根据消息 ID 查找关联的 Topic
 * 用于判断消息是否是某个 Topic 的起始消息
 */
export function findTopicByStartMessageId(topics: Topic[], messageId: string): Topic | undefined {
  return topics.find((t) => t.startMessageId === messageId)
}
