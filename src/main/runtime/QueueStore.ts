/**
 * 消息队列存储（每个会话一个文件）
 */

import type { MessageQueue, QueueItem } from '@shared/domain'
import { emptyQueue, enqueue, removeItem, setPaused, updateItem, clear } from '@shared/domain'
import type { PathResolver } from './paths'
import { readJson } from './fsx'
import { RuntimeError } from '@shared/contracts'

export class QueueStore {
  constructor(
    private readonly paths: PathResolver,
    private readonly workspacePath: string,
    private readonly pageExists: (pageId: string) => boolean,
    private readonly writeJson: (path: string, value: unknown) => Promise<void>
  ) {}

  async get(pageId: string): Promise<MessageQueue> {
    if (!this.pageExists(pageId)) throw new RuntimeError('page.not-found', '页面不存在')
    const file = await readJson<MessageQueue>(this.paths.queueFile(this.workspacePath, pageId))
    return file ? { ...file, pageId } : emptyQueue(pageId)
  }

  async add(pageId: string, item: Omit<QueueItem, 'order'>): Promise<MessageQueue> {
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

  private async save(queue: MessageQueue): Promise<void> {
    if (!this.pageExists(queue.pageId)) throw new RuntimeError('page.not-found', '页面不存在')
    await this.writeJson(this.paths.queueFile(this.workspacePath, queue.pageId), queue)
  }
}
