import { useCallback, useEffect, useRef, useMemo } from 'react'
import { useMessageQueueStore } from '../stores/messageQueueStore'
import type { QueueItem } from '../utils/database'
import type { FileAttachment } from '../types/type'

interface UseMessageQueueOptions {
  pageId: string
  isStreaming: boolean
  onSendMessage: (
    content: string,
    options?: { attachments?: FileAttachment[] }
  ) => Promise<void>
}

interface UseMessageQueueResult {
  // 状态
  items: QueueItem[]
  count: number
  isPaused: boolean

  // 操作
  enqueue: (content: string) => Promise<void>
  remove: (itemId: string) => Promise<void>
  update: (itemId: string, content: string) => Promise<void>
  clear: () => Promise<void>

  // 控制
  pause: () => Promise<void>
  resumeQueue: () => Promise<void>

  // 发送逻辑（InputArea 调用）
  handleSend: (content: string, attachments?: FileAttachment[]) => Promise<void>
  // 停止并暂停队列
  handleStop: () => Promise<void>
}

export function useMessageQueue({
  pageId,
  isStreaming,
  onSendMessage
}: UseMessageQueueOptions): UseMessageQueueResult {
  const { getQueue, addItem, removeItem, updateItem, clearQueue, shiftItem, pause, resume, init } =
    useMessageQueueStore()

  const queue = getQueue(pageId)
  const items = useMemo(() => queue.items, [queue.items])
  const count = items.length
  const isPaused = queue.paused

  // 初始化 store
  useEffect(() => {
    init()
  }, [init])

  // 追踪上一次的 isStreaming 状态
  const prevStreamingRef = useRef(isStreaming)
  // 是否正在处理队列（防止重复触发）
  const processingRef = useRef(false)

  // 监听 streaming 结束，自动处理队列
  useEffect(() => {
    const wasStreaming = prevStreamingRef.current
    prevStreamingRef.current = isStreaming

    // streaming 从 true 变为 false 时
    if (wasStreaming && !isStreaming && !processingRef.current) {
      // 直接从 store 获取最新状态，避免闭包问题
      const currentQueue = useMessageQueueStore.getState().getQueue(pageId)
      // 如果未暂停且队列有内容，自动处理下一条
      if (!currentQueue.paused && currentQueue.items.length > 0) {
        processingRef.current = true
        shiftItem(pageId).then((item) => {
          if (item) {
            onSendMessage(item.content).finally(() => {
              processingRef.current = false
            })
          } else {
            processingRef.current = false
          }
        })
      }
    }
  }, [isStreaming, pageId, shiftItem, onSendMessage])

  const enqueue = useCallback(
    async (content: string) => {
      await addItem(pageId, content)
    },
    [pageId, addItem]
  )

  const remove = useCallback(
    async (itemId: string) => {
      await removeItem(pageId, itemId)
    },
    [pageId, removeItem]
  )

  const update = useCallback(
    async (itemId: string, content: string) => {
      await updateItem(pageId, itemId, content)
    },
    [pageId, updateItem]
  )

  const clear = useCallback(async () => {
    await clearQueue(pageId)
  }, [pageId, clearQueue])

  const pauseQueue = useCallback(async () => {
    await pause(pageId)
  }, [pageId, pause])

  const resumeQueue = useCallback(async () => {
    await resume(pageId)
    // 恢复后立即处理队列
    const currentQueue = getQueue(pageId)
    if (currentQueue.items.length > 0 && !processingRef.current) {
      processingRef.current = true
      const item = await shiftItem(pageId)
      if (item) {
        onSendMessage(item.content).finally(() => {
          processingRef.current = false
        })
      } else {
        processingRef.current = false
      }
    }
  }, [pageId, resume, getQueue, shiftItem, onSendMessage])

  // 发送逻辑：streaming 时入队，否则直接发送
  const handleSend = useCallback(
    async (content: string, attachments?: FileAttachment[]) => {
      if (isStreaming) {
        // AI 正在输出，消息入队（队列目前不支持附件，仅文本）
        await enqueue(content)
      } else {
        // 直接发送（支持附件）
        await onSendMessage(content, attachments ? { attachments } : undefined)
      }
    },
    [isStreaming, enqueue, onSendMessage]
  )

  // 停止并暂停队列
  const handleStop = useCallback(async () => {
    await pause(pageId)
  }, [pageId, pause])

  return {
    items,
    count,
    isPaused,
    enqueue,
    remove,
    update,
    clear,
    pause: pauseQueue,
    resumeQueue,
    handleSend,
    handleStop
  }
}
