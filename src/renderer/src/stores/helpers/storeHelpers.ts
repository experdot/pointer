import { Page, PageFolder } from '../../types/type'

/**
 * 计算同级元素中的最小order值，用于在顶部插入新元素
 */
export const calculateTopInsertOrder = (
  folders: PageFolder[],
  pages: Page[],
  parentOrFolderId?: string
): number => {
  const siblingFolders = folders.filter((f) => f.parentId === parentOrFolderId)
  const siblingPages = pages.filter((p) => p.folderId === parentOrFolderId && p.type !== 'settings')

  const allOrders = [
    ...siblingFolders.map((f) => f.order || 0),
    ...siblingPages.map((p) => p.order || 0)
  ]

  const minOrder = allOrders.length > 0 ? Math.min(...allOrders) : 1000
  return minOrder - 1000 // 新元素添加到最前面
}

/**
 * 更新页面记录并同步到存储
 */
export const updatePageWithStorage = (
  page: Page,
  storage: { savePage: (page: Page) => void }
): void => {
  storage.savePage({
    ...page,
    updatedAt: Date.now()
  })
}

/**
 * 深度复制消息ID映射
 */
export const createMessageIdMapping = (
  messages?: any[],
  messageMap?: { [messageId: string]: any }
): Map<string, string> => {
  const { v4: uuidv4 } = require('uuid')
  const idMap = new Map<string, string>()

  if (messages) {
    messages.forEach((msg) => {
      idMap.set(msg.id, uuidv4())
    })
  }

  if (messageMap) {
    Object.keys(messageMap).forEach((oldId) => {
      if (!idMap.has(oldId)) {
        idMap.set(oldId, uuidv4())
      }
    })
  }

  return idMap
}

/**
 * 使用ID映射复制消息数组
 */
export const copyMessagesWithIdMap = (messages: any[], idMap: Map<string, string>): any[] => {
  return messages.map((msg) => ({
    ...msg,
    id: idMap.get(msg.id)!,
    parentId: msg.parentId ? idMap.get(msg.parentId) : undefined,
    replies: msg.replies?.map((replyId: string) => idMap.get(replyId)).filter(Boolean) || [],
    children: msg.children?.map((childId: string) => idMap.get(childId)).filter(Boolean) || [],
    branchIndex: msg.branchIndex,
    isStreaming: false
  }))
}

/**
 * 使用ID映射复制消息映射对象
 */
export const copyMessageMapWithIdMap = (
  messageMap: { [messageId: string]: any },
  idMap: Map<string, string>
): { [messageId: string]: any } => {
  const newMessageMap: { [messageId: string]: any } = {}

  Object.entries(messageMap).forEach(([oldId, msg]) => {
    const newId = idMap.get(oldId)!
    newMessageMap[newId] = {
      ...msg,
      id: newId,
      parentId: msg.parentId ? idMap.get(msg.parentId) : undefined,
      replies: msg.replies?.map((replyId: string) => idMap.get(replyId)).filter(Boolean) || [],
      children: msg.children?.map((childId: string) => idMap.get(childId)).filter(Boolean) || [],
      branchIndex: msg.branchIndex,
      isStreaming: false
    }
  })

  return newMessageMap
}

/**
 * 使用ID映射更新路径数组
 */
export const updatePathWithIdMap = (
  currentPath: string[],
  idMap: Map<string, string>
): string[] => {
  return currentPath.map((oldId) => idMap.get(oldId)).filter(Boolean) as string[]
}
