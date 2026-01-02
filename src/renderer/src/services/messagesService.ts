import { v4 as uuidv4 } from 'uuid'
import { useMessagesStore } from '../stores/messagesStore'
import type { ChatMessage } from '../types/type'

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

  // 获取要删除的消息及其所有子消息
  const idsToDelete = getDescendantIds(record.messages, messageId)
  idsToDelete.add(messageId)

  const deletedMsg = record.messages.find((m) => m.id === messageId)

  // 计算新的 leafMessageId
  let leafMessageId = record.leafMessageId
  if (leafMessageId && idsToDelete.has(leafMessageId)) {
    const remainingMessages = record.messages.filter((m) => !idsToDelete.has(m.id))
    const siblings = getChildMessages(record.messages, deletedMsg?.parentMessageId).filter(
      (m) => !idsToDelete.has(m.id)
    )
    if (siblings.length > 0) {
      leafMessageId = findLeafFromMessage(remainingMessages, siblings[0].id)
    } else {
      leafMessageId = deletedMsg?.parentMessageId
    }
  }

  // 计算新的 rootMessageId
  let rootMessageId = record.rootMessageId
  if (rootMessageId && idsToDelete.has(rootMessageId)) {
    const remainingMessages = record.messages.filter((m) => !idsToDelete.has(m.id))
    const rootMessages = getChildMessages(remainingMessages, undefined)
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

function getDescendantIds(messages: ChatMessage[], messageId: string): Set<string> {
  const ids = new Set<string>()
  const children = messages.filter((m) => m.parentMessageId === messageId)
  for (const child of children) {
    ids.add(child.id)
    const descendants = getDescendantIds(messages, child.id)
    descendants.forEach((id) => ids.add(id))
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

  const leafId = findLeafFromMessage(record.messages, messageId)
  await store.updateSession(pageId, { leafMessageId: leafId, selectedMessageId: messageId })
}

function findLeafFromMessage(messages: ChatMessage[], messageId: string): string {
  const children = getChildMessages(messages, messageId)
  if (children.length === 0) return messageId
  return findLeafFromMessage(messages, children[0].id)
}

// ==================== 路径计算 ====================

export function getMessagePath(messages: ChatMessage[], leafId: string | undefined): ChatMessage[] {
  if (!leafId) return []

  const path: ChatMessage[] = []
  let currentId: string | undefined = leafId

  while (currentId) {
    const message = messages.find((m) => m.id === currentId)
    if (!message) break
    path.unshift(message)
    currentId = message.parentMessageId
  }

  return path
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
