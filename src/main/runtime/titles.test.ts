import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createKernel, controlledProvider, type KernelFixture } from '../../../tests/helpers/kernel'

let f: KernelFixture
let pageId: string
beforeEach(async () => {
  f = await createKernel()
  await f.configure()
  pageId = (await f.command('page.create', { name: '原名称' })).id
  await f.command('conversation.append', {
    pageId,
    draft: { id: 'u', role: 'user', content: '用户问题' }
  })
  await f.command('conversation.append', {
    pageId,
    draft: { id: 'a', role: 'assistant', content: '模型回答', parentMessageId: 'u' }
  })
})
afterEach(async () => {
  await f.dispose()
})
describe('模型标题与目标生命周期', () => {
  it('消息、话题和页面标题落盘，额外要求进入请求且保留其他字段', async () => {
    const provider = controlledProvider()
    await f.command('topic.create', {
      pageId,
      topic: { id: 't', name: '旧话题', startMessageId: 'u', endMessageId: 'a' }
    })
    await f.command('topic.update', { pageId, topicId: 't', patch: { collapsed: true } })
    const targets = [
      { kind: 'message' as const, messageId: 'a' },
      { kind: 'topic' as const, topicId: 't' },
      { kind: 'session' as const }
    ]
    for (let index = 0; index < targets.length; index++) {
      const pending = f.command('chat.generateTitle', {
        pageId,
        target: targets[index],
        extraRequirements: '请使用中文'
      })
      await vi.waitFor(() => expect(provider.requests).toHaveLength(index + 1))
      expect(JSON.stringify(provider.requests[index].body.messages)).toContain('请使用中文')
      provider.requests[index].delta('“新的标题！”\n多余内容')
      provider.requests[index].finish()
      expect(await pending).toBe('新的标题')
    }
    await f.restart()
    const record = await f.query('conversation.get', { pageId })
    expect(record.messages[1]).toMatchObject({
      title: '新的标题',
      content: '模型回答',
      parentMessageId: 'u'
    })
    expect(record.topics[0]).toMatchObject({ name: '新的标题', collapsed: true })
    expect((await f.query('tree.get', undefined)).pages[0].name).toBe('新的标题')
  })
  it('目标删除后不复活消息，空标题和断流不覆盖原内容', async () => {
    const provider = controlledProvider()
    const pending = f
      .command('chat.generateTitle', { pageId, target: { kind: 'message', messageId: 'a' } })
      .catch((error) => error)
    await vi.waitFor(() => expect(provider.requests).toHaveLength(1))
    await f.command('conversation.deleteMessage', { pageId, messageId: 'a' })
    provider.requests[0].delta('已经过时')
    provider.requests[0].finish()
    expect(await pending).toMatchObject({ code: 'runtime.stale-scope' })
    expect((await f.query('conversation.get', { pageId })).messages.map((item) => item.id)).toEqual(
      ['u']
    )
    const empty = f
      .command('chat.generateTitle', { pageId, target: { kind: 'session' } })
      .catch((error) => error)
    await vi.waitFor(() => expect(provider.requests).toHaveLength(2))
    provider.requests[1].finish()
    expect(await empty).toMatchObject({ code: 'chat.title-empty' })
    expect((await f.query('tree.get', undefined)).pages[0].name).toBe('原名称')
  })
  it('切换账户取消在途标题，不写入旧工作区或新工作区', async () => {
    const provider = controlledProvider()
    const pending = f
      .command('chat.generateTitle', { pageId, target: { kind: 'session' } })
      .catch((error) => error)
    await vi.waitFor(() => expect(provider.requests).toHaveLength(1))
    await f.command('account.create', { name: '另一个账户' })
    expect(provider.requests[0].options?.signal?.aborted).toBe(true)
    expect(await pending).toMatchObject({ code: 'chat.aborted' })
    expect((await f.query('tree.get', undefined)).pages).toEqual([])
  })
})
