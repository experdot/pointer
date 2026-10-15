/**
 * 会话服务
 *
 * 纯计算直接复用领域层；写入一律通过命令发往内核。
 */

import type { ChatMessage, MessageDraft, Topic } from '@shared/domain'
import {
  buildIndex,
  childMessages,
  computeOutline,
  computeTopicGroups,
  filterByTopicCollapse,
  findTopicByStartMessageId,
  getMessageTopicInfo,
  pathToMessage
} from '@shared/domain'
import { useMessagesStore } from '../stores/messagesStore'

export type { OutlineNode, TopicGroup } from '@shared/domain'

export type MessagePatch = Partial<
  Pick<
    ChatMessage,
    | 'content'
    | 'reasoning'
    | 'title'
    | 'starred'
    | 'collapsed'
    | 'attachments'
    | 'hasError'
    | 'llmId'
    | 'modelConfigId'
  >
>

export async function addMessage(
  pageId: string,
  draft: Omit<MessageDraft, 'id'> & { id?: string }
): Promise<ChatMessage> {
  return useMessagesStore.getState().addMessage(pageId, draft)
}

export async function updateMessage(
  pageId: string,
  messageId: string,
  patch: MessagePatch
): Promise<void> {
  await useMessagesStore.getState().updateMessage(pageId, messageId, patch)
}

export async function deleteMessage(pageId: string, messageId: string): Promise<void> {
  await useMessagesStore.getState().deleteMessage(pageId, messageId)
}

export function getChildMessages(
  messages: readonly ChatMessage[],
  parentId: string | undefined
): ChatMessage[] {
  return childMessages(buildIndex(messages), parentId)
}

export function getMessagePath(
  messages: readonly ChatMessage[],
  leafId: string | undefined
): ChatMessage[] {
  return pathToMessage(buildIndex(messages), leafId)
}

export async function switchBranch(pageId: string, messageId: string): Promise<void> {
  await useMessagesStore.getState().setLeaf(pageId, messageId)
}

export async function toggleMessageCollapsed(pageId: string, messageId: string): Promise<void> {
  const conversation = useMessagesStore.getState().get(pageId)
  const message = conversation?.messages.find((item) => item.id === messageId)
  if (!message) return
  await useMessagesStore.getState().updateMessage(pageId, messageId, {
    collapsed: !message.collapsed
  })
}

export async function setMessagesCollapsed(
  pageId: string,
  messageIds: readonly string[],
  collapsed: boolean
): Promise<void> {
  // 一次命令、一次写入：逐条发命令会重写 N 次会话文件
  await useMessagesStore.getState().updateMessages(pageId, [...messageIds], { collapsed })
}

export async function updateMessageTitle(
  pageId: string,
  messageId: string,
  title: string
): Promise<void> {
  await useMessagesStore.getState().updateMessage(pageId, messageId, { title })
}

export async function createTopic(
  pageId: string,
  input: { id?: string; name: string; startMessageId: string; endMessageId?: string }
): Promise<Topic | undefined> {
  await useMessagesStore.getState().addTopic(pageId, input)
  return useMessagesStore
    .getState()
    .getTopics(pageId)
    .find((topic) => topic.startMessageId === input.startMessageId)
}

export async function updateTopic(
  pageId: string,
  topicId: string,
  patch: Partial<Pick<Topic, 'name' | 'endMessageId' | 'collapsed'>>
): Promise<void> {
  await useMessagesStore.getState().updateTopic(pageId, topicId, patch)
}

export async function deleteTopic(pageId: string, topicId: string): Promise<void> {
  await useMessagesStore.getState().deleteTopic(pageId, topicId)
}

export async function toggleTopicCollapse(pageId: string, topicId: string): Promise<void> {
  const topic = useMessagesStore
    .getState()
    .getTopics(pageId)
    .find((item) => item.id === topicId)
  if (!topic) return
  await useMessagesStore.getState().updateTopic(pageId, topicId, { collapsed: !topic.collapsed })
}

export async function setTopicCollapsed(
  pageId: string,
  topicId: string,
  collapsed: boolean
): Promise<void> {
  await useMessagesStore.getState().updateTopic(pageId, topicId, { collapsed })
}

export function getTopics(pageId: string): Topic[] {
  return useMessagesStore.getState().getTopics(pageId)
}

export {
  computeOutline,
  computeTopicGroups,
  filterByTopicCollapse as filterMessagesByTopicCollapse,
  findTopicByStartMessageId,
  getMessageTopicInfo
}
