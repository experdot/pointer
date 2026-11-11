import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createKernel, controlledProvider, type KernelFixture } from '../../../tests/helpers/kernel'
import { validateConversation } from '@shared/domain'
import * as fsx from './fsx'

let f: KernelFixture
beforeEach(async () => {
  f = await createKernel()
  await f.configure()
})
afterEach(async () => {
  await f.dispose()
})

describe('生成与分支的完整生命周期', () => {
  it('最终提交标记写入失败不会发出远端请求或消息事件，重试恰好发送一次', async () => {
    const provider = controlledProvider()
    const page = await f.command('page.create', {})
    const write = fsx.writeJsonAtomic
    let failed = false
    vi.spyOn(fsx, 'writeJsonAtomic').mockImplementation(async (path, value) => {
      if (
        !failed &&
        path.endsWith('manifest.json') &&
        (value as { committed?: boolean }).committed
      ) {
        failed = true
        throw new Error('提交标记失败')
      }
      await write(path, value)
    })
    f.events.length = 0
    await expect(
      f.command('chat.send', { pageId: page.id, content: '应当重试的问题' })
    ).rejects.toThrow('提交标记失败')
    expect(provider.requests).toHaveLength(0)
    expect(f.events.filter((event) => event.type === 'conversation.message')).toHaveLength(0)
    expect((await f.query('conversation.get', { pageId: page.id })).messages).toEqual([])
    const handle = await f.command('chat.send', { pageId: page.id, content: '应当重试的问题' })
    expect(provider.requests).toHaveLength(1)
    provider.requests[0].delta('已完成')
    provider.requests[0].finish()
    await f.terminal(handle.requestId)
  })

  it('重新生成和继续生成使用目标分支上下文，原回答仍保留', async () => {
    const provider = controlledProvider()
    const page = await f.command('page.create', { name: '分支' })
    const first = await f.command('chat.send', { pageId: page.id, content: '问题' })
    provider.requests[0].delta('第一次回答', '思考')
    provider.requests[0].finish()
    await f.terminal(first.requestId)
    const original = await f.query('conversation.get', { pageId: page.id })
    const parentId = original.messages.find((item) => item.id === first.messageId)!.parentMessageId
    const retry = await f.command('chat.regenerate', {
      pageId: page.id,
      messageId: first.messageId
    })
    expect(provider.requests[1].body.messages).toEqual([{ role: 'user', content: '问题' }])
    provider.requests[1].delta('重新回答')
    provider.requests[1].finish()
    await f.terminal(retry.requestId)
    const continued = await f.command('chat.continue', { pageId: page.id, messageId: parentId })
    expect(provider.requests[2].body.messages).toEqual([{ role: 'user', content: '问题' }])
    provider.requests[2].delta('继续回答')
    provider.requests[2].finish()
    await f.terminal(continued.requestId)
    const conversation = await f.query('conversation.get', { pageId: page.id })
    expect(conversation.messages.filter((item) => item.role === 'user')).toHaveLength(1)
    expect(
      conversation.messages.filter((item) => item.role === 'assistant').map((item) => item.content)
    ).toEqual(['第一次回答', '重新回答', '继续回答'])
    expect(
      conversation.messages
        .filter((item) => item.role === 'assistant')
        .map((item) => item.parentMessageId)
    ).toEqual([parentId, parentId, parentId])
    expect(validateConversation(conversation)).toEqual([])
    await f.restart()
    expect(await f.query('conversation.get', { pageId: page.id })).toMatchObject({
      pageId: page.id,
      leafMessageId: conversation.leafMessageId,
      messages: JSON.parse(JSON.stringify(conversation.messages)),
      topics: conversation.topics
    })
  })

  it('生成中删除父消息，中止该回答且不写出孤儿消息', async () => {
    const provider = controlledProvider()
    const page = await f.command('page.create', {})
    const handle = await f.command('chat.send', { pageId: page.id, content: '将删除的问题' })
    provider.requests[0].delta('已生成部分')
    const user = (await f.query('conversation.get', { pageId: page.id })).messages[0]
    await f.command('conversation.deleteMessage', { pageId: page.id, messageId: user.id })
    provider.requests[0].finish()
    await f.terminal(handle.requestId)
    const conversation = await f.query('conversation.get', { pageId: page.id })
    expect(conversation.messages).toEqual([])
    expect(validateConversation(conversation)).toEqual([])
    await f.restart()
    expect((await f.query('conversation.get', { pageId: page.id })).messages).toEqual([])
  })

  it('流发生网络错误保留部分内容，并只发一个失败终态', async () => {
    const provider = controlledProvider()
    const page = await f.command('page.create', {})
    const handle = await f.command('chat.send', { pageId: page.id, content: '问题' })
    provider.requests[0].delta('部分内容')
    await vi.waitFor(() => expect(f.events.some((event) => event.type === 'chat.delta')).toBe(true))
    provider.requests[0].fail(new Error('连接断开'))
    await f.terminal(handle.requestId)
    const answer = (await f.query('conversation.get', { pageId: page.id })).messages.find(
      (item) => item.id === handle.messageId
    )!
    expect(answer.content).toContain('部分内容')
    expect(answer.content).toContain('连接断开')
    expect(answer.hasError).toBe(true)
    expect(
      f.events.filter((event) =>
        ['chat.failed', 'chat.completed', 'chat.aborted'].includes(event.type)
      )
    ).toHaveLength(1)
  })
})

