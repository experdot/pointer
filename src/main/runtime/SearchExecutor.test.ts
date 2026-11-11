import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SEARCH_OPTIONS } from '@shared/domain'
import { SearchExecutor } from './SearchExecutor'

const executors: SearchExecutor[] = []
function executor(
  limits = { timeoutMs: 80, maxBytes: 1024 * 1024, maxResults: 1000 }
): SearchExecutor {
  const instance = new SearchExecutor(limits)
  executors.push(instance)
  return instance
}
afterEach(async () => {
  await Promise.all(executors.splice(0).map((item) => item.dispose()))
})

describe('真实搜索线程与资源预算', () => {
  it('保留 Unicode 偏移、整词和非法/零宽正则的语义', async () => {
    const instance = executor()
    expect(
      await instance.run(['😀 alpha alphabet ALPHA'], 'alpha', {
        ...DEFAULT_SEARCH_OPTIONS,
        matchWholeWord: true
      })
    ).toEqual([
      {
        index: 0,
        ranges: [
          { start: 3, end: 8 },
          { start: 18, end: 23 }
        ]
      }
    ])
    expect(
      await instance.run(['😀'], '(?=😀)', { ...DEFAULT_SEARCH_OPTIONS, useRegex: true })
    ).toEqual([])
    expect(
      await instance.run(['anything'], '[', { ...DEFAULT_SEARCH_OPTIONS, useRegex: true })
    ).toEqual([])
  })
  it('灾难性回溯超时后终止线程，主线程仍响应且下次搜索正常', async () => {
    const instance = executor()
    let heartbeat = false
    const timer = setTimeout(() => {
      heartbeat = true
    }, 10)
    try {
      await expect(
        instance.run(['a'.repeat(30000) + '!'], '(a+)+$', {
          ...DEFAULT_SEARCH_OPTIONS,
          useRegex: true
        })
      ).rejects.toMatchObject({ code: 'search.timeout' })
      expect(heartbeat).toBe(true)
      expect(await instance.run(['retry'], 'retry', DEFAULT_SEARCH_OPTIONS)).toHaveLength(1)
    } finally {
      clearTimeout(timer)
    }
  })
  it('输入和输出预算明确报错，不返回被静默截断的结果', async () => {
    const instance = executor({ timeoutMs: 1000, maxBytes: 50, maxResults: 2 })
    await expect(instance.run(['a'.repeat(26)], 'a', DEFAULT_SEARCH_OPTIONS)).rejects.toMatchObject(
      { code: 'search.input-limit' }
    )
    await expect(instance.run(['a a a'], 'a', DEFAULT_SEARCH_OPTIONS)).rejects.toMatchObject({
      code: 'search.result-limit'
    })
  })
  it('只保留两个活动任务，关闭会取消剩余任务并拒绝新任务', async () => {
    const instance = executor({ timeoutMs: 5000, maxBytes: 1024 * 1024, maxResults: 1000 })
    const slow = (): Promise<unknown> =>
      instance
        .run(['a'.repeat(30000) + '!'], '(a+)+$', { ...DEFAULT_SEARCH_OPTIONS, useRegex: true })
        .catch((error) => error)
    const first = slow()
    const second = slow()
    expect(await instance.run(['next'], 'next', DEFAULT_SEARCH_OPTIONS)).toHaveLength(1)
    expect(await first).toMatchObject({ code: 'search.superseded' })
    await instance.dispose()
    expect(await second).toMatchObject({ code: 'search.superseded' })
    await expect(instance.run([], '', DEFAULT_SEARCH_OPTIONS)).rejects.toMatchObject({
      code: 'search.closed'
    })
  })
})
