import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTabsStore } from './tabsStore'
import { useViewStateStore } from './viewStateStore'
import { registerTabType } from '../utils/tabRegistry'
import { command } from '../runtime/client'
import type { Tab } from '@shared/contracts'

vi.mock('../runtime/client', () => ({ command: vi.fn(), query: vi.fn() }))
const tab = (id: string): Tab => ({ id, type: 'test-chat', dataId: id, title: id, closable: true })
beforeEach(() => {
  useViewStateStore.getState().reset()
  useTabsStore.setState({ tabs: [], activeTabId: null, history: [], historyIndex: -1 })
  vi.mocked(command).mockReset().mockResolvedValue(undefined)
  registerTabType({
    type: 'test-chat',
    icon: null,
    renderEditor: () => null,
    validateData: (id) => id !== 'deleted',
    restoreTab: (id) => (id !== 'deleted' ? tab(id) : null)
  })
})
describe('标签预览、固定、排序和历史恢复', () => {
  it('预览替换、保留和固定按边界排序，关闭其他/右侧保留固定标签', async () => {
    const state = useTabsStore.getState()
    state.openTab(tab('a'), true)
    state.openTab(tab('b'), true)
    expect(useTabsStore.getState().tabs.map((item) => item.id)).toEqual(['b'])
    state.keepTab('b')
    state.openTab(tab('c'), true)
    state.togglePinTab('b')
    state.openTab(tab('d'))
    state.reorderTabs(2, 0)
    expect(useTabsStore.getState().tabs.map((item) => item.id)).toEqual(['b', 'c', 'd'])
    state.closeRightTabs('c')
    expect(useTabsStore.getState().tabs.map((item) => item.id)).toEqual(['b', 'c'])
    state.closeOtherTabs('c')
    state.closeAllTabs()
    expect(useTabsStore.getState().tabs.map((item) => item.id)).toEqual(['b'])
    await useViewStateStore.getState().flush()
    expect(useViewStateStore.getState().viewState.activeTabId).toBe('b')
  })
  it('关闭当前页选择相邻页，历史可恢复已关闭页，新的访问截断前进记录', async () => {
    const state = useTabsStore.getState()
    state.openTab(tab('a'))
    state.openTab(tab('b'))
    state.openTab(tab('c'))
    state.closeTab('b')
    state.goBack()
    expect(useTabsStore.getState().activeTabId).toBe('b')
    expect(useTabsStore.getState().canGoForward()).toBe(true)
    state.openTab(tab('d'))
    expect(useTabsStore.getState().canGoForward()).toBe(false)
    state.closeTab('d')
    expect(useTabsStore.getState().activeTabId).not.toBe('d')
    await useViewStateStore.getState().flush()
    const persisted = useViewStateStore.getState().viewState
    state.applyPersistedState(persisted)
    expect(useTabsStore.getState().tabs).toEqual(persisted.tabs)
  })
  it('恢复后清理无效页面，再选择可用的激活页', () => {
    const state = useTabsStore.getState()
    state.applyPersistedState({
      tabs: [tab('a'), tab('deleted')],
      activeTabId: 'deleted',
      history: [{ tabId: 'a', type: 'test-chat', dataId: 'a' }],
      historyIndex: 0
    })
    state.cleanupInvalidTabs()
    expect(useTabsStore.getState().tabs.map((item) => item.id)).toEqual(['a'])
    expect(useTabsStore.getState().activeTabId).toBe('a')
    state.activateNextTab()
    state.activatePrevTab()
    expect(useTabsStore.getState().activeTabId).toBe('a')
  })
})
