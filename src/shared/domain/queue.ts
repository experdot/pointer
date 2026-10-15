/**
 * 消息队列领域模型
 *
 * 队列属于会话：按 order 依次发送，暂停时不继续出队。
 */

export interface QueueItem {
  id: string
  content: string
  order: number
  createdAt: number
}

export interface MessageQueue {
  pageId: string
  items: QueueItem[]
  paused: boolean
}

export function emptyQueue(pageId: string): MessageQueue {
  return { pageId, items: [], paused: false }
}

function sorted(queue: MessageQueue): QueueItem[] {
  return [...queue.items].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
}

export function enqueue(queue: MessageQueue, item: QueueItem): MessageQueue {
  const nextOrder = queue.items.reduce((max, entry) => Math.max(max, entry.order + 1), 0)
  return { ...queue, items: [...queue.items, { ...item, order: nextOrder }] }
}

export function removeItem(queue: MessageQueue, itemId: string): MessageQueue {
  return normalizeOrders({ ...queue, items: queue.items.filter((item) => item.id !== itemId) })
}

export function updateItem(queue: MessageQueue, itemId: string, content: string): MessageQueue {
  return {
    ...queue,
    items: queue.items.map((item) => (item.id === itemId ? { ...item, content } : item))
  }
}

export function clear(queue: MessageQueue): MessageQueue {
  return { ...queue, items: [] }
}

export function setPaused(queue: MessageQueue, paused: boolean): MessageQueue {
  return { ...queue, paused }
}

/** 按 order 重排，消除删除后的空洞 */
export function normalizeOrders(queue: MessageQueue): MessageQueue {
  const items = sorted(queue).map((item, position) =>
    item.order === position ? item : { ...item, order: position }
  )
  return { ...queue, items }
}

/** 取出队首元素 */
export function shiftItem(queue: MessageQueue): { queue: MessageQueue; item?: QueueItem } {
  const [first, ...rest] = sorted(queue)
  if (!first) return { queue }
  return { queue: normalizeOrders({ ...queue, items: rest }), item: first }
}

/** 重排为给定顺序 */
export function reorder(queue: MessageQueue, orderedIds: readonly string[]): MessageQueue {
  const positionById = new Map(orderedIds.map((id, index) => [id, index]))
  const sortedById = [...queue.items].sort((a, b) => {
    const pa = positionById.get(a.id)
    const pb = positionById.get(b.id)
    if (pa === undefined && pb === undefined) return a.order - b.order
    if (pa === undefined) return 1
    if (pb === undefined) return -1
    return pa - pb
  })
  return { ...queue, items: sortedById.map((item, index) => ({ ...item, order: index })) }
}
