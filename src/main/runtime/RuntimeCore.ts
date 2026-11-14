/**
 * 内核装配与会话管理
 *
 * 对外只暴露三类操作：query / command / 事件订阅。
 * 会话切换（账户、工作区）由内核完成资源的打开与关闭，展示层只需重新订阅并按作用域丢弃缓存。
 */

import { watch, type FSWatcher } from 'node:fs'
import type { RuntimeEventName, RuntimeEventPayload } from '@shared/contracts'
import { randomUUID } from 'node:crypto'
import type { ChatMessage, Conversation, Settings, Workspace } from '@shared/domain'
import {
  appendMessage,
  defaultSettings,
  createTopic,
  deleteMessage,
  deleteTopic,
  parseImport,
  setLeaf,
  setSelected,
  switchBranchToMessage,
  updateMessage,
  updateMessages,
  updateTopic
} from '@shared/domain'
import type {
  AttachmentContent,
  ImportResult,
  ImportSource,
  ModelCatalog,
  RuntimeCommandName,
  RuntimeCommandPayload,
  RuntimeCommandResult,
  RuntimeQueryName,
  RuntimeQueryPayload,
  RuntimeQueryResult,
  RuntimeEvent,
  SessionSnapshot,
  UpdateCheckResult,
  UpdateStatus
} from '@shared/contracts'
import { RuntimeError, defaultViewState } from '@shared/contracts'
import { SerialExecutor } from './SerialExecutor'
import { AccountStore } from './AccountStore'
import { ChatEngine } from './ChatEngine'
import { IndexDb } from './IndexDb'
import { PathResolver } from './paths'
import { QueueStore } from './QueueStore'
import { SearchService } from './SearchService'
import { SettingsStore } from './SettingsStore'
import { ViewStateStore } from './ViewStateStore'
import { WorkspaceRegistry } from './WorkspaceRegistry'
import { WorkspaceLease } from './WorkspaceLease'
import { WorkspaceStore } from './WorkspaceStore'
import { listModels, testConnection as testProviderConnection } from './providers'
import { isWorkspaceFileChange, readBinary } from './fsx'
import { restoreBackup } from './BackupRestorer'

type QueryHandlers = {
  [K in RuntimeQueryName]: (payload: RuntimeQueryPayload<K>) => Promise<RuntimeQueryResult<K>>
}
type CommandHandlers = {
  [K in RuntimeCommandName]: (payload: RuntimeCommandPayload<K>) => Promise<RuntimeCommandResult<K>>
}

const LIFECYCLE_COMMANDS = new Set<RuntimeCommandName>([
  'session.selectAccount',
  'session.selectWorkspace',
  'account.create',
  'account.update',
  'account.delete',
  'workspace.create',
  'workspace.delete',
  'workspace.rename',
  'workspace.repairPath',
  'backup.restore',
  'data.reset'
])
const WORKSPACE_COMMANDS = new Set<RuntimeCommandName>([
  'tree.move',
  'page.create',
  'page.update',
  'page.delete',
  'folder.create',
  'folder.update',
  'folder.delete',
  'folder.clear',
  'conversation.append',
  'conversation.replace',
  'conversation.updateMessage',
  'conversation.updateMessages',
  'conversation.deleteMessage',
  'conversation.setLeaf',
  'conversation.setSelected',
  'topic.create',
  'topic.update',
  'topic.delete',
  'queue.add',
  'queue.update',
  'queue.remove',
  'queue.clear',
  'queue.setPaused',
  'viewState.replace',
  'attachment.import',
  'attachment.delete',
  'library.import'
])
const WORKSPACE_QUERIES = new Set<RuntimeQueryName>([
  'tree.get',
  'conversation.get',
  'queue.get',
  'attachment.read',
  'viewState.get'
])
const FLUSH_COMMANDS = new Set<RuntimeCommandName>([
  'settings.replace',
  'viewState.replace',
  'chat.stop',
  'chat.retrySave'
])

export interface RuntimeHost {
  getVersion(): string
  saveFile(options: RuntimeCommandPayload<'dialog.saveFile'>): Promise<{ savedPath?: string }>
  openTextFile(options?: {
    filters?: Array<{ name: string; extensions: string[] }>
  }): Promise<{ name: string; content: string } | null>
  pickDirectory(title?: string): Promise<string | null>
  pickImages(options: {
    multiple?: boolean
  }): Promise<Array<{ name: string; mimeType: string; size: number; dataBase64: string }>>
  openInFileManager(targetPath: string): Promise<void>
}

export interface RuntimeUpdater {
  check(): Promise<UpdateCheckResult>
  download(): Promise<void>
  quitAndInstall(): void
}

export interface RuntimeCoreOptions {
  appDataPath: string
  host: RuntimeHost
}

export class RuntimeCore {
  private scopeId: string | null = null
  private readonly lifecycle = new SerialExecutor()
  private transitioning = false
  private closingRequested = false
  private flushRenderer: (() => Promise<void>) | null = null
  private readonly paths: PathResolver
  private readonly accounts: AccountStore
  private readonly chat: ChatEngine
  private updater: RuntimeUpdater | null = null

