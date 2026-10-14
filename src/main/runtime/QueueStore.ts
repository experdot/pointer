/**
 * 消息队列存储（每个会话一个文件）
 */

import type { MessageQueue, QueueItem } from '../../shared/domain'
import {
  emptyQueue,
  enqueue,
  removeItem,
  setPaused,
  shiftItem,
  updateItem,
  clear
} from '../../shared/domain'
import type { PathResolver } from './paths'
import { readJson, removePath, writeJsonAtomic } from './fsx'

export class QueueStore {
  constructor(
    private readonly paths: PathResolver,
    private readonly workspacePath: string
  ) {}

  async get(pageId: string): Promise<MessageQueue> {
    const file = await readJson<MessageQueue>(this.paths.queueFile(this.workspacePath, pageId))
    return file ?? emptyQueue(pageId)
  }

  async add(pageId: string, item: QueueItem): Promise<MessageQueue> {
    const next = enqueue(await this.get(pageId), item)
    await this.save(next)
    return next
  }

  async update(pageId: string, itemId: string, content: string): Promise<MessageQueue> {
    const next = updateItem(await this.get(pageId), itemId, content)
    await this.save(next)
    return next
  }

  async remove(pageId: string, itemId: string): Promise<MessageQueue> {
    const next = removeItem(await this.get(pageId), itemId)
    await this.save(next)
    return next
  }

  async clear(pageId: string): Promise<MessageQueue> {
    const next = clear(await this.get(pageId))
    await this.save(next)
    return next
  }

  async setPaused(pageId: string, paused: boolean): Promise<MessageQueue> {
    const next = setPaused(await this.get(pageId), paused)
    await this.save(next)
    return next
  }

  async shift(pageId: string): Promise<{ queue: MessageQueue; item?: QueueItem }> {
    const result = shiftItem(await this.get(pageId))
    await this.save(result.queue)
    return result
  }

  async removeForPage(pageId: string): Promise<void> {
    await removePath(this.paths.queueFile(this.workspacePath, pageId))
  }

  private async save(queue: MessageQueue): Promise<void> {
    await writeJsonAtomic(this.paths.queueFile(this.workspacePath, queue.pageId), queue)
  }
}
