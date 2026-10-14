import { describe, expect, it } from 'vitest'
import type { MessageQueue } from './queue'
import {
  clear,
  emptyQueue,
  enqueue,
  normalizeOrders,
  removeItem,
  reorder,
  setPaused,
  shiftItem,
  updateItem
} from './queue'

function queueWith(...ids: string[]): MessageQueue {
  return ids.reduce(
    (queue, id, index) =>
      enqueue(queue, { id, content: `content-${id}`, order: 0, createdAt: index }),
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

  it('出队遵循先进先出', () => {
    const { queue, item } = shiftItem(queueWith('a', 'b'))
    expect(item?.id).toBe('a')
    expect(queue.items.map((entry) => entry.id)).toEqual(['b'])
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

  it('重排与清空', () => {
    expect(reorder(queueWith('a', 'b', 'c'), ['c', 'a']).items.map((item) => item.id)).toEqual([
      'c',
      'a',
      'b'
    ])
    expect(clear(queueWith('a')).items).toEqual([])
  })

  it('normalizeOrders 幂等', () => {
    const queue = queueWith('a', 'b')
    expect(normalizeOrders(normalizeOrders(queue))).toEqual(normalizeOrders(queue))
  })
})
