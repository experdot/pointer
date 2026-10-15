/**
 * 内核推送的事件
 *
 * 粒度取舍：会话级使用粗粒度失效通知（conversation.changed），
 * 流式过程使用细粒度增量（chat.delta），避免展示层做写合并。
 */

import type { Account, ChatMessage, Page, Settings } from '../domain'
import type { PageTreeSnapshot, SessionSnapshot, UpdateStatus } from './queries'

interface RuntimeEventMap {
  'accounts.changed': Account[]
  'session.changed': SessionSnapshot
  'tree.changed': PageTreeSnapshot
  'conversation.changed': { pageId: string }
  'conversation.message': { pageId: string; message: ChatMessage }
  'chat.delta': { requestId: string; pageId: string; messageId: string; text: string }
  'chat.reasoning': { requestId: string; pageId: string; messageId: string; text: string }
  'chat.completed': { requestId: string; pageId: string; messageId: string }
  'chat.failed': { requestId: string; pageId: string; messageId: string; error: string }
  'chat.aborted': { requestId: string; pageId: string; messageId: string }
  'queue.changed': { pageId: string }
  'settings.changed': Settings
  'page.changed': { page: Page }
  'workspace.externalChange': { pageIds: string[] }
  'app.updateStatus': UpdateStatus
}

type RuntimeEventName = keyof RuntimeEventMap

export type RuntimeEvent = {
  [K in RuntimeEventName]: { type: K; payload: RuntimeEventMap[K] }
}[RuntimeEventName]
