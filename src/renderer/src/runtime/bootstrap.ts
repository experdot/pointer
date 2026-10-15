/**
 * 内核镜像装配
 *
 * 把内核事件写入各 store，使界面始终显示内核中的权威状态。
 * 所有写操作都通过 store/service 发出命令，内核回推事件后界面才更新。
 */

import type { ChatMessage, Conversation, MessageQueue, Page, Settings } from '@shared/domain'
import type {
  PageTreeSnapshot,
  RuntimeEvent,
  SessionSnapshot,
  UpdateStatus,
  ViewState
} from '@shared/contracts'
import { query, subscribe } from './client'
import { useAccountStore } from '../stores/accountStore'
import { useChatUIStore } from '../stores/chatUIStore'
import { useFoldersStore } from '../stores/foldersStore'
import { useGlobalSearchStore } from '../stores/globalSearchStore'
import { useLayoutStore } from '../stores/layoutStore'
import { useMessageQueueStore } from '../stores/messageQueueStore'
import { useMessagesStore } from '../stores/messagesStore'
import { useNavigationStore } from '../stores/navigationStore'
import { usePagesStore } from '../stores/pagesStore'
import { useSessionStore } from '../stores/sessionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useTabsStore } from '../stores/tabsStore'
import { useUpdateStore } from '../stores/updateStore'
import { useViewStateStore } from '../stores/viewStateStore'
import { useWorkspaceStore } from '../stores/workspaceStore'

let started = false
let unsubscribe: (() => void) | null = null

/**
 * 流式增量缓冲
 *
 * 供应商按分片推送；一帧一个分片会让 Markdown 重解析把渲染线程压满，
 * 表现就是停止按钮与新建节点都不响应。这里把增量合并到固定节奏再写入 store。
 */
const DELTA_FLUSH_INTERVAL_MS = 80
/** 长回答的每次重渲染更贵，适当放慢刷新节奏 */
const DELTA_FLUSH_SLOW_MS = 200
const LONG_MESSAGE_THRESHOLD = 3000
const CLOSED_MESSAGE_LIMIT = 500

interface PendingDelta {
  pageId: string
  content: string
  reasoning: string
  /** 该消息当前累计长度，用于选择刷新节奏 */
  totalLength: number
}

const pendingDeltas = new Map<string, PendingDelta>()
/** 已结束生成的消息：忽略迟到的分片，避免与权威内容重复 */
const closedMessages = new Set<string>()
let deltaTimer: ReturnType<typeof setTimeout> | null = null

function bufferDelta(
  pageId: string,
  messageId: string,
  field: 'content' | 'reasoning',
  text: string
): void {
  if (closedMessages.has(messageId)) return

  const entry = pendingDeltas.get(messageId) ?? {
    pageId,
    content: '',
    reasoning: '',
    totalLength: lengthOfMessage(pageId, messageId)
  }
  if (field === 'content') {
    entry.content += text
  } else {
    entry.reasoning += text
  }
  entry.totalLength += text.length
  pendingDeltas.set(messageId, entry)

  if (!deltaTimer) {
    const delay =
      entry.totalLength > LONG_MESSAGE_THRESHOLD ? DELTA_FLUSH_SLOW_MS : DELTA_FLUSH_INTERVAL_MS
    deltaTimer = setTimeout(flushDeltas, delay)
  }
}

/** 已落库内容长度，用于判断是否进入长回答的慢速刷新 */
function lengthOfMessage(pageId: string, messageId: string): number {
  const conversation = useMessagesStore.getState().get(pageId)
  const message = conversation?.messages.find((item) => item.id === messageId)
  return (message?.content.length ?? 0) + (message?.reasoning?.length ?? 0)
}

function flushDeltas(): void {
  if (deltaTimer) {
    clearTimeout(deltaTimer)
    deltaTimer = null
  }
  if (pendingDeltas.size === 0) return

  const entries = [...pendingDeltas.entries()].map(([messageId, value]) => ({
    messageId,
    pageId: value.pageId,
    content: value.content,
    reasoning: value.reasoning
  }))
  pendingDeltas.clear()
  useMessagesStore.getState().applyDeltas(entries)
}

