import { useMessagesStore } from '../stores/messagesStore'
import * as messagesService from './messagesService'
import * as pagesService from './pagesService'

// ==================== 类型定义 ====================

export interface NavigationTarget {
  pageId: string
  messageId: string
  /** 是否打开页面（如果未打开） */
  openPage?: boolean
  /** 滚动行为：true 为即时滚动，false 为平滑滚动 */
  instant?: boolean
}

// 导航版本号，用于处理竞态条件
let navigationVersion = 0

// ==================== 主导航函数 ====================

/**
 * 导航到指定消息
 * 完整流程：打开页面 → (仅在需要时)切换分支 → 展开折叠的 Topic → 请求滚动
 */
export async function navigateToMessage(target: NavigationTarget): Promise<void> {
  const { pageId, messageId, openPage = false, instant = true } = target

  // Step 1: 打开页面（如果需要）
  if (openPage) {
    await pagesService.openPage(pageId, true)
  }

  // Step 2: 确保消息数据已加载
  const record = await useMessagesStore.getState().load(pageId)

  // Step 3: 检查消息是否在当前路径中
  const currentPath = messagesService.getMessagePath(record.messages, record.leafMessageId)
  const isInCurrentPath = currentPath.some((m) => m.id === messageId)

  // Step 4: 仅当消息不在当前路径时才切换分支
  // 如果消息已在当前路径，切换分支会导致分支被重置到第一个子分支
  if (!isInCurrentPath) {
    await messagesService.switchBranch(pageId, messageId)
  }

  // Step 5: 展开包含目标消息的折叠 Topic
  await expandTopicsForMessage(pageId, messageId)

  // Step 6: 请求 UI 执行滚动
  navigationVersion++
  useMessagesStore.getState().requestNavigation({
    version: navigationVersion,
    target: { pageId, messageId, instant },
    timestamp: Date.now()
  })
}

// ==================== Topic 展开逻辑 ====================

/**
 * 获取包含指定消息的所有折叠 Topic ID
 */
export function getCollapsedTopicsForMessage(pageId: string, messageId: string): string[] {
  const store = useMessagesStore.getState()
  const record = store.get(pageId)
  if (!record) return []

  const topics = record.topics ?? []
  const currentPath = messagesService.getMessagePath(record.messages, record.leafMessageId)
  const topicGroups = messagesService.computeTopicGroups(topics, currentPath)

  // 找出所有包含目标消息且处于折叠状态的 Topic
  const collapsedTopicIds: string[] = []
  for (const group of topicGroups) {
    if (group.collapsed && group.messageIds.includes(messageId)) {
      collapsedTopicIds.push(group.topicId)
    }
  }

  return collapsedTopicIds
}

/**
 * 展开包含指定消息的所有折叠 Topic
 */
export async function expandTopicsForMessage(pageId: string, messageId: string): Promise<void> {
  const collapsedTopicIds = getCollapsedTopicsForMessage(pageId, messageId)

  for (const topicId of collapsedTopicIds) {
    await messagesService.setTopicCollapsed(pageId, topicId, false)
  }
}

// ==================== 相对导航 ====================

/**
 * 请求滚动到上一条消息
 */
export function requestScrollToPrev(pageId: string): void {
  navigationVersion++
  useMessagesStore.getState().requestRelativeNavigation({
    version: navigationVersion,
    direction: 'prev',
    pageId,
    timestamp: Date.now()
  })
}

/**
 * 请求滚动到下一条消息
 */
export function requestScrollToNext(pageId: string): void {
  navigationVersion++
  useMessagesStore.getState().requestRelativeNavigation({
    version: navigationVersion,
    direction: 'next',
    pageId,
    timestamp: Date.now()
  })
}
