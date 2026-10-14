/**
 * 会话代际标识
 *
 * 账户或工作区切换后，之前发起的异步任务（标题生成、批量操作等）
 * 不应再写回界面状态。用代际字符串比较即可判断是否仍在同一上下文。
 */

import { useSessionStore } from '../stores/sessionStore'

export function currentGeneration(): string {
  const session = useSessionStore.getState()
  return `${session.accountId ?? ''}::${session.workspaceId ?? ''}`
}