/** 生成结束时先落地缓冲，再让权威内容覆盖 */
function closeMessage(messageId: string): void {
  flushDeltas()
  closedMessages.add(messageId)
  if (closedMessages.size > CLOSED_MESSAGE_LIMIT) {
    const oldest = closedMessages.values().next().value
    if (oldest !== undefined) closedMessages.delete(oldest)
  }
}

function applyTree(tree: PageTreeSnapshot): void {
  usePagesStore.setState({ pages: tree.pages, initialized: true })
  useFoldersStore.getState().setFolders(tree.folders)
  reconcileTabs(tree.pages)
  evictVanishedCaches(tree.pages)
}

/**
 * 页面树变化后对齐页签：关闭已消失页面的页签，同步改名后的标题
 *
 * 迁移前这一步由 pagesService 在删除/改名时手工维护；现在统一由镜像处理，
 * 外部删除页面文件（监听到的改动）也能被覆盖。
 */
function reconcileTabs(pages: Page[]): void {
  const names = new Map(pages.map((page) => [page.id, page.name]))
  let needsCleanup = false
  let needsTitleSync = false

  for (const tab of useTabsStore.getState().tabs) {
    if (tab.type !== 'chat' || !tab.dataId) continue
    const name = names.get(tab.dataId)
    if (!name) {
      needsCleanup = true
      continue
    }
    if (name !== tab.title) needsTitleSync = true
  }

  if (needsCleanup) {
    // 直接关闭指向已消失页面的页签，不依赖页签注册表
    const tabsStore = useTabsStore.getState()
    for (const tab of tabsStore.tabs) {
      if (tab.type === 'chat' && tab.dataId && !names.has(tab.dataId)) {
        tabsStore.closeTab(tab.id)
      }
    }
  }
  if (needsTitleSync) useTabsStore.getState().syncPageTitles(names)
}

/** 页面被删除后清掉对应的会话与队列缓存 */
function evictVanishedCaches(pages: Page[]): void {
  const alive = new Set(pages.map((page) => page.id))
  const messagesStore = useMessagesStore.getState()

  for (const pageId of Object.keys(messagesStore.cache)) {
    if (!alive.has(pageId)) messagesStore.evict(pageId)
  }

  const queueStore = useMessageQueueStore.getState()
  for (const pageId of Object.keys(queueStore.cache)) {
    if (!alive.has(pageId)) queueStore.evict(pageId)
  }
}

function applyViewState(viewState: ViewState): void {
  useViewStateStore.getState().setViewState(viewState)
  useLayoutStore.setState({
    sidebarWidth: viewState.layout.sidebarWidth,
    sidebarVisible: viewState.layout.sidebarVisible,
    activePanel: viewState.layout.activePanel,
    initialized: true
  })
  useTabsStore.getState().applyPersistedState({
    tabs: viewState.tabs,
    activeTabId: viewState.activeTabId,
    history: viewState.history,
    historyIndex: viewState.historyIndex
  })
}

async function refreshWorkspaceScope(): Promise<void> {
  const session = useSessionStore.getState()
  const [tree, settings, viewState, workspaces, accounts] = await Promise.all([
    query('tree.get', undefined),
    query('settings.get', undefined),
    query('viewState.get', undefined),
    query('workspaces.list', undefined),
    query('accounts.list', undefined)
  ])

  // 账户列表与"当前账户/当前工作区"必须跟着会话一起刷新，
  // 否则切换账户后头像、名称与工作区卡片仍停在旧账户
  useAccountStore.setState({
    accounts,
    currentAccountId: session.accountId,
    initialized: true
  })
  useSettingsStore.setState({ settings, initialized: true })
  // 先恢复目标工作区的展示层状态，再对齐页面树：
  // 否则清理过期页签时会把旧工作区的页签写进新工作区的 view-state
  applyViewState(viewState)
  applyTree(tree)
  useWorkspaceStore.setState({
    workspaces,
    currentWorkspaceId: session.workspaceId,
    currentWorkspace: workspaces.find((item) => item.id === session.workspaceId) ?? null,
    initialized: true
  })
}

