import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, emptyConversation } from '@shared/domain'
import {
  defaultViewState,
  type RuntimeEvent,
  type RuntimePort,
  type SessionSnapshot,
  type SettingsSnapshot
} from '@shared/contracts'
import { bootstrapRuntime, teardownRuntime } from './bootstrap'
import { query } from './client'
import { useSessionStore } from '../stores/sessionStore'
import { useMessagesStore } from '../stores/messagesStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useViewStateStore } from '../stores/viewStateStore'

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
} {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
let session: SessionSnapshot
let listener: (event: RuntimeEvent) => void
let flush: () => Promise<void>
let revision: number
let port: {
  query: ReturnType<typeof vi.fn>
  command: ReturnType<typeof vi.fn>
  subscribe: RuntimePort['subscribe']
  onFlush: NonNullable<RuntimePort['onFlush']>
}
const emit = (event: RuntimeEvent): void =>
  listener({ ...event, scopeId: event.scopeId ?? session.scopeId })

beforeEach(() => {
  teardownRuntime()
  useSessionStore.getState().reset()
  useSettingsStore.getState().reset()
  useViewStateStore.getState().reset()
  useMessagesStore.getState().reset()
  session = { scopeId: 'A-1', accountId: 'account', workspaceId: 'A', workspacePath: '/a' }
  revision = 0
  port = {
    query: vi.fn(async (name: string) => {
      if (name === 'session.get') return session
      if (name === 'tree.get')
        return {
          folders: [],
          pages: [
            { id: 'p', name: 'page', kind: 'page', order: 0, createdAt: 1 },
            { id: 'q', name: 'other', kind: 'page', order: 1, createdAt: 1 }
          ]
        }
      if (name === 'settings.get') return { settings: defaultSettings(), revision }
      if (name === 'viewState.get') return defaultViewState()
      if (name === 'conversation.get') return emptyConversation('p')
      if (name === 'accounts.list' || name === 'workspaces.list') return []
      return undefined
    }),
    command: vi.fn(async (name: string, payload: { settings?: unknown; mutationId?: string }) =>
      name === 'settings.replace'
        ? { settings: payload.settings, mutationId: payload.mutationId, revision: ++revision }
        : undefined
    ),
    subscribe: (callback) => {
      listener = callback
      return () => undefined
    },
    onFlush: (handler) => {
      flush = handler
      return () => undefined
    }
  }
  vi.stubGlobal('window', { runtime: port })
})
afterEach(() => {
  teardownRuntime()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('镜像竞态回归', () => {
  it('[R9,R14] 普通空消息不会被当作生成，终态移除请求占位', async () => {
    await bootstrapRuntime()
    const message = {
      id: 'empty',
      role: 'assistant' as const,
      content: '',
      createdAt: 1,
      branchIndex: 0
    }
    emit({ type: 'conversation.message', payload: { pageId: 'p', message } })
    expect(useMessagesStore.getState().live).toEqual({})
    expect(useMessagesStore.getState().isStreaming(message.id)).toBe(false)
    emit({ type: 'conversation.message', payload: { pageId: 'p', message, requestId: 'r' } })
    emit({ type: 'chat.aborted', payload: { pageId: 'p', messageId: message.id, requestId: 'r' } })
    await vi.waitFor(() => expect(useMessagesStore.getState().get('p')?.messages).toEqual([]))
    expect(useMessagesStore.getState().live).toEqual({})
  })

  it('[R13] 先订阅，再协调快照期间的事件', async () => {
    const tree = deferred<unknown>()
    const original = port.query.getMockImplementation()! as (...args: unknown[]) => unknown
    port.query.mockImplementation((name: string, ...args: unknown[]) =>
      name === 'tree.get' ? tree.promise : original(name, ...args)
    )
    const boot = bootstrapRuntime()
    await vi.waitFor(() =>
      expect(port.query.mock.calls.some(([name]) => name === 'tree.get')).toBe(true)
    )
    emit({
      type: 'conversation.message',
      payload: {
        pageId: 'p',
        message: {
          id: 'user',
          role: 'user',
          content: 'during snapshot',
          branchIndex: 0,
          createdAt: 1
        }
      }
    })
    tree.resolve({
      folders: [],
      pages: [{ id: 'p', kind: 'page', name: 'p', order: 0, createdAt: 1 }]
    })
    await boot
    expect(useMessagesStore.getState().get('p')?.messages[0].content).toBe('during snapshot')
  })

  it('[R13] A → B → A 的旧响应仍然过期；同页乱序响应只接收最后查询', async () => {
    await bootstrapRuntime()
    const old = deferred<unknown>()
    port.query.mockReturnValueOnce(old.promise)
    const pending = useMessagesStore.getState().load('p')
    const rejected = expect(pending).rejects.toMatchObject({ code: 'runtime.stale-response' })
    useSessionStore.getState().setSession({ ...session, workspaceId: 'B', scopeId: 'B-2' })
    useSessionStore.getState().setSession({ ...session, scopeId: 'A-3' })
    old.resolve({ ...emptyConversation('p'), messages: [{ id: 'stale' }] })
    await rejected
    expect(useMessagesStore.getState().get('p')).toBeUndefined()
    const first = deferred<unknown>()
    port.query.mockReturnValueOnce(first.promise)
    const early = query('conversation.get', { pageId: 'p' })
    const rejectEarly = expect(early).rejects.toMatchObject({ code: 'runtime.stale-response' })
    await query('conversation.get', { pageId: 'p' })
    first.resolve(emptyConversation('p'))
    await rejectEarly
  })

  it('[R13,R14] 旧事件不能污染新代际；多页快照保留各自的流式回答和失败回答', async () => {
    await bootstrapRuntime()
    for (const pageId of ['p', 'q']) {
      emit({
        type: 'conversation.message',
        payload: {
          pageId,
          requestId: `r-${pageId}`,
          message: {
            id: `m-${pageId}`,
            role: 'assistant',
            content: '',
            branchIndex: 0,
            createdAt: 1
          }
        }
      })
      emit({
        type: 'chat.delta',
        payload: { pageId, requestId: `r-${pageId}`, messageId: `m-${pageId}`, text: pageId }
      })
    }
    await vi.waitFor(() =>
      expect(useMessagesStore.getState().get('p')?.messages[0].content).toBe('p')
    )
    useMessagesStore.getState().setConversation(emptyConversation('p'))
    expect(useMessagesStore.getState().get('p')?.messages[0].content).toBe('p')
    expect(useMessagesStore.getState().isStreaming('m-q')).toBe(true)
    emit({
      type: 'chat.saveFailed',
      payload: {
        pageId: 'p',
        requestId: 'r-p',
        messageId: 'm-p',
        message: {
          id: 'm-p',
          role: 'assistant',
          content: 'full failed answer',
          branchIndex: 0,
          createdAt: 1
        },
        error: 'disk full'
      }
    })
    useMessagesStore.getState().setConversation(emptyConversation('p'))
    expect(useMessagesStore.getState().get('p')?.messages[0].content).toBe('full failed answer')
    session = { ...session, scopeId: 'A-2' }
    emit({ type: 'session.changed', payload: session })
    emit({
      type: 'chat.delta',
      scopeId: 'A-1',
      payload: { pageId: 'p', requestId: 'r-p', messageId: 'm-p', text: 'stale' }
    })
    await vi.waitFor(() => expect(useSettingsStore.getState().initialized).toBe(true))
    expect(useMessagesStore.getState().get('p')).toBeUndefined()
    expect(useMessagesStore.getState().live).toEqual({})
  })

  it('[R15] 旧设置回执只确认对应修改，不覆盖在途写入期间的新输入', async () => {
    await bootstrapRuntime()
    const first = deferred<SettingsSnapshot>()
    port.command.mockReturnValueOnce(first.promise)
    useSettingsStore.getState().setFontSize('large')
    const done = useSettingsStore.getState().flush()
    const sent = port.command.mock.calls[0][1]
    useSettingsStore.getState().setFontSize('small')
    const ack = { settings: sent.settings, revision: 1, mutationId: sent.mutationId }
    emit({ type: 'settings.changed', payload: ack })
    expect(useSettingsStore.getState().settings.fontSize).toBe('small')
    revision = 1
    first.resolve(ack)
    await done
    expect(port.command).toHaveBeenCalledTimes(2)
    expect(port.command.mock.calls[1][1]).toMatchObject({
      settings: { fontSize: 'small' },
      baseRevision: 1
    })
    expect(useSettingsStore.getState().settings.fontSize).toBe('small')
  })

  it('[R15] 关闭握手等待设置与展示状态，保存失败保留待提交修改', async () => {
    await bootstrapRuntime()
    const writing = deferred<SettingsSnapshot>()
    port.command.mockReturnValueOnce(writing.promise)
    useSettingsStore.getState().setFontSize('large')
    let finished = false
    const closed = flush().then(() => {
      finished = true
    })
    await Promise.resolve()
    expect(finished).toBe(false)
    const sent = port.command.mock.calls[0][1]
    writing.resolve({ settings: sent.settings, revision: 1, mutationId: sent.mutationId })
    await closed
    expect(finished).toBe(true)
    port.command.mockRejectedValueOnce(new Error('disk full'))
    useSettingsStore.getState().setFontSize('small')
    await expect(flush()).rejects.toThrow('disk full')
    expect(useSettingsStore.getState().settings.fontSize).toBe('small')
    revision = 1
    await flush()
    const view = deferred<void>()
    port.command.mockReturnValueOnce(view.promise)
    useViewStateStore.getState().patch({ activeTabId: 'tab' })
    let viewSaved = false
    const wait = flush().then(() => {
      viewSaved = true
    })
    await Promise.resolve()
    expect(viewSaved).toBe(false)
    view.resolve()
    await wait
    expect(viewSaved).toBe(true)
  })
})