  private settingsStore: SettingsStore | null = null
  private registry: WorkspaceRegistry | null = null
  private workspace: WorkspaceStore | null = null
  private workspaceLease: WorkspaceLease | null = null
  private index: IndexDb | null = null
  private viewState: ViewStateStore | null = null
  private queues: QueueStore | null = null
  private search: SearchService | null = null

  private watcher: FSWatcher | null = null
  private watcherTimer: NodeJS.Timeout | null = null
  private updateStatus: UpdateStatus = { state: 'idle' }
  private readonly listeners = new Set<(event: RuntimeEvent) => void>()

  constructor(private readonly options: RuntimeCoreOptions) {
    this.paths = new PathResolver(options.appDataPath)
    this.accounts = new AccountStore(this.paths)
    this.chat = new ChatEngine({
      workspace: () => this.workspace,
      settings: () => this.settingsStore,
      queues: () => this.queues,
      scope: () => this.scopeId,
      emit: (event) => this.dispatchEvent(event)
    })
  }

  // ==================== 生命周期 ====================

  async init(): Promise<void> {
    await this.accounts.load()
    const account = await this.accounts.ensureDefaultAccount()
    await this.openAccount(account.id)
  }

  async dispose(): Promise<void> {
    await this.prepareClose()
    await this.closeWorkspace()
    this.listeners.clear()
  }

  setFlushHandler(handler: () => Promise<void>): void {
    this.flushRenderer = handler
  }

  resume(): void {
    this.closingRequested = false
    this.transitioning = false
    this.chat.resume()
  }
  retrySaves(): Promise<void> {
    return this.chat.retryAllSaves()
  }

  async prepareClose(): Promise<void> {
    this.closingRequested = true
    try {
      await this.lifecycle.run(() => this.quiesce())
    } catch (error) {
      this.closingRequested = false
      throw error
    }
  }

  private async quiesce(): Promise<void> {
    this.transitioning = true
    this.chat.suspend()
    try {
      await this.chat.abortAll()
      await this.flushRenderer?.()
      await this.workspace?.idle()
      // 准入任务可能正在保存用户消息；待其退出写队列后再收拢一次新登记的请求。
      await this.chat.abortAll()
      await this.settingsStore?.idle()
      this.chat.assertSaved()
    } catch (error) {
      this.transitioning = false
      this.chat.resume()
      throw error
    }
  }

  private assertScope(scopeId?: string | null): void {
    if (scopeId !== undefined && scopeId !== this.scopeId) {
      throw new RuntimeError('runtime.stale-scope', '工作区已切换，请重试')
    }
  }

  setUpdater(updater: RuntimeUpdater): void {
    this.updater = updater
  }

  getScopeId(): string | null {
    return this.scopeId
  }

