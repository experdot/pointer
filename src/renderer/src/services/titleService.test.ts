import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  analyzeTopicSegments,
  batchGenerateTitles,
  generateMessageTitle,
  generateSessionTitle,
  generateTopicTitle
} from './titleService'
import { command } from '../runtime/client'
import { createTopic } from './messagesService'
import type { ChatMessage } from '@shared/domain'

vi.mock('../runtime/client', () => ({ command: vi.fn() }))
vi.mock('./messagesService', () => ({ createTopic: vi.fn() }))
const path: ChatMessage[] = [0, 1, 2].map((index) => ({
  id: `m${index}`,
  role: 'user',
  content: `内容${index}`,
  branchIndex: 0,
  createdAt: index
}))
beforeEach(() => {
  vi.mocked(command).mockReset()
  vi.mocked(createTopic).mockReset()
})

describe('标题及智能分段服务', () => {
  it('三种标题保留目标和模型参数，批量失败不覆盖成功计数', async () => {
    vi.mocked(command).mockResolvedValue('标题')
    const options = { llmId: 'llm', modelConfigId: 'model', extraRequirements: '中文' }
    expect(await generateMessageTitle('p', 'm0', options)).toEqual({ title: '标题', success: true })
    await generateTopicTitle('p', 'topic', options)
    await generateSessionTitle('p', options)
    expect(
      vi.mocked(command).mock.calls.map(([, payload]) => (payload as { target: unknown }).target)
    ).toEqual([
      { kind: 'message', messageId: 'm0' },
      { kind: 'topic', topicId: 'topic' },
      { kind: 'session' }
    ])
    expect(command).toHaveBeenLastCalledWith('chat.generateTitle', expect.objectContaining(options))
    vi.mocked(command)
      .mockResolvedValueOnce('a')
      .mockRejectedValueOnce(new Error('第二条失败'))
      .mockResolvedValueOnce('c')
    const progress = vi.fn()
    expect(await batchGenerateTitles('p', ['m0', 'm1', 'm2'], options, progress)).toEqual({
      success: 2,
      failed: 1,
      errors: ['第二条失败']
    })
    expect(progress.mock.calls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3]
    ])
  })
  it('分段去重、排序并剔除非整数和越界，不创建无效话题', async () => {
    vi.mocked(command).mockResolvedValue({
      content:
        '[{"index":2,"topic":"后"},{"index":0,"topic":"前"},{"index":2,"topic":"重复"},{"index":99,"topic":"越界"},{"index":0.5,"topic":"小数"}]'
    })
    const result = await analyzeTopicSegments('p', path)
    expect(result).toMatchObject({
      success: true,
      created: 2,
      segments: [
        { index: 0, topic: '前' },
        { index: 2, topic: '后' }
      ]
    })
    expect(vi.mocked(createTopic).mock.calls.map(([, input]) => input.startMessageId)).toEqual([
      'm0',
      'm2'
    ])
  })
  it('分段中途失败返回已经创建的准确数量，不自动重试', async () => {
    vi.mocked(command).mockResolvedValue({
      content: '[{"index":0,"topic":"前"},{"index":1,"topic":"后"}]'
    })
    vi.mocked(createTopic)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('页面已删除'))
    expect(await analyzeTopicSegments('p', path)).toMatchObject({
      success: false,
      created: 1,
      error: '页面已删除'
    })
    expect(createTopic).toHaveBeenCalledTimes(2)
  })
  it('空会话不调用模型，空分段和模型故障不落盘', async () => {
    expect(await analyzeTopicSegments('p', [])).toMatchObject({ success: false, created: 0 })
    expect(command).not.toHaveBeenCalled()
    vi.mocked(command)
      .mockResolvedValueOnce({ content: '无分段' })
      .mockRejectedValueOnce(new Error('网络断开'))
    expect(await analyzeTopicSegments('p', path)).toMatchObject({ success: false, created: 0 })
    expect(await analyzeTopicSegments('p', path)).toMatchObject({
      success: false,
      error: '网络断开'
    })
    expect(createTopic).not.toHaveBeenCalled()
  })
})
