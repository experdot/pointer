import { useState, useCallback, useRef, useEffect } from 'react'
import { MessageQueueItem, MessageQueueConfig, MessageQueueItemStatus, FileAttachment } from '../../../types/type'
import { nanoid } from 'nanoid'

interface UseMessageQueueProps {
  onProcessMessage: (content: string, modelId?: string, parentId?: string, attachments?: FileAttachment[]) => Promise<void>
  isLoading: boolean
}

export function useMessageQueue({ onProcessMessage, isLoading }: UseMessageQueueProps) {
  const [queue, setQueue] = useState<MessageQueueItem[]>([])
  const [config, setConfig] = useState<MessageQueueConfig>({
    enabled: true,
    autoProcess: true,
    paused: true, // 默认暂停，只有通过输入框加入队列时才自动恢复
    maxRetries: 3
  })
  const [currentlyProcessing, setCurrentlyProcessing] = useState<string | null>(null)
  const processingRef = useRef(false)

  // 添加消息到队列
  const addToQueue = useCallback((content: string, modelId?: string, options?: { autoResume?: boolean; attachments?: FileAttachment[] }) => {
    const newItem: MessageQueueItem = {
      id: nanoid(),
      content,
      modelId,
      attachments: options?.attachments,
      status: 'pending',
      createdAt: Date.now(),
      order: Date.now() // 使用时间戳作为顺序
    }

    setQueue((prev) => [...prev, newItem])

    // 如果指定了 autoResume，则自动恢复队列
    if (options?.autoResume) {
      setConfig((prev) => ({ ...prev, paused: false }))
    }

    return newItem.id
  }, [])

  // 从队列中移除消息
  const removeFromQueue = useCallback((itemId: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== itemId))
  }, [])

  // 更新队列项状态
  const updateQueueItem = useCallback((
    itemId: string,
    updates: Partial<MessageQueueItem>
  ) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, ...updates } : item))
    )
  }, [])

  // 编辑队列项内容
  const editQueueItem = useCallback((itemId: string, newContent: string) => {
    updateQueueItem(itemId, { content: newContent })
  }, [updateQueueItem])

  // 清空队列
  const clearQueue = useCallback(() => {
    setQueue((prev) => prev.filter((item) => item.status === 'processing'))
  }, [])

  // 清空已完成或失败的项
  const clearCompletedItems = useCallback(() => {
    setQueue((prev) =>
      prev.filter((item) => item.status !== 'completed' && item.status !== 'failed')
    )
  }, [])

  // 重新排序队列项
  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      const newQueue = [...prev]
      const [removed] = newQueue.splice(fromIndex, 1)
      newQueue.splice(toIndex, 0, removed)

      // 更新顺序
      return newQueue.map((item, index) => ({
        ...item,
        order: Date.now() + index
      }))
    })
  }, [])

  // 重试失败的消息
  const retryQueueItem = useCallback((itemId: string) => {
    updateQueueItem(itemId, {
      status: 'pending',
      error: undefined,
      startedAt: undefined,
      completedAt: undefined
    })
  }, [updateQueueItem])

  // 处理队列中的下一条消息
  const processNextInQueue = useCallback(async () => {
    if (processingRef.current || isLoading) {
      return
    }

    const pendingItem = queue.find((item) => item.status === 'pending')
    if (!pendingItem) {
      return
    }

    processingRef.current = true
    setCurrentlyProcessing(pendingItem.id)

    try {
      updateQueueItem(pendingItem.id, {
        status: 'processing',
        startedAt: Date.now()
      })

      await onProcessMessage(pendingItem.content, pendingItem.modelId, undefined, pendingItem.attachments)

      updateQueueItem(pendingItem.id, {
        status: 'completed',
        completedAt: Date.now()
      })
    } catch (error) {
      console.error('处理队列消息失败:', error)
      updateQueueItem(pendingItem.id, {
        status: 'failed',
        completedAt: Date.now(),
        error: error instanceof Error ? error.message : '未知错误'
      })
    } finally {
      processingRef.current = false
      setCurrentlyProcessing(null)
    }
  }, [queue, isLoading, onProcessMessage, updateQueueItem])

  // 当 isLoading 变为 false 且有待处理的消息时，自动处理下一条
  useEffect(() => {
    if (!isLoading && config.autoProcess && !config.paused && !processingRef.current) {
      const hasPending = queue.some((item) => item.status === 'pending')
      if (hasPending) {
        // 添加一个小延迟，确保界面更新完成
        setTimeout(() => {
          processNextInQueue()
        }, 500)
      }
    }
  }, [isLoading, config.autoProcess, config.paused, queue, processNextInQueue])

  // 更新配置
  const updateConfig = useCallback((newConfig: Partial<MessageQueueConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }))
  }, [])

  // 获取队列统计信息
  const getQueueStats = useCallback(() => {
    return {
      total: queue.length,
      pending: queue.filter((item) => item.status === 'pending').length,
      processing: queue.filter((item) => item.status === 'processing').length,
      completed: queue.filter((item) => item.status === 'completed').length,
      failed: queue.filter((item) => item.status === 'failed').length
    }
  }, [queue])

  // 处理停止操作 - 将正在处理的项标记为失败，并暂停队列
  const handleStop = useCallback(() => {
    if (currentlyProcessing) {
      updateQueueItem(currentlyProcessing, {
        status: 'failed',
        completedAt: Date.now(),
        error: '用户停止'
      })
      processingRef.current = false
      setCurrentlyProcessing(null)
    }
    // 暂停队列处理
    setConfig((prev) => ({ ...prev, paused: true }))
  }, [currentlyProcessing, updateQueueItem])

  // 继续队列处理
  const resumeQueue = useCallback(() => {
    setConfig((prev) => ({ ...prev, paused: false }))
    // 立即尝试处理下一条
    setTimeout(() => {
      processNextInQueue()
    }, 100)
  }, [processNextInQueue])

  return {
    queue,
    config,
    currentlyProcessing,
    addToQueue,
    removeFromQueue,
    updateQueueItem,
    editQueueItem,
    clearQueue,
    clearCompletedItems,
    reorderQueue,
    retryQueueItem,
    processNextInQueue,
    updateConfig,
    getQueueStats,
    handleStop,
    resumeQueue
  }
}
