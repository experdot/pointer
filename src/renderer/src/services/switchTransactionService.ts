import { persistence } from '../persistence/registry'
import { streamingManager } from './streamingManager'
import { stores } from '../stores/registry'
import { flushAllPersistenceQueues, resetPersistenceQueues } from '../stores/persistenceQueue'
import { useChatUIStore } from '../stores/chatUIStore'
import { useGlobalSearchStore } from '../stores/globalSearchStore'
import { useMessageQueueStore } from '../stores/messageQueueStore'
import { useNavigationStore } from '../stores/navigationStore'
import { useSwitchTransactionStore, type SwitchTransactionKind } from '../stores/switchTransactionStore'
import type { WorkspaceScope } from '../persistence/interfaces'
import { invalidatePageCache } from '../persistence/implementations/filesystem/pagesRepository'
import * as messagesService from './messagesService'

let switchLock: Promise<void> = Promise.resolve()

function runSerialized<T>(task: () => Promise<T>): Promise<T> {
  const next = switchLock.then(task, task)
  switchLock = next.then(
    () => undefined,
    () => undefined
  )
  return next
}

async function resetVolatileStores(): Promise<void> {
  stores.message.reset()
  useChatUIStore.getState().reset()
  useGlobalSearchStore.getState().reset()
  useMessageQueueStore.getState().reset()
  useNavigationStore.getState().reset()
}

async function stopActiveWork(): Promise<void> {
  const stopped = await streamingManager.stopAll()
  const currentContext = persistence.database.getActiveContext()
  if (currentContext.accountId && currentContext.workspacePath) {
    for (const item of stopped) {
      if (item.content) {
        await messagesService.updateMessage(item.pageId, item.messageId, {
          content: item.content,
          reasoning_content: item.reasoning
        })
      } else {
        await messagesService.deleteMessage(item.pageId, item.messageId)
      }
    }
  }
  streamingManager.reset()
  await flushAllPersistenceQueues()
}

async function waitForScopedWrites(scope: WorkspaceScope | null): Promise<void> {
  const context = persistence.database.getActiveContext()
  if (context.accountId) {
    await persistence.database.waitForAccountIdle(context.accountId)
  }
  if (scope) {
    await persistence.database.waitForWorkspaceIdle(scope)
  }
}

export async function runSwitchTransaction<T>(
  kind: SwitchTransactionKind,
  targetLabel: string,
  action: () => Promise<T>
): Promise<T> {
  return runSerialized(async () => {
    const transaction = useSwitchTransactionStore.getState()
    transaction.begin(kind, targetLabel, '正在停止活动任务')

    const currentContext = persistence.database.getActiveContext()
    const currentWorkspaceScope =
      currentContext.accountId && currentContext.workspacePath
        ? {
            accountId: currentContext.accountId,
            workspacePath: currentContext.workspacePath
          }
        : null

    try {
      await stopActiveWork()
      transaction.updateMessage('正在等待写入完成')
      await persistence.database.flushActiveContext()
      await waitForScopedWrites(currentWorkspaceScope)
      transaction.updateMessage('正在切换数据上下文')
      const result = await action()
      invalidatePageCache()
      transaction.updateMessage('正在重建界面状态')
      await resetPersistenceQueues()
      await resetVolatileStores()
      return result
    } finally {
      transaction.complete()
    }
  })
}
