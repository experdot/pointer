import { describe, expect, it } from 'vitest'
import type { MessageQueue } from './queue'
import {
  clear,
  emptyQueue,
  enqueue,
  normalizeOrders,
  removeItem,
  setPaused,
  updateItem
} from './queue'

function queueWith(...ids: string[]): MessageQueue {
  return ids.reduce(
    (queue, id, index) => enqueue(queue, { id, content: `content-${id}`, createdAt: index }),
    emptyQueue('page-1')
  )
}

describe('消息队列', () => {
  it('入队按序递增 order', () => {
    expect(queueWith('a', 'b').items.map((item) => [item.id, item.order])).toEqual([
      ['a', 0],
      ['b', 1]
    ])
  })

  it('删除后重排 order', () => {
    const queue = removeItem(queueWith('a', 'b', 'c'), 'a')
    expect(queue.items.map((item) => [item.id, item.order])).toEqual([
      ['b', 0],
      ['c', 1]
    ])
  })

  it('更新内容与暂停状态', () => {
    const queue = setPaused(updateItem(queueWith('a'), 'a', '新内容'), true)
    expect(queue.items[0].content).toBe('新内容')
    expect(queue.paused).toBe(true)
  })

  it('清空', () => {
    expect(clear(queueWith('a')).items).toEqual([])
  })

  it('normalizeOrders 幂等', () => {
    const queue = queueWith('a', 'b')
    expect(normalizeOrders(normalizeOrders(queue))).toEqual(normalizeOrders(queue))
  })
})
