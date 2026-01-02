import { v4 as uuidv4 } from 'uuid'
import { usePagesStore } from '../stores/pagesStore'
import type { ChatMessage, ChatPage, ChatSession } from '../types/type'

// ==================== 消息 CRUD ====================

export function addMessage(
  pageId: string,
  message: Omit<ChatMessage, 'id' | 'createdAt'>
): ChatMessage {
  const store = usePagesStore.getState()
  const page = store.pages.find((p) => p.id === pageId)
  if (!page) throw new Error(`Page not found: ${pageId}`)

  const newMessage: ChatMessage = {
    ...message,
    id: uuidv4(),
    createdAt: Date.now()
  }

  const messages = [...(page.data?.messages ?? []), newMessage]
  const data: ChatSession = {
    ...page.data,
    messages,
    rootMessageId: page.data?.rootMessageId ?? newMessage.id,
    leafMessageId: newMessage.id
  }

  store.updatePage(pageId, { data })
  return newMessage
}

export function updateMessage(
  pageId: string,
  messageId: string,
  updates: Partial<ChatMessage>
): void {
  const store = usePagesStore.getState()
  const page = store.pages.find((p) => p.id === pageId)
  if (!page?.data) return

  const messages = page.data.messages.map((m) =>
    m.id === messageId ? { ...m, ...updates, updatedAt: Date.now() } : m
  )

  store.updatePage(pageId, { data: { ...page.data, messages } })
}

export function deleteMessage(pageId: string, messageId: string): void {
  const store = usePagesStore.getState()
  const page = store.pages.find((p) => p.id === pageId)
  if (!page?.data) return

  // 获取要删除的消息及其所有子消息
  const idsToDelete = getDescendantIds(page.data.messages, messageId)
  idsToDelete.add(messageId)

  const deletedMsg = page.data.messages.find((m) => m.id === messageId)
  const messages = page.data.messages.filter((m) => !idsToDelete.has(m.id))

  // 更新 leafMessageId（如果被删除了）
  let leafMessageId = page.data.leafMessageId
  if (leafMessageId && idsToDelete.has(leafMessageId)) {
    // 找兄弟消息
    const siblings = getChildMessages(page.data.messages, deletedMsg?.parentMessageId).filter(
      (m) => !idsToDelete.has(m.id)
    )
    if (siblings.length > 0) {
      // 切换到兄弟消息的叶子节点
      leafMessageId = findLeafFromMessage(messages, siblings[0].id)
    } else {
      // 没有兄弟，回到父消息
      leafMessageId = deletedMsg?.parentMessageId
    }
  }

  // 更新 rootMessageId（如果被删除了）
  let rootMessageId = page.data.rootMessageId
  if (rootMessageId && idsToDelete.has(rootMessageId)) {
    // 找其他根消息
    const rootMessages = getChildMessages(messages, undefined)
    rootMessageId = rootMessages.length > 0 ? rootMessages[0].id : undefined
  }

  store.updatePage(pageId, {
    data: { ...page.data, messages, leafMessageId, rootMessageId }
  })
}

// ==================== 分支操作 ====================

// 获取消息的所有子消息（直接子节点），支持获取根消息（parentId 为 undefined）
export function getChildMessages(
  messages: ChatMessage[],
  parentId: string | undefined
): ChatMessage[] {
  return messages
    .filter((m) => m.parentMessageId === parentId)
    .sort((a, b) => (a.branchIndex ?? 0) - (b.branchIndex ?? 0))
}

// 获取消息的所有后代 ID
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

// 获取下一个分支索引
export function getNextBranchIndex(messages: ChatMessage[], parentId: string | undefined): number {
  const children = getChildMessages(messages, parentId)
  if (children.length === 0) return 0
  return Math.max(...children.map((c) => c.branchIndex ?? 0)) + 1
}

// 切换到指定分支
export function switchBranch(pageId: string, messageId: string): void {
  const store = usePagesStore.getState()
  const page = store.pages.find((p) => p.id === pageId)
  if (!page?.data) return

  // 从该消息开始，沿着第一个子节点找到叶子节点
  const leafId = findLeafFromMessage(page.data.messages, messageId)

  store.updatePage(pageId, {
    data: { ...page.data, leafMessageId: leafId, selectedMessageId: messageId }
  })
}

// 从指定消息开始找到叶子节点
function findLeafFromMessage(messages: ChatMessage[], messageId: string): string {
  const children = getChildMessages(messages, messageId)
  if (children.length === 0) return messageId
  return findLeafFromMessage(messages, children[0].id)
}

// ==================== 路径计算 ====================

// 获取从根到叶子的消息路径
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

// 获取页面的当前消息路径
export function getCurrentPath(page: ChatPage): ChatMessage[] {
  if (!page.data) return []
  return getMessagePath(page.data.messages, page.data.leafMessageId)
}

// ==================== 辅助函数 ====================

export function getPage(pageId: string): ChatPage | undefined {
  return usePagesStore.getState().pages.find((p) => p.id === pageId)
}

export function getMessages(pageId: string): ChatMessage[] {
  const page = getPage(pageId)
  return page?.data?.messages ?? []
}

// ==================== 消息折叠 ====================

export function toggleMessageCollapsed(pageId: string, messageId: string): void {
  const page = getPage(pageId)
  const message = page?.data?.messages.find((m) => m.id === messageId)
  if (message) {
    updateMessage(pageId, messageId, { collapsed: !message.collapsed })
  }
}

export function setMessagesCollapsed(
  pageId: string,
  messageIds: string[],
  collapsed: boolean
): void {
  const store = usePagesStore.getState()
  const page = store.pages.find((p) => p.id === pageId)
  if (!page?.data) return

  const messages = page.data.messages.map((m) =>
    messageIds.includes(m.id) ? { ...m, collapsed, updatedAt: Date.now() } : m
  )

  store.updatePage(pageId, { data: { ...page.data, messages } })
}