async function loadConversation(pageId: string): Promise<void> {
  try {
    const conversation = await query('conversation.get', { pageId })
    useMessagesStore.getState().setConversation(conversation)
  } catch (error) {
    console.warn('[mirror] 读取会话失败：', error)
  }
}

async function loadQueue(pageId: string): Promise<void> {
  try {
    const queue = await query('queue.get', { pageId })
    useMessageQueueStore.getState().setQueue(queue)
  } catch (error) {
    console.warn('[mirror] 读取消息队列失败：', error)
  }
}

function handleEvent(event: RuntimeEvent): void {
  switch (event.type) {
    case 'accounts.changed':
      useAccountStore.setState({ accounts: event.payload, initialized: true })
      break

    case 'session.changed':
      useSessionStore.getState().setSession(event.payload as SessionSnapshot)
      void refreshWorkspaceScope()
      useMessagesStore.getState().reset()
      useMessageQueueStore.getState().reset()
      // 与迁移前一致：切换账户/工作区后清空易失状态，避免上个上下文的内容泄漏
      useChatUIStore.getState().reset()
      useGlobalSearchStore.getState().reset()
      useNavigationStore.getState().reset()
      break

    case 'tree.changed':
      applyTree(event.payload as PageTreeSnapshot)
      break

    case 'page.changed':
      usePagesStore.getState().upsert(event.payload.page)
      break

    case 'conversation.changed':
      void loadConversation(event.payload.pageId)
      break

    case 'conversation.message':
      useMessagesStore.getState().upsertMessage(event.payload.pageId, event.payload.message)
      break

    case 'chat.delta':
      bufferDelta(event.payload.pageId, event.payload.messageId, 'content', event.payload.text)
      break

    case 'chat.reasoning':
      bufferDelta(event.payload.pageId, event.payload.messageId, 'reasoning', event.payload.text)
      break

    case 'chat.completed':
    case 'chat.aborted':
      closeMessage(event.payload.messageId)
      useMessagesStore.getState().setStreaming(event.payload.messageId, false)
      void loadConversation(event.payload.pageId)
      break

    case 'chat.failed':
      closeMessage(event.payload.messageId)
      useMessagesStore.getState().setStreaming(event.payload.messageId, false)
      void loadConversation(event.payload.pageId)
      break

    case 'queue.changed':
      void loadQueue(event.payload.pageId)
      break

    case 'settings.changed':
      useSettingsStore.setState({ settings: event.payload as Settings, initialized: true })
      break

    case 'workspace.externalChange':
      for (const pageId of event.payload.pageIds) void loadConversation(pageId)
      break

    case 'app.updateStatus':
      useUpdateStore.getState().applyStatus(event.payload as UpdateStatus)
      break
  }
}

export async function bootstrapRuntime(): Promise<void> {
  if (started) return
  started = true

  const [session, accounts, workspaces] = await Promise.all([
    query('session.get', undefined),
    query('accounts.list', undefined),
    query('workspaces.list', undefined)
  ])

  useSessionStore.getState().setSession(session)
  useAccountStore.setState({
    accounts,
    currentAccountId: session.accountId,
    initialized: true
  })
  useWorkspaceStore.setState({
    workspaces,
    currentWorkspaceId: session.workspaceId,
    currentWorkspace: workspaces.find((item) => item.id === session.workspaceId) ?? null,
    initialized: true
  })

  await refreshWorkspaceScope()
  unsubscribe = subscribe(handleEvent)

  // 关闭窗口前把去抖中的设置写盘
  window.addEventListener('beforeunload', () => {
    useSettingsStore.getState().flush()
  })
}

export function teardownRuntime(): void {
  flushDeltas()
  pendingDeltas.clear()
  closedMessages.clear()
  unsubscribe?.()
  unsubscribe = null
  started = false
}

export async function refreshTree(): Promise<void> {
  applyTree(await query('tree.get', undefined))
}

export type { ChatMessage, Conversation, MessageQueue }
