import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSearchHighlight } from './useSearchHighlight'
import type { SearchState } from '../stores/chatUIStore'
import type { ChatMessage } from '@shared/domain'
import type { MessageSearchMatch } from '@shared/contracts'
import { query } from '../runtime/client'
import { deferred } from '../../../../tests/helpers/deferred'
import { SEARCH_DEBOUNCE_MS } from '../utils/searchUtils'

vi.mock('../runtime/client', () => ({ query: vi.fn() }))
vi.mock('../services/navigationService', () => ({ expandTopicsForMessage: vi.fn() }))
const messages: ChatMessage[] = [
  { id: 'm', role: 'user', content: 'alpha', createdAt: 1, branchIndex: 0 }
]
const containerRef = { current: null }
const match: MessageSearchMatch = { messageId: 'm', startOffset: 0, endOffset: 5, globalIndex: 0 }
const state: SearchState = {
  isOpen: true,
  query: 'alpha',
  matchCase: false,
  matchWholeWord: false,
  useRegex: false,
  currentIndex: 0,
  focusRequestKey: 0
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('CSS', {})
  vi.mocked(query).mockReset()
})
async function tick(): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS))
}

describe('会话内异步搜索', () => {
  it('在内核计算最新内容和选项，旧响应不覆盖新的结果', async () => {
    const old = deferred<MessageSearchMatch[]>()
    vi.mocked(query).mockReturnValueOnce(old.promise).mockResolvedValue([])
    const view = renderHook(
      ({ searchState }) => useSearchHighlight({ containerRef, messages, searchState, pageId: 'p' }),
      { initialProps: { searchState: state } }
    )
    await tick()
    view.rerender({ searchState: { ...state, query: 'beta', useRegex: true } })
    await tick()
    await act(async () => old.resolve([match]))
    expect(view.result.current.matches).toEqual([])
    expect(query).toHaveBeenLastCalledWith('search.messages', {
      messages: [{ id: 'm', content: 'alpha' }],
      query: 'beta',
      options: { matchCase: false, matchWholeWord: false, useRegex: true }
    })
  })
  it('清空和关闭立即清除匹配，卸载清理定时器与在途回调', async () => {
    vi.mocked(query).mockResolvedValue([match])
    const view = renderHook(
      ({ searchState }) => useSearchHighlight({ containerRef, messages, searchState, pageId: 'p' }),
      { initialProps: { searchState: state } }
    )
    await tick()
    expect(view.result.current.total).toBe(1)
    view.rerender({ searchState: { ...state, query: '' } })
    expect(view.result.current.total).toBe(0)
    view.rerender({ searchState: { ...state, isOpen: false } })
    await tick()
    expect(query).toHaveBeenCalledTimes(1)
    view.rerender({ searchState: state })
    view.unmount()
    await tick()
    expect(query).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('显示超时错误，修改查询可以恢复', async () => {
    vi.mocked(query).mockRejectedValueOnce(new Error('搜索耗时过长')).mockResolvedValue([match])
    const view = renderHook(
      ({ searchState }) => useSearchHighlight({ containerRef, messages, searchState, pageId: 'p' }),
      { initialProps: { searchState: state } }
    )
    await tick()
    expect(view.result.current.error).toBe('搜索耗时过长')
    view.rerender({ searchState: { ...state, query: 'a' } })
    await tick()
    expect(view.result.current).toMatchObject({ error: null, total: 1 })
  })
})
