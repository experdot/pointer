import { expect, it, vi } from 'vitest'
import { createKernel, controlledProvider } from '../helpers/kernel'
import * as fsx from '../../src/main/runtime/fsx'

it('一千个流式分片只在用户消息和回答结束时写页面，结束后没有遗留事务', async () => {
  const f = await createKernel()
  try {
    await f.configure()
    const provider = controlledProvider()
    const page = await f.command('page.create', { name: '写入预算' })
    const write = vi.spyOn(fsx, 'writeTextAtomic')
    const handle = await f.command('chat.send', { pageId: page.id, content: '请求长回答' })
    const pageWrites = (): number =>
      write.mock.calls.filter(([path]) => path.endsWith('.pointer.md')).length
    expect(pageWrites()).toBe(1)
    for (let index = 0; index < 1000; index++) provider.requests[0].delta('中文🧪')
    await vi.waitFor(() =>
      expect(f.events.filter((event) => event.type === 'chat.delta')).toHaveLength(1000)
    )
    expect(pageWrites()).toBe(1)
    provider.requests[0].finish()
    await f.terminal(handle.requestId)
    expect(pageWrites()).toBe(2)
    expect((await f.query('conversation.get', { pageId: page.id })).messages.at(-1)?.content).toBe(
      '中文🧪'.repeat(1000)
    )
    const session = await f.query('session.get', undefined)
    expect(await fsx.listDirectories(`${session.workspacePath}/.pointer/transactions`)).toEqual([])
    await f.restart()
    expect((await f.query('conversation.get', { pageId: page.id })).messages.at(-1)?.content).toBe(
      '中文🧪'.repeat(1000)
    )
  } finally {
    await f.dispose()
  }
})
