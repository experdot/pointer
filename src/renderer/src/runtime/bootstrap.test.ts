/**
 * 镜像层测试
 *
 * 用假的内核端口验证：初始拉取、事件写入各 store、命令透传。
 * 这里覆盖的是展示层与内核之间的契约，而不是界面渲染。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  Conversation,
  MessageQueue,
  Page,
  PageTreeSnapshot,
  RuntimeEvent,
  Settings,
  ViewState
} from '@renderer/types/shared'
import { defaultViewState } from '@renderer/types/shared'
import { defaultSettings } from '@shared/domain'

type Listener = (event: RuntimeEvent) => void

const listeners = new Set<Listener>()
const commands: Array<{ name: string; payload: unknown }> = []

const page: Page = {
  id: 'page-1',
  kind: 'page',
  name: '示例对话',
  order: 0,
  createdAt: 1
}

const conversation: Conversation = {
  pageId: 'page-1',
  messages: [{ id: 'm1', role: 'user', content: '你好', createdAt: 1, branchIndex: 0 }],
  topics: [],
  leafMessageId: 'm1'
}

const queue: MessageQueue = { pageId: 'page-1', items: [], paused: false }
const tree: PageTreeSnapshot = { folders: [], pages: [page] }
const settings: Settings = defaultSettings()
const viewState: ViewState = defaultViewState()
let currentViewState: ViewState = viewState
let currentTree: PageTreeSnapshot = tree
let currentAccounts: Array<{ id: string; name: string; createdAt: number }> = [
  { id: 'acc-1', name: '默认账户', createdAt: 1 }
]

function fakePort(): void {
  const runtime = {
    query: vi.fn(async (name: string) => {
      switch (name) {
        case 'session.get':
          return { accountId: 'acc-1', workspaceId: 'ws-1', workspacePath: '/tmp/ws' }
        case 'accounts.list':
          return currentAccounts
        case 'workspaces.list':
          return [{ id: 'ws-1', name: '默认工作区', type: 'default', path: '/tmp/ws' }]
        case 'tree.get':
          return currentTree
        case 'settings.get':
          return settings
        case 'viewState.get':
          return currentViewState
        case 'conversation.get':
          return conversation
        case 'queue.get':
          return queue
        default:
          throw new Error(`未预期的查询：${name}`)
      }
    }),
    command: vi.fn(async (name: string, payload: unknown) => {
      commands.push({ name, payload })
      return undefined
    }),
    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }

  ;(globalThis as unknown as { window: unknown }).window = {
    runtime,
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  }
}

function emit(event: RuntimeEvent): void {
  for (const listener of listeners) listener(event)
}

describe('展示层镜像', () => {
  beforeEach(async () => {
    listeners.clear()
    commands.length = 0
    currentViewState = viewState
    currentTree = tree
    currentAccounts = [{ id: 'acc-1', name: '默认账户', createdAt: 1 }]
    fakePort()

    const { teardownRuntime } = await import('./bootstrap')
    teardownRuntime()
  })

  it('启动后填充各 store', async () => {
    const { bootstrapRuntime } = await import('./bootstrap')
    const { useSessionStore } = await import('../stores/sessionStore')
    const { usePagesStore } = await import('../stores/pagesStore')
    const { useSettingsStore } = await import('../stores/settingsStore')
    const { useTabsStore } = await import('../stores/tabsStore')

    await bootstrapRuntime()

    expect(useSessionStore.getState().workspaceId).toBe('ws-1')
    expect(usePagesStore.getState().pages.map((item) => item.id)).toEqual(['page-1'])
    expect(useSettingsStore.getState().initialized).toBe(true)
    expect(useTabsStore.getState().initialized).toBe(true)
  })

  it('对话变更事件会重新拉取会话', async () => {
    const { bootstrapRuntime } = await import('./bootstrap')
    const { useMessagesStore } = await import('../stores/messagesStore')

    await bootstrapRuntime()
    emit({ type: 'conversation.changed', payload: { pageId: 'page-1' } })
    await Promise.resolve()
    await Promise.resolve()

    expect(useMessagesStore.getState().get('page-1')?.messages).toHaveLength(1)
  })

  it('流式增量合并写入消息内容并标记状态', async () => {
    vi.useFakeTimers()
    try {
      const { bootstrapRuntime } = await import('./bootstrap')
      const { useMessagesStore } = await import('../stores/messagesStore')

      await bootstrapRuntime()
      emit({ type: 'conversation.changed', payload: { pageId: 'page-1' } })
      await Promise.resolve()
      await Promise.resolve()

      // 回归：用户消息不应被打上生成标记（否则界面会一直闪动光标）
      emit({
        type: 'conversation.message',
        payload: {
          pageId: 'page-1',
          message: { id: 'm3', role: 'user', content: '新问题', createdAt: 3, branchIndex: 0 }
        }
      })
      expect(useMessagesStore.getState().isStreaming('m3')).toBe(false)

      emit({
        type: 'conversation.message',
        payload: {
          pageId: 'page-1',
          message: {
            id: 'm2',
            role: 'assistant',
            content: '',
            createdAt: 2,
            branchIndex: 0,
            parentMessageId: 'm1'
          }
        }
      })
      expect(useMessagesStore.getState().isStreaming('m2')).toBe(true)

      emit({
        type: 'chat.delta',
        payload: { requestId: 'r1', pageId: 'page-1', messageId: 'm2', text: '你' }
      })
      emit({
        type: 'chat.delta',
        payload: { requestId: 'r1', pageId: 'page-1', messageId: 'm2', text: '好' }
      })
      emit({
        type: 'chat.reasoning',
        payload: { requestId: 'r1', pageId: 'page-1', messageId: 'm2', text: '思考' }
      })

      // 增量在缓冲区间内合并，到点后一次性写入
      vi.advanceTimersByTime(100)

      const store = useMessagesStore.getState()
      const message = store.get('page-1')?.messages.find((item) => item.id === 'm2')
      expect(message?.content).toBe('你好')
      expect(message?.reasoning).toBe('思考')
      expect(store.isStreaming('m2')).toBe(true)

      emit({
        type: 'chat.completed',
        payload: { requestId: 'r1', pageId: 'page-1', messageId: 'm2' }
      })
      expect(useMessagesStore.getState().isStreaming('m2')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('会话被权威数据替换时丢弃已消失消息的生成标记', async () => {
    const { bootstrapRuntime } = await import('./bootstrap')
    const { useMessagesStore } = await import('../stores/messagesStore')

    await bootstrapRuntime()
    useMessagesStore.getState().setStreaming('ghost', true)
    useMessagesStore.getState().setConversation(conversation)

    expect(useMessagesStore.getState().isStreaming('ghost')).toBe(false)
  })

  it('同一时间窗内的分片合并为一次写入且不丢字', async () => {
    vi.useFakeTimers()
    try {
      const { bootstrapRuntime } = await import('./bootstrap')
      const { useMessagesStore } = await import('../stores/messagesStore')

      await bootstrapRuntime()
      emit({ type: 'conversation.changed', payload: { pageId: 'page-1' } })
      await Promise.resolve()
      await Promise.resolve()

      emit({
        type: 'conversation.message',
        payload: {
          pageId: 'page-1',
          message: {
            id: 'm9',
            role: 'assistant',
            content: '',
            createdAt: 9,
            branchIndex: 0,
            parentMessageId: 'm1'
          }
        }
      })

      const chunks = Array.from({ length: 200 }, (_, index) => `字${index}`)
      for (const text of chunks) {
        emit({
          type: 'chat.delta',
          payload: { requestId: 'r9', pageId: 'page-1', messageId: 'm9', text }
        })
      }

      const contentOf = (): string =>
        useMessagesStore
          .getState()
          .get('page-1')
          ?.messages.find((item) => item.id === 'm9')?.content ?? ''

      // 缓冲期内不写 store，避免每个分片触发一次 Markdown 重解析
      expect(contentOf()).toBe('')

      vi.advanceTimersByTime(100)
      expect(contentOf()).toBe(chunks.join(''))
    } finally {
      vi.useRealTimers()
    }
  })

  it('树变更事件刷新页面与文件夹', async () => {
    const { bootstrapRuntime } = await import('./bootstrap')
    const { usePagesStore } = await import('../stores/pagesStore')
    const { useFoldersStore } = await import('../stores/foldersStore')

    await bootstrapRuntime()
    emit({
      type: 'tree.changed',
      payload: {
        folders: [{ id: 'f1', kind: 'folder', name: '分组', order: 0, createdAt: 1 }],
        pages: [page, { ...page, id: 'page-2', name: '第二个' }]
      }
    })

    expect(usePagesStore.getState().pages).toHaveLength(2)
    expect(useFoldersStore.getState().folders[0].expanded).toBe(false)
  })

  it('命令通过内核端口发出', async () => {
    const { bootstrapRuntime } = await import('./bootstrap')
    const { useMessagesStore } = await import('../stores/messagesStore')

    await bootstrapRuntime()
    await useMessagesStore.getState().updateMessage('page-1', 'm1', { starred: true })
    await useMessagesStore.getState().deleteMessage('page-1', 'm1')

    expect(commands.map((entry) => entry.name)).toEqual([
      'conversation.updateMessage',
      'conversation.deleteMessage'
    ])
    expect(commands[0].payload).toMatchObject({ pageId: 'page-1', messageId: 'm1' })
  })

  it('页面改名后同步页签标题', async () => {
    const { bootstrapRuntime } = await import('./bootstrap')
    const pagesService = await import('../services/pagesService')
    const { useTabsStore } = await import('../stores/tabsStore')

    await bootstrapRuntime()
    await pagesService.openPage('page-1')
    expect(useTabsStore.getState().tabs.map((tab) => tab.title)).toContain('示例对话')

    emit({
      type: 'tree.changed',
      payload: { folders: [], pages: [{ ...page, name: '改过名的对话' }] }
    })

    expect(useTabsStore.getState().tabs.map((tab) => tab.title)).toContain('改过名的对话')
  })

  it('页面被删除后关闭页签并清理缓存', async () => {
    const { bootstrapRuntime } = await import('./bootstrap')
    const pagesService = await import('../services/pagesService')
    const { useTabsStore } = await import('../stores/tabsStore')
    const { useMessagesStore } = await import('../stores/messagesStore')

    await bootstrapRuntime()
    await pagesService.openPage('page-1')
    await useMessagesStore.getState().load('page-1')
    expect(useMessagesStore.getState().has('page-1')).toBe(true)

    emit({ type: 'tree.changed', payload: { folders: [], pages: [] } })

    expect(useTabsStore.getState().tabs.some((tab) => tab.dataId === 'page-1')).toBe(false)
    expect(useMessagesStore.getState().has('page-1')).toBe(false)
  })

  it('页面刚创建、镜像未刷新时 openPage 会先刷新再打开', async () => {
    const { bootstrapRuntime } = await import('./bootstrap')
    const pagesService = await import('../services/pagesService')
    const { usePagesStore } = await import('../stores/pagesStore')
    const { useTabsStore } = await import('../stores/tabsStore')

    await bootstrapRuntime()
    // 模拟"内核已创建、tree.changed 还未到达"
    usePagesStore.setState({ pages: [] })

    await pagesService.openPage('page-1')

    const tabs = useTabsStore.getState().tabs
    expect(tabs.filter((tab) => tab.dataId === 'page-1')).toHaveLength(1)

    // 再次打开应复用同一个页签
    await pagesService.openPage('page-1')
    expect(useTabsStore.getState().tabs.filter((tab) => tab.dataId === 'page-1')).toHaveLength(1)
  })

  it('折叠多条消息只发一次批量命令', async () => {
    const { bootstrapRuntime } = await import('./bootstrap')
    const messagesService = await import('../services/messagesService')

    await bootstrapRuntime()
    await messagesService.setMessagesCollapsed('page-1', ['m1', 'm2', 'm3'], true)

    expect(commands.map((entry) => entry.name)).toEqual(['conversation.updateMessages'])
    expect(commands[0].payload).toMatchObject({
      pageId: 'page-1',
      messageIds: ['m1', 'm2', 'm3'],
      patch: { collapsed: true }
    })
  })

  it('切换工作区时按目标工作区恢复页签，不写回旧页签', async () => {
    const { bootstrapRuntime } = await import('./bootstrap')
    const pagesService = await import('../services/pagesService')
    const { useTabsStore } = await import('../stores/tabsStore')

    await bootstrapRuntime()
    await pagesService.openPage('page-1')
    commands.length = 0

    // 目标工作区只有一个页签（另一个页面）
    currentViewState = {
      ...viewState,
      tabs: [{ id: 'tab-b', type: 'chat', title: '另一个页面', dataId: 'page-2' }],
      activeTabId: 'tab-b',
      history: [{ tabId: 'tab-b', type: 'chat', dataId: 'page-2' }],
      historyIndex: 0
    }
    currentTree = {
      folders: [],
      pages: [{ ...page, id: 'page-2', name: '另一个页面' }]
    }

    emit({
      type: 'session.changed',
      payload: { accountId: 'acc-1', workspaceId: 'ws-2', workspacePath: '/tmp/ws2' }
    })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    const tabs = useTabsStore.getState().tabs
    expect(tabs.map((tab) => tab.dataId)).toEqual(['page-2'])

    const replacements = commands.filter((entry) => entry.name === 'viewState.replace')
    for (const replacement of replacements) {
      const state = (replacement.payload as { viewState: ViewState }).viewState
      expect(state.tabs.every((tab) => tab.dataId === 'page-2')).toBe(true)
    }
  })

  it('切换账户后刷新账户列表与当前账户', async () => {
    const { bootstrapRuntime } = await import('./bootstrap')
    const { useAccountStore } = await import('../stores/accountStore')

    await bootstrapRuntime()
    expect(useAccountStore.getState().currentAccountId).toBe('acc-1')

    currentAccounts = [
      { id: 'acc-1', name: '默认账户', createdAt: 1 },
      { id: 'acc-2', name: '新账户', createdAt: 2 }
    ]
    emit({
      type: 'session.changed',
      payload: { accountId: 'acc-2', workspaceId: 'ws-2', workspacePath: '/tmp/ws2' }
    })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    const accountStore = useAccountStore.getState()
    expect(accountStore.currentAccountId).toBe('acc-2')
    expect(accountStore.accounts.map((account) => account.name)).toEqual(['默认账户', '新账户'])
  })

  it('配置入口请求设置内页后可被消费，且不会重复消费', async () => {
    const { openSettings, consumePendingSettingsTab } = await import('../services/settingsService')

    openSettings('llm')
    expect(consumePendingSettingsTab()).toBe('llm')
    expect(consumePendingSettingsTab()).toBeUndefined()

    openSettings('model')
    expect(consumePendingSettingsTab()).toBe('model')
  })

  it('设置写入按去抖合并，flush 立即提交', async () => {
    vi.useFakeTimers()
    try {
      const { bootstrapRuntime } = await import('./bootstrap')
      const { useSettingsStore } = await import('../stores/settingsStore')

      await bootstrapRuntime()
      commands.length = 0

      // 连续输入只应产生一次落盘
      useSettingsStore.getState().setFontSize('large')
      useSettingsStore.getState().setFontSize('small')
      expect(commands).toHaveLength(0)

      vi.advanceTimersByTime(400)
      expect(commands.map((entry) => entry.name)).toEqual(['settings.replace'])
      const written = commands[0].payload as { settings: Settings }
      expect(written.settings.fontSize).toBe('small')

      // flush 立即提交
      commands.length = 0
      useSettingsStore.getState().setFontSize('large')
      useSettingsStore.getState().flush()
      expect(commands.map((entry) => entry.name)).toEqual(['settings.replace'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('未指定参照时新建对话落在当前打开会话所在文件夹的最前面', async () => {
    currentTree = {
      folders: [{ id: 'folder-1', kind: 'folder', name: '分组', order: 0, createdAt: 1 }],
      pages: [{ ...page, parentFolderId: 'folder-1' }]
    }

    const { bootstrapRuntime } = await import('./bootstrap')
    const pagesService = await import('../services/pagesService')

    await bootstrapRuntime()
    await pagesService.openPage('page-1')
    commands.length = 0

    await pagesService.createPage({ name: '新对话' })

    expect(commands.map((entry) => entry.name)).toEqual(['page.create'])
    expect(commands[0].payload).toMatchObject({ name: '新对话', parentFolderId: 'folder-1' })
  })
})
