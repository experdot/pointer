import { useCallback, useMemo } from 'react'
import { useMessageQueueStore } from '../stores/messageQueueStore'
import type { AttachmentRef, MessageQueue, QueueItem } from '@renderer/types/shared'

/** 未加载页面的兜底空队列：只需要一个稳定引用，本 hook 只消费 items / paused */
const EMPTY_QUEUE: MessageQueue = { pageId: '', items: [], paused: false }

interface UseMessageQueueOptions {
  pageId: string
  isStreaming: boolean
  onSendMessage: (content: string, options?: { attachments?: AttachmentRef[] }) => Promise<void>
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
  handleSend: (content: string, attachments?: AttachmentRef[]) => Promise<void>
  // 停止并暂停队列
  handleStop: () => Promise<void>
}

export function useMessageQueue({
  pageId,
  isStreaming,
  onSendMessage
}: UseMessageQueueOptions): UseMessageQueueResult {
  // 只订阅本页队列：别的会话的队列变化不再重渲染这个编辑器
  const queue = useMessageQueueStore((state) => state.cache[pageId]) ?? EMPTY_QUEUE
  const addItem = useMessageQueueStore((state) => state.addItem)
  const removeItem = useMessageQueueStore((state) => state.removeItem)
  const updateItem = useMessageQueueStore((state) => state.updateItem)
  const clearQueue = useMessageQueueStore((state) => state.clearQueue)
  const pause = useMessageQueueStore((state) => state.pause)
  const resume = useMessageQueueStore((state) => state.resume)

  const items = useMemo(() => queue.items, [queue.items])
  const count = items.length
  const isPaused = queue.paused

  // 队列的出队与发送由内核负责：会话空闲时自动发送下一条

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
  }, [pageId, resume])

  // 发送逻辑：streaming 时入队，否则直接发送
  const handleSend = useCallback(
    async (content: string, attachments?: AttachmentRef[]) => {
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