  subscribe(listener: (event: RuntimeEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  setUpdateStatus(status: UpdateStatus): void {
    this.updateStatus = status
    this.emit('app.updateStatus', status)
  }

  // ==================== 查询 ====================

  async query<K extends RuntimeQueryName>(
    name: K,
    payload: RuntimeQueryPayload<K>,
    scopeId?: string | null
  ): Promise<RuntimeQueryResult<K>> {
    if (name !== 'session.get') this.assertScope(scopeId)
    const workspace = this.workspace
    const read = async (): Promise<RuntimeQueryResult<K>> => {
      if (name !== 'session.get') this.assertScope(scopeId)
      const result = await this.executeQuery(name, payload)
      if (name !== 'session.get') this.assertScope(scopeId)
      return result
    }
    return workspace && WORKSPACE_QUERIES.has(name) ? workspace.read(read) : read()
  }

  private readonly queryHandlers: QueryHandlers = {
    'session.get': async () => {
      return this.snapshot()
    },
    'accounts.list': async () => {
      return this.accounts.list()
    },
    'workspaces.list': async () => {
      return this.requireRegistry().list()
    },
    'tree.get': async () => {
      return this.requireWorkspace().getTree()
    },
    'conversation.get': async (input) => {
      return this.requireWorkspace().readConversation(readPageId(input))
    },
    'settings.get': async () => {
      return this.requireSettings().snapshot()
    },
    'viewState.get': async () => {
      return this.requireViewState().get()
    },
    'queue.get': async (input) => {
      return this.requireQueues().get(readPageId(input))
    },
    'search.workspace': async (input) => {
      return this.requireSearch().search(input.query, input.options)
    },
    'search.messages': async (input) => {
      return this.requireSearch().messages(input)
    },
    'ai.models': async (input) => {
      return this.listModels(readLlmId(input))
    },
    'ai.test': async (input) => {
      return this.testConnection(readLlmId(input))
    },
    'attachment.read': async (input) => {
      return this.readAttachment(input.relativePath)
    },
    'app.version': async () => {
      return this.options.host.getVersion()
    },
    'app.updateStatus': async () => {
      return this.updateStatus
    }
  }

  private executeQuery<K extends RuntimeQueryName>(
    name: K,
    payload: RuntimeQueryPayload<K>
  ): Promise<RuntimeQueryResult<K>> {
    if (!Object.hasOwn(this.queryHandlers, name))
      throw new RuntimeError('runtime.unknown-query', `未知查询：${name}`)
    // 分发表中的每个处理器分别校验参数和返回值，分发时保持关联。
    const handler = this.queryHandlers[name] as (
      input: RuntimeQueryPayload<K>
    ) => Promise<RuntimeQueryResult<K>>
    return handler(payload)
  }

  // ==================== 命令 ====================

  async command<K extends RuntimeCommandName>(
    name: K,
    payload: RuntimeCommandPayload<K>,
    scopeId?: string | null
  ): Promise<RuntimeCommandResult<K>> {
    this.assertScope(scopeId)
    if (this.closingRequested && !FLUSH_COMMANDS.has(name))
      throw new RuntimeError('runtime.closing', '正在保存并关闭当前工作区')
    if (LIFECYCLE_COMMANDS.has(name))
      return this.lifecycle.run(async () => {
        this.assertScope(scopeId)
        if (this.closingRequested)
          throw new RuntimeError('runtime.closing', '正在保存并关闭当前工作区')
        const transition = this.changesSession(name, payload)
        if (transition) await this.quiesce()
        try {
          return await (name === 'data.reset'
            ? this.requireWorkspace().write(() => this.executeCommand(name, payload))
            : this.executeCommand(name, payload))
        } finally {
          if (transition) {
            this.transitioning = false
            if (!this.closingRequested) this.chat.resume()
          }
        }
      })
    if (this.transitioning && !FLUSH_COMMANDS.has(name)) {
      throw new RuntimeError('runtime.closing', '正在保存并关闭当前工作区')
    }
    const workspace = this.workspace
    const write = async (): Promise<RuntimeCommandResult<K>> => {
      this.assertScope(scopeId)
      if (workspace !== this.workspace)
        throw new RuntimeError('runtime.stale-scope', '工作区已切换')
      return this.executeCommand(name, payload)
    }
    return workspace && WORKSPACE_COMMANDS.has(name) ? workspace.write(write) : write()
  }

  private changesSession(name: RuntimeCommandName, payload: unknown): boolean {
    switch (name) {
      case 'session.selectAccount':
      case 'session.selectWorkspace':
      case 'account.create':
      case 'workspace.create':
      case 'backup.restore':
      case 'data.reset':
        return true
      case 'account.delete':
        return readString(payload, 'accountId') === this.accounts.getCurrentId()
      case 'workspace.delete':
        return readString(payload, 'workspaceId') === this.registry?.getCurrentId()
      default:
        return false
    }
  }

  private readonly commandHandlers: CommandHandlers = {
    'session.selectAccount': async (input) => {
      return this.selectAccount(readString(input, 'accountId'))
    },
    'session.selectWorkspace': async (input) => {
      return this.selectWorkspace(readString(input, 'workspaceId'))
    },
    'account.create': async (input) => {
      const account = await this.accounts.create(input)
      try {
        await this.openAccount(account.id)
      } catch (error) {
        await this.accounts.remove(account.id)
        throw error
      }
      return account
    },
    'account.update': async (input) => {
      const account = await this.accounts.update(input.accountId, input.patch, Date.now())
      this.emit('accounts.changed', this.accounts.list())
      if (account.id === this.accounts.getCurrentId() && this.registry) {
        this.emit('session.changed', this.snapshot())
      }
      return undefined
    },
    'account.delete': async (input) => {
      const accountId = readString(input, 'accountId')
      const accounts = this.accounts.list()
      if (!accounts.some((item) => item.id === accountId))
        throw new RuntimeError('account.not-found', '账户不存在')
      if (accounts.length <= 1)
        throw new RuntimeError('account.last-account', '至少需要保留一个账户')
      if (accountId === this.accounts.getCurrentId())
        await this.openAccount(accounts.find((item) => item.id !== accountId)!.id)
      await this.accounts.remove(accountId)
      this.emit('accounts.changed', this.accounts.list())
      return undefined
    },
    'workspace.create': async (input) => {
      const registry = this.requireRegistry()
      const registeredIds = new Set(registry.list().map((item) => item.id))
      const dirPath = input.path ?? this.paths.defaultWorkspacePath(registry.account)
      const workspace = await registry.create({ name: input.name, dirPath }, Date.now())
      try {
        await this.openWorkspace(workspace)
      } catch (error) {
        if (!registeredIds.has(workspace.id)) await registry.remove(workspace.id)
        throw error
      }
      this.emit('workspaces.changed', registry.list())
      return workspace
    },
    'workspace.validatePath': async (input) => {
      return this.requireRegistry().validatePath(readString(input, 'dirPath'))
    },
    'workspace.repairPath': async (input) => {
      return this.requireRegistry().repairPath(readString(input, 'dirPath'), Date.now())
    },
    'workspace.rename': async (input) => {
      const workspace = await this.requireRegistry().rename(
        input.workspaceId,
        input.name,
        Date.now()
      )
      if (this.registry?.getCurrentId() === workspace.id) {
        this.emit('session.changed', this.snapshot())
      }
      this.emit('workspaces.changed', this.requireRegistry().list())
      return undefined
    },
    'workspace.delete': async (input) => {
      const workspaceId = readString(input, 'workspaceId')
      const registry = this.requireRegistry()
      if (!registry.getById(workspaceId))
        throw new RuntimeError('workspace.not-found', '工作区不存在')
      if (registry.list().length <= 1)
        throw new RuntimeError('workspace.last-workspace', '至少需要保留一个工作区')
      if (registry.getCurrentId() === workspaceId)
        await this.selectWorkspace(registry.list().find((item) => item.id !== workspaceId)!.id)
      await registry.remove(workspaceId)
      this.emit('workspaces.changed', registry.list())
      return undefined
    },
    'workspace.openInFileManager': async (input) => {
      const id = input?.workspaceId
      const workspace = id
        ? this.requireRegistry().getById(id)
        : this.requireRegistry().getCurrent()
      if (!workspace) throw new RuntimeError('workspace.not-found', '工作区不存在')
      return this.options.host.openInFileManager(workspace.path)
    },
    'workspace.pickDirectory': async (input) => {
      return this.options.host.pickDirectory(input?.title)
    },
    'tree.move': async (input) => {
      if (
        !input ||
        typeof input.nodeId !== 'string' ||
        (input.targetNodeId !== undefined && typeof input.targetNodeId !== 'string') ||
        !['before', 'after', 'inside', 'end'].includes(input.placement) ||
        (input.conflictPolicy !== undefined && !['error', 'rename'].includes(input.conflictPolicy))
      ) {
        throw new RuntimeError('tree.invalid-move', '无效的节点移动请求')
      }
      if (await this.requireWorkspace().moveTreeNode(input, Date.now())) this.emitTreeChanged()
      return undefined
    },
    'page.create': async (input) => {
      const page = await this.requireWorkspace().createPage(input, Date.now())
      this.emitTreeChanged()
      return page
    },
    'page.update': async (input) => {
      await this.requireWorkspace().updatePage(input.pageId, input.patch, Date.now())
      this.emitTreeChanged()
      return undefined
    },
    'page.delete': async (input) => {
      await this.requireWorkspace().deletePages(input.pageIds)
      this.emitTreeChanged()
      return undefined
    },
    'folder.create': async (input) => {
      const folder = await this.requireWorkspace().createFolder(input, Date.now())
      this.emitTreeChanged()
      return folder
    },
    'folder.update': async (input) => {
      await this.requireWorkspace().updateFolder(input.folderId, input.patch, Date.now())
      this.emitTreeChanged()
      return undefined
    },
    'folder.delete': async (input) => {
      const removed = await this.requireWorkspace().deleteFolders(
        input.folderIds,
        input.mode ?? 'promote',
        Date.now()
      )
      for (const pageId of removed) this.emit('conversation.changed', { pageId })
      this.emitTreeChanged()
      return undefined
    },
    'folder.clear': async (input) => {
      const removed = await this.requireWorkspace().clearFolder(readString(input, 'folderId'))
      for (const pageId of removed) this.emit('conversation.changed', { pageId })
      this.emitTreeChanged()
      return undefined
    },
    'conversation.append': async (input) => {
      return this.appendToConversation(input)
    },
    'conversation.replace': async (input) => {
      const workspace = this.requireWorkspace()
      if (!workspace.getPage(input.pageId)) {
        throw new RuntimeError('page.not-found', `页面不存在：${input.pageId}`)
      }
      await workspace.writeConversation({ ...input.conversation, pageId: input.pageId })
      this.chat.abortMissingParents(input.pageId, input.conversation)
      this.emit('conversation.changed', { pageId: input.pageId })
      return undefined
    },
    'conversation.updateMessage': async (input) => {
      return this.mutateConversation(input.pageId, (current, at) =>
        updateMessage(current, input.messageId, input.patch, at)
      )
    },
    'conversation.updateMessages': async (input) => {
      return this.mutateConversation(input.pageId, (current, at) =>
        updateMessages(current, input.messageIds, input.patch, at)
      )
    },
    'conversation.deleteMessage': async (input) => {
      return this.mutateConversation(input.pageId, (current, at) =>
        deleteMessage(current, input.messageId, at)
      )
    },
    'conversation.setLeaf': async (input) => {
      return this.mutateConversation(input.pageId, (current, at) =>
        input.messageId
          ? switchBranchToMessage(current, input.messageId, at)
          : setLeaf(current, undefined, at)
      )
    },
    'conversation.setSelected': async (input) => {
      return this.mutateConversation(input.pageId, (current) =>
        setSelected(current, input.messageId)
      )
    },
    'topic.create': async (input) => {
      return this.mutateConversation(input.pageId, (current, at) =>
        createTopic(current, input.topic, at)
      )
    },
    'topic.update': async (input) => {
      return this.mutateConversation(input.pageId, (current, at) =>
        updateTopic(current, input.topicId, input.patch, at)
      )
    },
    'topic.delete': async (input) => {
      return this.mutateConversation(input.pageId, (current, at) =>
        deleteTopic(current, input.topicId, at)
      )
    },
    'chat.send': async (input) => {
      return this.chat.send(input)
    },
    'chat.regenerate': async (input) => {
      return this.chat.regenerate(input)
    },
    'chat.continue': async (input) => {
      return this.chat.continueFromUserMessage(input)
    },
    'chat.stop': async (input) => {
      if (input.requestId && (await this.chat.stop(input.requestId))) return undefined
      if (input.pageId) return this.chat.stopPage(input.pageId)
      return undefined
    },
    'chat.generateTitle': async (input) => {
      return this.generateTitle(input)
    },
    'chat.retrySave': async (input) => {
      return this.chat.retrySave(readString(input, 'requestId'))
    },
    'ai.generateText': async (input) => {
      return this.chat.generateText(input)
    },
    'queue.add': async (input) => {
      const at = Date.now()
      const id = randomUUID()
      await this.requireQueues().add(input.pageId, {
        id,
        content: input.content,
        createdAt: at
      })
      this.emit('queue.changed', { pageId: input.pageId })
      this.requireWorkspace().afterCommit(() => void this.chat.drain(input.pageId))
      return id
    },
    'queue.update': async (input) => {
      await this.requireQueues().update(input.pageId, input.itemId, input.content)
      this.emit('queue.changed', { pageId: input.pageId })
      return undefined
    },
    'queue.remove': async (input) => {
      await this.requireQueues().remove(input.pageId, input.itemId)
      this.emit('queue.changed', { pageId: input.pageId })
      return undefined
    },
    'queue.clear': async (input) => {
      const pageId = readString(input, 'pageId')
      await this.requireQueues().clear(pageId)
      this.emit('queue.changed', { pageId })
      return undefined
    },
    'queue.setPaused': async (input) => {
      await this.requireQueues().setPaused(input.pageId, input.paused)
      this.emit('queue.changed', { pageId: input.pageId })
      if (!input.paused)
        this.requireWorkspace().afterCommit(() => void this.chat.drain(input.pageId))
      return undefined
    },
    'settings.replace': async (input) => {
      const scopeId = this.scopeId
      const settings = await this.requireSettings().replace(
        input.settings,
        input.baseRevision,
        input.mutationId
      )
      this.dispatchEvent({ type: 'settings.changed', payload: settings, scopeId })
      return settings
    },
    'data.reset': async (input) => {
      const { targets } = input
      const workspace = this.requireWorkspace()
      if (targets.includes('conversations')) await workspace.clearConversations()
      if (targets.includes('folders'))
        await workspace.deleteFolders(
          workspace.getTree().folders.map((folder) => folder.id),
          'promote',
          Date.now()
        )
      if (targets.includes('settings'))
        this.emit('settings.changed', await this.requireSettings().replace(defaultSettings()))
      const defaults = defaultViewState()
      const viewState = this.requireViewState().get()
      if (targets.includes('tabs'))
        Object.assign(viewState, {
          tabs: defaults.tabs,
          activeTabId: defaults.activeTabId,
          history: defaults.history,
          historyIndex: defaults.historyIndex
        })
      if (targets.includes('layout')) viewState.layout = defaults.layout
      await this.requireViewState().replace(viewState)
      this.emit('viewState.changed', viewState)
      this.emitTreeChanged()
      return undefined
    },
    'viewState.replace': async (input) => {
      return this.requireViewState().replace(input.viewState)
    },
    'attachment.import': async (input) => {
      if (!this.requireWorkspace().getPage(input.pageId))
        throw new RuntimeError('page.not-found', '页面不存在')
      return this.requireWorkspace().importAttachments(input.files, Date.now())
    },
    'attachment.delete': async (input) => {
      return this.requireWorkspace().deleteAttachment(readString(input, 'relativePath'))
    },
    'dialog.saveFile': async (input) => {
      return this.options.host.saveFile(input)
    },
    'dialog.openTextFile': async (input) => {
      return this.options.host.openTextFile(input)
    },
    'dialog.pickImages': async (input) => {
      return this.options.host.pickImages(input ?? { multiple: true })
    },
    'library.import': async (input) => {
      return this.importLibrary(input)
    },
    'backup.restore': async (input) => {
      const result = await restoreBackup(
        this.requireWorkspace(),
        this.requireSettings(),
        this.requireViewState(),
        input
      )
      this.emitTreeChanged()
      this.emit('settings.changed', this.requireSettings().snapshot())
      this.emit('viewState.changed', this.requireViewState().get())
      for (const pageId of Object.values(result.ids.pages))
        this.emit('conversation.changed', { pageId })
      return result
    },
    'app.checkUpdate': async () => {
      return (await this.updater?.check()) ?? { available: false }
    },
    'app.downloadUpdate': async () => {
      return this.updater?.download()
    },
    'app.quitAndInstall': async () => {
      if (!this.updater || this.updateStatus.state !== 'downloaded')
        throw new RuntimeError('app.update-not-ready', '更新尚未下载完成')
      await this.prepareClose()
      try {
        this.updater.quitAndInstall()
      } catch (error) {
        this.resume()
        throw error
      }
      return undefined
    }
  }

  private executeCommand<K extends RuntimeCommandName>(
    name: K,
    payload: RuntimeCommandPayload<K>
  ): Promise<RuntimeCommandResult<K>> {
    if (!Object.hasOwn(this.commandHandlers, name))
      throw new RuntimeError('runtime.unknown-command', `未知命令：${name}`)
    // 分发表中的每个处理器分别校验参数和返回值，分发时保持关联。
    const handler = this.commandHandlers[name] as (
      input: RuntimeCommandPayload<K>
    ) => Promise<RuntimeCommandResult<K>>
    return handler(payload)
  }

  // ==================== 会话管理 ====================

  private async openAccount(accountId: string): Promise<void> {
    if (!this.accounts.getById(accountId)) throw new RuntimeError('account.not-found', '账户不存在')
    const settingsStore = new SettingsStore(this.paths, accountId)
    await settingsStore.load(accountId)

    const registry = new WorkspaceRegistry(this.paths, accountId)
    await registry.load(accountId)

    const workspace = await registry.ensureDefault(Date.now())

    await this.openWorkspace(workspace, { registry, settingsStore })
  }

  private async selectAccount(accountId: string): Promise<void> {
    await this.openAccount(accountId)
  }

  private async selectWorkspace(workspaceId: string): Promise<void> {
    const workspace = this.requireRegistry().getById(workspaceId)
    if (!workspace) throw new RuntimeError('workspace.not-found', '工作区不存在')
    await this.openWorkspace(workspace)
  }

  private async openWorkspace(
    workspace: Workspace,
    account = { registry: this.requireRegistry(), settingsStore: this.requireSettings() }
  ): Promise<void> {
    // 先完整打开候选工作区，再发布新会话；候选损坏时原工作区仍然可用。
    const reuseLease = this.workspace?.path === workspace.path
    const lease = reuseLease
      ? this.workspaceLease!
      : await WorkspaceLease.acquire(this.paths.pointerDir(workspace.path))
    let index: IndexDb | undefined
    let store: WorkspaceStore | undefined
    const viewState = new ViewStateStore(this.paths, workspace.path)
    const previousWorkspaceId = account.registry.getCurrentId()
    const previousAccountId = this.accounts.getCurrentId()
    try {
      index = IndexDb.open(this.paths.indexFile(workspace.path))
      store = new WorkspaceStore(this.paths, workspace, index)
      await store.open()
      await viewState.load()
      await account.registry.setCurrent(workspace.id)
      await this.accounts.setCurrent(account.registry.account)
      if (reuseLease) this.workspaceLease = null
      await this.closeWorkspace()
    } catch (error) {
      store?.close()
      index?.close()
      if (!reuseLease) await lease.release()
      else this.workspaceLease = lease
      const failures: unknown[] = []
      const restores = [
        async () => {
          if (previousWorkspaceId && account.registry.getCurrentId() !== previousWorkspaceId)
            await account.registry.setCurrent(previousWorkspaceId)
        },
        async () => {
          if (previousAccountId && this.accounts.getCurrentId() !== previousAccountId)
            await this.accounts.setCurrent(previousAccountId)
        }
      ]
      for (const restore of restores) {
        try {
          await restore()
        } catch (failure) {
          failures.push(failure)
        }
      }
      if (failures.length)
        throw new AggregateError([error, ...failures], '会话切换失败且选择记录恢复失败')
      throw error
    }

    this.registry = account.registry
    this.settingsStore = account.settingsStore
    this.workspaceLease = lease
    this.index = index
    this.workspace = store
    this.viewState = viewState
    this.queues = new QueueStore(
      this.paths,
      workspace.path,
      (id) => Boolean(store.getPage(id)),
      (path, value) => store.writeJson(path, value)
    )
    this.search = new SearchService(index, store)
    this.scopeId = randomUUID()

    this.startWatcher(workspace.path)
    this.emit('session.changed', this.snapshot())
    this.emit('tree.changed', store.getTree())
  }

  private async closeWorkspace(): Promise<void> {
    await this.chat.abortAll()
    this.chat.assertSaved()
    await this.search?.dispose()
    await this.workspace?.idle()
    await this.settingsStore?.idle()
    this.stopWatcher()
    this.workspace?.close()
    this.index?.close()
    await this.workspaceLease?.release()
    this.workspaceLease = null
    this.workspace = null
    this.index = null
    this.viewState = null
    this.queues = null
    this.search = null
  }

  private snapshot(): SessionSnapshot {
    const workspace = this.registry?.getCurrent() ?? null
    return {
      scopeId: this.scopeId,
      accountId: this.accounts.getCurrentId(),
      workspaceId: workspace?.id ?? null,
      workspacePath: workspace?.path ?? null
    }
  }

  // ==================== 文件变更监听 ====================

  private startWatcher(workspacePath: string): void {
    this.stopWatcher()
    try {
      this.watcher = watch(workspacePath, { recursive: true }, (event, fileName) => {
        if (isWorkspaceFileChange(event, fileName)) this.scheduleExternalCheck()
      })
    } catch (error) {
      console.warn('[runtime] 无法监听工作区目录，外部改动需要手动刷新：', error)
    }
  }

  private stopWatcher(): void {
    if (this.watcherTimer) {
      clearTimeout(this.watcherTimer)
      this.watcherTimer = null
    }
    this.watcher?.close()
    this.watcher = null
  }

  private scheduleExternalCheck(): void {
    if (this.watcherTimer) clearTimeout(this.watcherTimer)
    this.watcherTimer = setTimeout(() => {
      this.watcherTimer = null
      void this.checkExternalChanges()
    }, 600)
  }

  private async checkExternalChanges(): Promise<void> {
    const workspace = this.workspace
    if (!workspace) return

    try {
      await workspace.write(async () => {
        if (workspace !== this.workspace || this.transitioning) return
        const changed = await workspace.reconcileExternalChanges()
        if (!changed.treeChanged && changed.pageIds.length === 0) return
        this.emit('tree.changed', workspace.getTree())
        this.emit('workspace.externalChange', { pageIds: changed.pageIds })
      })
    } catch (error) {
      console.warn('[runtime] 处理外部改动失败：', error)
    }
  }

  // ==================== 具体业务 ====================

  private async appendToConversation(
    input: RuntimeCommandPayload<'conversation.append'>
  ): Promise<ChatMessage> {
    const workspace = this.requireWorkspace()
    const conversation = await workspace.readConversation(input.pageId)
    const result = appendMessage(conversation, input.draft, Date.now())

    await workspace.writeConversation(result.conversation)
    this.emit('conversation.message', { pageId: input.pageId, message: result.message })
    this.emit('conversation.changed', { pageId: input.pageId })
    return result.message
  }

  private async mutateConversation(
    pageId: string,
    mutate: (conversation: Conversation, at: number) => Conversation
  ): Promise<void> {
    const workspace = this.requireWorkspace()
    const next = await workspace.mutateConversation(pageId, (current) => {
      const conversation = mutate(current, Date.now())
      return { conversation, result: conversation }
    })
    workspace.afterCommit(() => this.chat.abortMissingParents(pageId, next))
    this.emit('conversation.changed', { pageId })
  }

  private async generateTitle(input: RuntimeCommandPayload<'chat.generateTitle'>): Promise<string> {
    switch (input.target.kind) {
      case 'message':
        return this.chat.generateMessageTitle({
          pageId: input.pageId,
          messageId: input.target.messageId,
          llmId: input.llmId,
          modelConfigId: input.modelConfigId,
          extraRequirements: input.extraRequirements
        })
      case 'topic':
        return this.chat.generateTopicTitle({
          pageId: input.pageId,
          topicId: input.target.topicId,
          llmId: input.llmId,
          modelConfigId: input.modelConfigId,
          extraRequirements: input.extraRequirements
        })
      case 'session':
        return this.chat.generateSessionTitle({
          pageId: input.pageId,
          llmId: input.llmId,
          modelConfigId: input.modelConfigId,
          extraRequirements: input.extraRequirements
        })
    }
  }

  private async listModels(llmId: string): Promise<ModelCatalog> {
    try {
      const connection = this.resolveConnection(llmId)
      return { models: await listModels(connection) }
    } catch (error) {
      return { models: [], error: error instanceof Error ? error.message : String(error) }
    }
  }

  private async testConnection(llmId: string): Promise<{ ok: boolean; message: string }> {
    try {
      await testProviderConnection(this.resolveConnection(llmId))
      return { ok: true, message: '连接成功' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  private async readAttachment(relativePath: string): Promise<AttachmentContent> {
    const workspace = this.requireWorkspace()
    const absolutePath = await workspace.validateAttachmentPath(relativePath, true)
    const buffer = await readBinary(absolutePath)
    if (!buffer) {
      throw new RuntimeError('attachment.not-found', `附件不存在：${relativePath}`)
    }

    return {
      mimeType: guessMimeType(relativePath),
      dataBase64: buffer.toString('base64')
    }
  }

  private async importLibrary(input: ImportSource): Promise<ImportResult> {
    const workspace = this.requireWorkspace()

    let payload: unknown
    try {
      payload = JSON.parse(input.payload)
    } catch {
      throw new RuntimeError('library.invalid-json', '导入文件不是合法 JSON')
    }

    const format = input.source === 'chatgpt' ? 'openai' : input.source
    const parsed = parseImport(payload, format, Date.now())
    const selected =
      input.ids !== undefined
        ? parsed.conversations.filter((conversation) => input.ids?.includes(conversation.id))
        : parsed.conversations

    if (selected.length === 0) {
      throw new RuntimeError('library.empty', parsed.errors[0] ?? '没有可导入的对话')
    }

    const folderId = input.folderName?.trim()
      ? (await workspace.createFolder({ name: input.folderName.trim() }, Date.now())).id
      : undefined

    let importedPages = 0
    let importedMessages = 0
    // 新页面默认落到最前面，这里以「上一个已导入的页面」为参照，保持导入顺序
    let previousPageId: string | undefined

    for (const imported of selected) {
      const page = await workspace.createPage(
        { name: imported.title, parentFolderId: folderId, afterNodeId: previousPageId },
        imported.createdAt
      )
      previousPageId = page.id

      const conversation: Conversation = {
        pageId: page.id,
        messages: imported.messages,
        topics: [],
        leafMessageId: imported.leafMessageId ?? imported.messages.at(-1)?.id
      }

      await workspace.writeConversation(conversation)
      importedPages += 1
      importedMessages += imported.messages.length
    }

    this.emitTreeChanged()
    return { importedPages, importedMessages }
  }

  private resolveConnection(llmId: string): {
    baseUrl: string
    apiKey: string
    modelName: string
  } {
    const settings = this.requireSettings()
    const current: Settings = settings.get()
    const llm = current.llmConfigs.items.find((item) => item.id === llmId)
    if (!llm) {
      throw new RuntimeError('ai.no-llm-config', '未找到指定的 LLM 配置')
    }

    const apiKey = llm.apiKey
    if (!apiKey) {
      throw new RuntimeError('ai.no-api-key', `LLM 配置「${llm.name}」缺少 API Key`)
    }

    return { baseUrl: llm.baseUrl, apiKey, modelName: llm.modelName }
  }

  // ==================== 工具方法 ====================

  private dispatchEvent(event: RuntimeEvent): void {
    event = { ...event, scopeId: event.scopeId ?? this.scopeId }
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (error) {
        console.error('[runtime] 事件订阅者抛出异常：', error)
      }
    }
  }

  private emit<K extends RuntimeEventName>(type: K, payload: RuntimeEventPayload<K>): void {
    const event = { type, payload, scopeId: this.scopeId } as RuntimeEvent
    if (
      this.workspace &&
      /^(tree\.|page\.|conversation\.|queue\.|workspace.externalChange)/.test(type)
    )
      this.workspace.afterCommit(() => this.dispatchEvent(event))
    else this.dispatchEvent(event)
  }

  private emitTreeChanged(): void {
    const workspace = this.workspace
    if (!workspace) return
    this.emit('tree.changed', workspace.getTree())
  }

  private requireWorkspace(): WorkspaceStore {
    if (!this.workspace) throw new RuntimeError('workspace.unavailable', '尚未打开工作区')
    return this.workspace
  }

  private requireSettings(): SettingsStore {
    if (!this.settingsStore) throw new RuntimeError('settings.unavailable', '尚未加载账户设置')
    return this.settingsStore
  }

  private requireRegistry(): WorkspaceRegistry {
    if (!this.registry) throw new RuntimeError('workspace.unavailable', '尚未加载工作区列表')
    return this.registry
  }

  private requireViewState(): ViewStateStore {
    if (!this.viewState) throw new RuntimeError('workspace.unavailable', '尚未打开工作区')
    return this.viewState
  }

  private requireQueues(): QueueStore {
    if (!this.queues) throw new RuntimeError('workspace.unavailable', '尚未打开工作区')
    return this.queues
  }

  private requireSearch(): SearchService {
    if (!this.search) throw new RuntimeError('workspace.unavailable', '尚未打开工作区')
    return this.search
  }
}

function readString(payload: unknown, key: string): string {
  const value = (payload as Record<string, unknown> | undefined)?.[key]
  if (typeof value !== 'string') {
    throw new RuntimeError('runtime.invalid-payload', `命令参数缺少 ${key}`)
  }
  return value
}

function readPageId(payload: unknown): string {
  return readString(payload, 'pageId')
}

function readLlmId(payload: unknown): string {
  return readString(payload, 'llmId')
}

function guessMimeType(relativePath: string): string {
  const extension = relativePath.toLowerCase().split('.').pop() ?? ''
  switch (extension) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'svg':
      return 'image/svg+xml'
    case 'pdf':
      return 'application/pdf'
    case 'txt':
    case 'md':
      return 'text/plain'
    default:
      return 'application/octet-stream'
  }
}
