import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGlobalSearch } from './useGlobalSearch'
import { useGlobalSearchStore } from '../stores/globalSearchStore'
import { query } from '../runtime/client'
import { deferred } from '../../../../tests/helpers/deferred'
import type { WorkspaceSearchResult } from '@shared/contracts'
import { SEARCH_DEBOUNCE_MS } from '../utils/searchUtils'

vi.mock('../runtime/client', () => ({ query: vi.fn() }))
vi.mock('../services/navigationService', () => ({ navigateToMessage: vi.fn() }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(query).mockReset()
  useGlobalSearchStore.getState().reset()
})

async function start(text: string): Promise<void> {
  act(() => useGlobalSearchStore.getState().setQuery(text))
  await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS))
}

describe('全局搜索异步生命周期', () => {
  it('清空查询立即使旧响应失效，去抖窗口内也不能回填', async () => {
    const pending = deferred<WorkspaceSearchResult>()
    vi.mocked(query).mockReturnValue(pending.promise)
    renderHook(useGlobalSearch)
    await start('旧查询')
    act(() => useGlobalSearchStore.getState().clearSearch())
    await act(async () => pending.resolve({ groups: [], total: 7 }))
    expect(useGlobalSearchStore.getState()).toMatchObject({
      query: '',
      totalCount: 0,
      isSearching: false
    })
  })

  it('同一工作区中较早的响应和 finally 不覆盖较新请求', async () => {
    const first = deferred<WorkspaceSearchResult>()
    const second = deferred<WorkspaceSearchResult>()
    vi.mocked(query).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    renderHook(useGlobalSearch)
    await start('第一条')
    await start('第二条')
    await act(async () => first.resolve({ groups: [], total: 9 }))
    expect(useGlobalSearchStore.getState()).toMatchObject({ totalCount: 0, isSearching: true })
    await act(async () => second.resolve({ groups: [], total: 2 }))
    expect(useGlobalSearchStore.getState()).toMatchObject({ totalCount: 2, isSearching: false })
  })

  it('卸载后不提交结果，并移除尚未触发的定时器', async () => {
    const pending = deferred<WorkspaceSearchResult>()
    vi.mocked(query).mockReturnValue(pending.promise)
    const view = renderHook(useGlobalSearch)
    await start('在途')
    view.unmount()
    await act(async () => pending.resolve({ groups: [], total: 8 }))
    expect(useGlobalSearchStore.getState().totalCount).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('短时间连续输入只查询最后一个值，失败后可立即重试', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(query)
      .mockRejectedValueOnce(new Error('索引不可用'))
      .mockResolvedValue({ groups: [], total: 3 })
    renderHook(useGlobalSearch)
    act(() => useGlobalSearchStore.getState().setQuery('a'))
    act(() => useGlobalSearchStore.getState().setQuery('ab'))
    await start('abc')
    expect(query).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenLastCalledWith(
      'search.workspace',
      expect.objectContaining({ query: 'abc' })
    )
    expect(useGlobalSearchStore.getState()).toMatchObject({ totalCount: 0, isSearching: false })
    await act(async () => useGlobalSearchStore.getState().triggerSearch())
    expect(useGlobalSearchStore.getState().totalCount).toBe(3)
  })
})