describe('队列持久化与执行', () => {
  it('出队保存失败不启动模型、不丢项目，重试后恰好发送一次', async () => {
    const provider = controlledProvider()
    const page = await f.command('page.create', {})
    await f.command('queue.setPaused', { pageId: page.id, paused: true })
    const id = await f.command('queue.add', { pageId: page.id, content: '排队的问题' })
    const originalWrite = fsx.writeJsonAtomic
    let rejected = false
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(fsx, 'writeJsonAtomic').mockImplementation(async (path, value) => {
      if (
        !rejected &&
        path.includes('queues') &&
        (value as { items: unknown[] }).items.length === 0
      ) {
        rejected = true
        throw new Error('出队保存失败')
      }
      return originalWrite(path, value)
    })
    await f.command('queue.setPaused', { pageId: page.id, paused: false })
    await vi.waitFor(() => expect(rejected).toBe(true))
    const queue = await f.query('queue.get', { pageId: page.id })
    expect(queue.items.map((item) => item.id)).toEqual([id])
    expect(provider.fetch).not.toHaveBeenCalled()
    expect((await f.query('conversation.get', { pageId: page.id })).messages).toEqual([])
    await f.command('queue.setPaused', { pageId: page.id, paused: false })
    await vi.waitFor(() => expect(provider.requests).toHaveLength(1))
    provider.requests[0].delta('回答')
    provider.requests[0].finish()
    await vi.waitFor(async () =>
      expect((await f.query('conversation.get', { pageId: page.id })).messages).toHaveLength(2)
    )
    expect((await f.query('queue.get', { pageId: page.id })).items).toEqual([])
    await f.restart()
    expect(provider.fetch).toHaveBeenCalledTimes(1)
  })

  it('编辑、移除、暂停及恢复在重启后保持顺序，执行完清空队列', async () => {
    const provider = controlledProvider()
    const page = await f.command('page.create', {})
    await f.command('queue.setPaused', { pageId: page.id, paused: true })
    const first = await f.command('queue.add', { pageId: page.id, content: '原始' })
    const second = await f.command('queue.add', { pageId: page.id, content: '移除' })
    await f.command('queue.update', { pageId: page.id, itemId: first, content: '修改后' })
    await f.command('queue.remove', { pageId: page.id, itemId: second })
    await f.restart()
    expect(await f.query('queue.get', { pageId: page.id })).toMatchObject({
      paused: true,
      items: [expect.objectContaining({ content: '修改后' })]
    })
    expect(provider.fetch).not.toHaveBeenCalled()
    await f.command('queue.setPaused', { pageId: page.id, paused: false })
    await vi.waitFor(() => expect(provider.requests).toHaveLength(1))
    expect(provider.requests[0].body.messages).toEqual([{ role: 'user', content: '修改后' }])
    provider.requests[0].finish()
    await vi.waitFor(async () =>
      expect((await f.query('queue.get', { pageId: page.id })).items).toEqual([])
    )
    await f.command('queue.setPaused', { pageId: page.id, paused: true })
    await f.command('queue.add', { pageId: page.id, content: '待清空' })
    await f.command('queue.clear', { pageId: page.id })
    expect((await f.query('queue.get', { pageId: page.id })).items).toEqual([])
  })
})
