/**
 * 持久化队列 - 异步防抖写入
 * 解决内存更新和持久化解耦的问题
 */

type WriteTask<T> = {
  data: T
  timestamp: number
}

interface QueueOptions {
  /** 防抖延迟 (ms)，默认 300ms */
  debounceMs?: number
  /** 最大延迟 (ms)，超过后强制写入，默认 2000ms */
  maxDelayMs?: number
  /** 最大重试次数，默认 3 */
  maxRetries?: number
  /** 初始重试延迟 (ms)，默认 1000ms */
  initialRetryDelay?: number
}

/**
 * 指数退避重试
 */
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

/**
 * 创建一个持久化队列
 * - 内存更新立即生效
 * - 持久化操作防抖合并
 * - 保证最终一致性
 */
export function createPersistenceQueue<TKey extends string, TData>(
  persistFn: (key: TKey, data: TData) => Promise<void>,
  options: QueueOptions = {}
): PersistenceQueue<TKey, TData> {
  const { debounceMs = 300, maxDelayMs = 2000, maxRetries = 3, initialRetryDelay = 1000 } = options

  // 每个 key 的待写入数据
  const pending = new Map<TKey, WriteTask<TData>>()
  // 每个 key 的防抖定时器
  const timers = new Map<TKey, ReturnType<typeof setTimeout>>()
  // 每个 key 的首次排队时间（用于计算最大延迟）
  const firstQueueTime = new Map<TKey, number>()
  // 正在写入的 Promise（用于 flush 等待）
  const writing = new Map<TKey, Promise<void>>()

  /**
   * 排队写入（立即返回，不等待持久化）
   */
  function enqueue(key: TKey, data: TData): void {
    const now = Date.now()

    // 记录待写入数据
    pending.set(key, { data, timestamp: now })

    // 记录首次排队时间
    if (!firstQueueTime.has(key)) {
      firstQueueTime.set(key, now)
    }

    // 清除旧定时器
    const existingTimer = timers.get(key)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // 检查是否超过最大延迟
    const firstTime = firstQueueTime.get(key)!
    const elapsed = now - firstTime

    if (elapsed >= maxDelayMs) {
      // 超过最大延迟，立即写入
      void flush(key)
    } else {
      // 设置新的防抖定时器
      const delay = Math.min(debounceMs, maxDelayMs - elapsed)
      const timer = setTimeout(() => {
        void flush(key)
      }, delay)
      timers.set(key, timer)
    }
  }

  /**
   * 立即写入指定 key 的数据
   */
  async function flush(key: TKey): Promise<void> {
    // 清除定时器
    const timer = timers.get(key)
    if (timer) {
      clearTimeout(timer)
      timers.delete(key)
    }

    // 获取待写入数据
    const task = pending.get(key)
    if (!task) return

    // 清除待写入状态
    pending.delete(key)
    firstQueueTime.delete(key)

    // 执行写入（带重试）
    const writePromise = retryWithBackoff(
      () => persistFn(key, task.data),
      maxRetries,
      initialRetryDelay,
      `persist ${key}`
    ).catch((err) => {
      console.error(`[PersistenceQueue] Failed to persist ${key} after all retries:`, err)
    })

    writing.set(key, writePromise)
    await writePromise
    writing.delete(key)
  }

  /**
   * 立即写入所有待处理数据
   */
  async function flushAll(): Promise<void> {
    const keys = Array.from(pending.keys())
    await Promise.all(keys.map((key) => flush(key)))
  }

  /**
   * 等待所有正在进行的写入完成
   */
  async function waitForWrites(): Promise<void> {
    await Promise.all(Array.from(writing.values()))
  }

  /**
   * 检查是否有待处理的写入
   */
  function hasPending(key?: TKey): boolean {
    if (key) {
      return pending.has(key) || writing.has(key)
    }
    return pending.size > 0 || writing.size > 0
  }

  /**
   * 清理（应用退出前调用）
   */
  async function dispose(): Promise<void> {
    // 清除所有定时器
    for (const timer of timers.values()) {
      clearTimeout(timer)
    }
    timers.clear()

    // 写入所有待处理数据
    await flushAll()

    // 等待正在进行的写入
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

// ==================== 消息持久化队列单例 ====================

import { persistence } from '../persistence/registry'
import type { MessagesRecord } from '../persistence/interfaces/userData'

let messagesQueue: PersistenceQueue<string, MessagesRecord> | null = null
let flushListenerRegistered = false

export function getMessagesQueue(): PersistenceQueue<string, MessagesRecord> {
  if (!messagesQueue) {
    messagesQueue = createPersistenceQueue<string, MessagesRecord>(
      (pageId, data) => persistence.messages.put(pageId, data),
      {
        debounceMs: 300, // 300ms 内的多次更新合并
        maxDelayMs: 2000, // 最多延迟 2 秒
        maxRetries: 3, // 重试 3 次
        initialRetryDelay: 1000 // 初始延迟 1 秒
      }
    )

    // 使用 IPC 机制监听主进程的 flush 请求
    if (!flushListenerRegistered && window.api?.persistence?.onFlushRequest) {
      window.api.persistence.onFlushRequest(async () => {
        console.log('[PersistenceQueue] Received flush request from main process')
        try {
          await messagesQueue?.dispose()
          console.log('[PersistenceQueue] Flush completed')
          window.api.persistence.notifyFlushComplete()
        } catch (err) {
          console.error('[PersistenceQueue] Flush failed:', err)
          window.api.persistence.notifyFlushComplete()
        }
      })
      flushListenerRegistered = true
    }
  }
  return messagesQueue
}

/**
 * 重置消息队列（用于 workspace 切换）
 */
export function resetMessagesQueue(): void {
  if (messagesQueue) {
    void messagesQueue.dispose()
    messagesQueue = null
  }
}
