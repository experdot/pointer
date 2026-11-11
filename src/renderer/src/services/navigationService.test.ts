import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Conversation } from '@shared/domain'
import { navigateToMessage } from './navigationService'
import { useMessagesStore } from '../stores/messagesStore'
import { useNavigationStore } from '../stores/navigationStore'
import { useSessionStore } from '../stores/sessionStore'
import { command } from '../runtime/client'
import { deferred } from '../../../../tests/helpers/deferred'

vi.mock('../runtime/client', () => ({ command: vi.fn(), query: vi.fn() }))
vi.mock('./pagesService', () => ({ openPage: vi.fn() }))
const record = (): Conversation => ({
  pageId: 'p',
  messages: [
    { id: 'u', role: 'user', content: '问题', branchIndex: 0, createdAt: 1 },
    {
      id: 'a',
      role: 'assistant',
      content: '主分支',
      parentMessageId: 'u',
      branchIndex: 0,
      createdAt: 2
    },
    {
      id: 'b',
      role: 'assistant',
      content: '另一分支',
      parentMessageId: 'u',
      branchIndex: 1,
      createdAt: 3
    }
  ],
  leafMessageId: 'a',
  topics: [{ id: 't', name: '折叠话题', startMessageId: 'u', collapsed: true }]
})
beforeEach(() => {
  useMessagesStore.getState().reset()
  useNavigationStore.getState().reset()
  useSessionStore.getState().reset()
  useMessagesStore.getState().setConversation(record())
  vi.mocked(command)
    .mockReset()
    .mockImplementation(async (name, input) => {
      const payload = input as { pageId: string; messageId?: string; topicId?: string }
      const current = useMessagesStore.getState().get(payload.pageId)!
      if (name === 'conversation.setLeaf')
        useMessagesStore
          .getState()
          .setConversation({ ...current, leafMessageId: payload.messageId })
      if (name === 'topic.update')
        useMessagesStore.getState().setConversation({
          ...current,
          topics: current.topics.map((topic) => ({ ...topic, collapsed: false }))
        })
    })
})
describe('搜索结果分支与话题导航', () => {
  it('定位另一分支时先切叶节点、展开话题，再发布滚动请求', async () => {
    await navigateToMessage({ pageId: 'p', messageId: 'b' })
    expect(vi.mocked(command).mock.calls.map(([name]) => name)).toEqual([
      'conversation.setLeaf',
      'topic.update'
    ])
    expect(useMessagesStore.getState().get('p')?.leafMessageId).toBe('b')
    expect(useNavigationStore.getState().pendingNavigation).toMatchObject({
      pageId: 'p',
      messageId: 'b'
    })
  })
  it('当前路径祖先不重置分支，失效消息不切换或滚动', async () => {
    await navigateToMessage({ pageId: 'p', messageId: 'u', requestScroll: false })
    expect(command).not.toHaveBeenCalledWith('conversation.setLeaf', expect.anything())
    expect(useMessagesStore.getState().get('p')?.leafMessageId).toBe('a')
    expect(useNavigationStore.getState().pendingNavigation).toBeNull()
    vi.mocked(command).mockClear()
    await navigateToMessage({ pageId: 'p', messageId: 'deleted' })
    expect(command).not.toHaveBeenCalled()
  })
  it('较慢的旧导航及会话切换后的结果不能覆盖当前目标', async () => {
    const old = deferred<Conversation>()
    vi.spyOn(useMessagesStore.getState(), 'load')
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue(record())
    const pending = navigateToMessage({ pageId: 'p', messageId: 'b' })
    await navigateToMessage({ pageId: 'p', messageId: 'a' })
    old.resolve(record())
    await pending
    expect(useNavigationStore.getState().pendingNavigation?.messageId).toBe('a')
    const stale = deferred<Conversation>()
    vi.mocked(useMessagesStore.getState().load).mockReturnValueOnce(stale.promise)
    const switching = navigateToMessage({ pageId: 'p', messageId: 'b' })
    useSessionStore.setState({ scopeId: 'next-workspace' })
    stale.resolve(record())
    await switching
    expect(useNavigationStore.getState().pendingNavigation?.messageId).toBe('a')
  })
})
