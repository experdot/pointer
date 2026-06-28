/**
 * Unified persistence queues with flush semantics.
 * All deferred writes should go through this module so switch/quit can flush consistently.
 */

import { persistence } from '../persistence/registry'
import type {
  AccountScope,
  LayoutRecord,
  MessageQueueRecord,
  MessagesRecord,
  PageRecord,
  TabsRecord,
  WorkspaceScope
} from '../persistence/interfaces'
import type { Settings, PageFolder } from '../types/type'

type WriteTask<T> = {
  data: T
  timestamp: number
}

interface QueueOptions<TData> {
  debounceMs?: number
  maxDelayMs?: number
  maxRetries?: number
  initialRetryDelay?: number
  mergePending?: (current: TData, next: TData) => TData
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  initialDelay: number,
  context: string
): Promise<T> {
  let lastError: Error | undefined
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt)
        console.warn(
          `[PersistenceQueue] ${context} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`,
          lastError.message
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

export interface PersistenceQueue<TKey extends string, TData> {
  enqueue: (key: TKey, data: TData) => void
  flush: (key: TKey) => Promise<void>
  flushAll: () => Promise<void>
  waitForWrites: () => Promise<void>
  hasPending: (key?: TKey) => boolean
  dispose: () => Promise<void>
}

export function createPersistenceQueue<TKey extends string, TData>(
  persistFn: (key: TKey, data: TData) => Promise<void>,
  options: QueueOptions<TData> = {}
): PersistenceQueue<TKey, TData> {
  const {
    debounceMs = 300,
    maxDelayMs = 2000,
    maxRetries = 3,
    initialRetryDelay = 1000,
    mergePending
  } = options

  const pending = new Map<TKey, WriteTask<TData>>()
  const timers = new Map<TKey, ReturnType<typeof setTimeout>>()
  const firstQueueTime = new Map<TKey, number>()
  const writing = new Map<TKey, Promise<void>>()

  function enqueue(key: TKey, data: TData): void {
    const now = Date.now()
    const current = pending.get(key)
    const mergedData = current && mergePending ? mergePending(current.data, data) : data
    pending.set(key, { data: mergedData, timestamp: current?.timestamp ?? now })

    if (!firstQueueTime.has(key)) {
      firstQueueTime.set(key, now)
    }

    const existingTimer = timers.get(key)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const firstTime = firstQueueTime.get(key) ?? now
    const elapsed = now - firstTime

    if (elapsed >= maxDelayMs) {
      void flush(key)
    } else {
      const delay = Math.min(debounceMs, maxDelayMs - elapsed)
      const timer = setTimeout(() => {
        void flush(key)
      }, delay)
      timers.set(key, timer)
    }
  }

  async function flush(key: TKey): Promise<void> {
    const timer = timers.get(key)
    if (timer) {
      clearTimeout(timer)
      timers.delete(key)
    }

    const inflight = writing.get(key)
    if (inflight) {
      await inflight
    }

    const task = pending.get(key)
    if (!task) return

    pending.delete(key)
    firstQueueTime.delete(key)

    const writePromise = retryWithBackoff(
      () => persistFn(key, task.data),
      maxRetries,
      initialRetryDelay,
      `persist ${key}`
    )

    writing.set(key, writePromise)
    try {
      await writePromise
    } finally {
      writing.delete(key)
    }
  }

  async function flushAll(): Promise<void> {
    const keys = Array.from(pending.keys())
    await Promise.all(keys.map((key) => flush(key)))
  }

  async function waitForWrites(): Promise<void> {
    await Promise.all(Array.from(writing.values()))
  }

  function hasPending(key?: TKey): boolean {
    if (key) {
      return pending.has(key) || writing.has(key)
    }
    return pending.size > 0 || writing.size > 0
  }

  async function dispose(): Promise<void> {
    for (const timer of timers.values()) {
      clearTimeout(timer)
    }
    timers.clear()
    await flushAll()
    await waitForWrites()
  }

  return {
    enqueue,
    flush,
    flushAll,
    waitForWrites,
    hasPending,
    dispose
  }
}

const DEFAULT_QUEUE_OPTIONS: QueueOptions<unknown> = {
  debounceMs: 300,
  maxDelayMs: 2000,
  maxRetries: 3,
  initialRetryDelay: 1000
}

type PageFileMutation = {
  page?: PageRecord
  messages?: MessagesRecord | null
  deletePage?: true
}

type QueueRegistry = Map<string, PersistenceQueue<string, unknown>>

const queues: QueueRegistry = new Map()
let flushListenerRegistered = false

function registerFlushListener(): void {
  if (flushListenerRegistered || !window.api?.persistence?.onFlushRequest) {
    return
  }

  window.api.persistence.onFlushRequest(async () => {
    console.log('[PersistenceQueue] Received flush request from main process')
    try {
      await flushAllPersistenceQueues()
      console.log('[PersistenceQueue] Flush completed')
      window.api.persistence.notifyFlushComplete()
    } catch (err) {
      console.error('[PersistenceQueue] Flush failed:', err)
      window.api.persistence.notifyFlushComplete()
    }
  })

  flushListenerRegistered = true
}

function getOrCreateQueue<TData>(
  queueId: string,
  factory: () => PersistenceQueue<string, TData>
): PersistenceQueue<string, TData> {
  registerFlushListener()

  if (!queues.has(queueId)) {
    queues.set(queueId, factory() as PersistenceQueue<string, unknown>)
  }

  return queues.get(queueId)! as PersistenceQueue<string, TData>
}

function accountQueueId(accountId: string, entity: string): string {
  return `account:${accountId}:${entity}`
}

function workspaceQueueId(scope: WorkspaceScope, entity: string): string {
  return `workspace:${scope.accountId}:${scope.workspacePath}:${entity}`
}

async function flushQueue<TKey extends string, TData>(
  queue: PersistenceQueue<TKey, TData>
): Promise<void> {
  await queue.flushAll()
  await queue.waitForWrites()
}

function mergePageFileMutation(current: PageFileMutation, next: PageFileMutation): PageFileMutation {
  if (current.deletePage || next.deletePage) {
    return { deletePage: true }
  }

  const merged: PageFileMutation = {}

  if (next.page ?? current.page) {
    merged.page = next.page ?? current.page
  }

  if (next.messages !== undefined) {
    merged.messages = next.messages
  } else if (current.messages !== undefined) {
    merged.messages = current.messages
  }

  return merged
}

export function getSettingsQueue(scope: AccountScope): PersistenceQueue<'settings', Settings> {
  return getOrCreateQueue(accountQueueId(scope.accountId, 'settings'), () =>
    createPersistenceQueue<'settings', Settings>(
      (_key, data) => persistence.account(scope).settings.put(data),
      DEFAULT_QUEUE_OPTIONS
    )
  )
}

export function getLayoutQueue(scope: AccountScope): PersistenceQueue<'layout', LayoutRecord> {
  return getOrCreateQueue(accountQueueId(scope.accountId, 'layout'), () =>
    createPersistenceQueue<'layout', LayoutRecord>(
      (_key, data) => persistence.account(scope).layout.put(data),
      DEFAULT_QUEUE_OPTIONS
    )
  )
}

export function getTabsQueue(scope: WorkspaceScope): PersistenceQueue<'tabs', TabsRecord> {
  return getOrCreateQueue(workspaceQueueId(scope, 'tabs'), () =>
    createPersistenceQueue<'tabs', TabsRecord>(
      (_key, data) => persistence.workspace(scope).tabs.put(data),
      DEFAULT_QUEUE_OPTIONS
    )
  )
}

function getFoldersQueue(scope: WorkspaceScope): PersistenceQueue<'folders', PageFolder[]> {
  return getOrCreateQueue(workspaceQueueId(scope, 'folders'), () =>
    createPersistenceQueue<'folders', PageFolder[]>(
      (_key, data) => persistence.workspace(scope).folders.putBatch(data),
      DEFAULT_QUEUE_OPTIONS
    )
  )
}

function getPageFileQueue(scope: WorkspaceScope): PersistenceQueue<string, PageFileMutation> {
  return getOrCreateQueue(workspaceQueueId(scope, 'page-file'), () =>
    createPersistenceQueue<string, PageFileMutation>(
      async (pageId, mutation) => {
        if (mutation.deletePage) {
          await persistence.workspace(scope).pages.deleteWithMessages(pageId)
          return
        }

        if (mutation.page) {
          await flushQueue(getFoldersQueue(scope))
          await persistence.workspace(scope).pages.put(mutation.page)
        }

        if (mutation.messages !== undefined) {
          if (mutation.messages === null) {
            await persistence.workspace(scope).messages.delete(pageId)
          } else {
            await persistence.workspace(scope).messages.put(pageId, mutation.messages)
          }
        }
      },
      {
        ...DEFAULT_QUEUE_OPTIONS,
        mergePending: mergePageFileMutation
      }
    )
  )
}

export function queueFoldersSnapshot(scope: WorkspaceScope, folders: PageFolder[]): void {
  getFoldersQueue(scope).enqueue('folders', folders)
}

export function queuePagePut(scope: WorkspaceScope, page: PageRecord): void {
  getPageFileQueue(scope).enqueue(page.id, { page })
}

export function queuePageDelete(scope: WorkspaceScope, pageId: string): void {
  getPageFileQueue(scope).enqueue(pageId, { deletePage: true })
}

export function queueMessagesPut(scope: WorkspaceScope, pageId: string, record: MessagesRecord): void {
  getPageFileQueue(scope).enqueue(pageId, { messages: record })
}

export function queueMessagesDelete(scope: WorkspaceScope, pageId: string): void {
  getPageFileQueue(scope).enqueue(pageId, { messages: null })
}

export function queueMessageQueueDelete(scope: WorkspaceScope, pageId: string): void {
  getMessageQueueMutationQueue(scope).enqueue(pageId, { type: 'delete' })
}

export function getMessageQueueMutationQueue(
  scope: WorkspaceScope
): PersistenceQueue<string, { type: 'put'; value: MessageQueueRecord } | { type: 'delete' }> {
  return getOrCreateQueue(workspaceQueueId(scope, 'messageQueue'), () =>
    createPersistenceQueue<string, { type: 'put'; value: MessageQueueRecord } | { type: 'delete' }>(
      (pageId, mutation) =>
        mutation.type === 'delete'
          ? persistence.workspace(scope).messageQueue.delete(pageId)
          : persistence.workspace(scope).messageQueue.put(pageId, mutation.value),
      DEFAULT_QUEUE_OPTIONS
    )
  )
}

export async function flushAllPersistenceQueues(): Promise<void> {
  await Promise.all(Array.from(queues.values()).map((queue) => queue.dispose()))
}

export async function resetPersistenceQueues(): Promise<void> {
  await flushAllPersistenceQueues()
  queues.clear()
}
