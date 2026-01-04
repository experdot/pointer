import { v4 as uuidv4 } from 'uuid'
import { useMessagesStore } from '../stores/messagesStore'
import type { ChatMessage } from '../types/type'

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

  await useMessagesStore.getState().addMessage(pageId, newMessage)
  return newMessage
}

export async function updateMessage(
  pageId: string,
  messageId: string,
  updates: Partial<ChatMessage>
): Promise<void> {
  await useMessagesStore.getState().updateMessage(pageId, messageId, updates)
}

export async function deleteMessage(pageId: string, messageId: string): Promise<void> {
  const store = useMessagesStore.getState()
  const record = store.get(pageId)
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

  await store.update(pageId, (r) => ({
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
  const store = useMessagesStore.getState()
  const record = store.get(pageId)
  if (!record) return

  const { childrenMap } = buildMessageMaps(record.messages)
  const leafId = findLeafFromMessage(childrenMap, messageId)
  await store.updateSession(pageId, { leafMessageId: leafId, selectedMessageId: messageId })
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
  const record = useMessagesStore.getState().get(pageId)
  if (!record) return []
  return getMessagePath(record.messages, record.leafMessageId)
}

// ==================== 辅助函数 ====================

export function getMessages(pageId: string): ChatMessage[] {
  return useMessagesStore.getState().get(pageId)?.messages ?? []
}

// ==================== 消息折叠 ====================

export async function toggleMessageCollapsed(pageId: string, messageId: string): Promise<void> {
  const record = useMessagesStore.getState().get(pageId)
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
  const store = useMessagesStore.getState()
  await store.update(pageId, (record) => ({
    ...record,
    messages: record.messages.map((m) =>
      messageIds.includes(m.id) ? { ...m, collapsed, updatedAt: Date.now() } : m
    )
  }))
}
