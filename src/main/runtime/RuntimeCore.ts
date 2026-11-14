/**
 * 内核装配与会话管理
 *
 * 对外只暴露三类操作：query / command / 事件订阅。
 * 会话切换（账户、工作区）由内核完成资源的打开与关闭，展示层只需重新订阅并按作用域丢弃缓存。
 */

import { watch, type FSWatcher } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { ChatMessage, Conversation, SearchOptions, Settings, Workspace } from '@shared/domain'
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
  RuntimeCommandPayload,
  RuntimeEvent,
  SessionSnapshot,
  TitleTarget,
  UpdateCheckResult,
  UpdateStatus,
  ViewState,
  WorkspaceSearchResult
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
import { readBinary } from './fsx'
import { restoreBackup } from './BackupRestorer'

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
    const session = this.accounts.getSession()
    const accountId =
      session.accountId && this.accounts.getById(session.accountId) ? session.accountId : account.id

    await this.openAccount(accountId, session.workspaceId ?? undefined)
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

  async query(name: string, payload: unknown, scopeId?: string | null): Promise<unknown> {
    if (name !== 'session.get') this.assertScope(scopeId)
    const workspace = this.workspace
    const read = async (): Promise<unknown> => {
      if (name !== 'session.get') this.assertScope(scopeId)
      const result = await this.executeQuery(name, payload)
      if (name !== 'session.get') this.assertScope(scopeId)
      return result
    }
    return workspace && /^(tree\.|conversation\.|queue\.|attachment\.|viewState\.)/.test(name)
      ? workspace.run(read)
      : read()
  }

  private async executeQuery(name: string, payload: unknown): Promise<unknown> {
    switch (name) {
      case 'session.get':
        return this.snapshot()
      case 'accounts.list':
        return this.accounts.list()
      case 'workspaces.list':
        return this.requireRegistry().list()
      case 'tree.get':
        return this.requireWorkspace().getTree()
      case 'conversation.get':
        return this.requireWorkspace().readConversation(readPageId(payload))
      case 'settings.get':
        return this.requireSettings().snapshot()
      case 'viewState.get':
        return this.requireViewState().get()
      case 'queue.get':
        return this.requireQueues().get(readPageId(payload))
      case 'search.workspace':
        return this.runSearch(payload)
      case 'search.messages':
        return this.requireSearch().messages(
          payload as import('@shared/contracts').MessageSearchRequest
        )
      case 'ai.models':
        return this.listModels(readLlmId(payload))
      case 'ai.test':
        return this.testConnection(readLlmId(payload))
      case 'attachment.read':
        return this.readAttachment(payload)
      case 'app.version':
        return this.options.host.getVersion()
      case 'app.updateStatus':
        return this.updateStatus
      default:
        throw new RuntimeError('runtime.unknown-query', `未知查询：${name}`)
    }
  }

  // ==================== 命令 ====================

  async command(name: string, payload: unknown, scopeId?: string | null): Promise<unknown> {
    this.assertScope(scopeId)
    if (
      this.closingRequested &&
      !['settings.replace', 'viewState.replace', 'chat.stop', 'chat.retrySave'].includes(name)
    )
      throw new RuntimeError('runtime.closing', '正在保存并关闭当前工作区')
    const restoreOrReset = name === 'data.reset' || name === 'backup.restore'
    const transition =
      restoreOrReset ||
      /^(session\.|account\.|workspace\.(create|delete|rename|repairPath)$)/.test(name)
    if (transition)
      return this.lifecycle.run(async () => {
        this.assertScope(scopeId)
        if (this.closingRequested)
          throw new RuntimeError('runtime.closing', '正在保存并关闭当前工作区')
        await this.quiesce()
        try {
          return await (name === 'data.reset'
            ? this.requireWorkspace().run(() => this.executeCommand(name, payload))
            : this.executeCommand(name, payload))
        } finally {
          this.transitioning = false
          if (!this.closingRequested) this.chat.resume()
        }
      })
    if (
      this.transitioning &&
      !['settings.replace', 'viewState.replace', 'chat.stop', 'chat.retrySave'].includes(name)
    ) {
      throw new RuntimeError('runtime.closing', '正在保存并关闭当前工作区')
    }
    const workspace = this.workspace
    const write = async (): Promise<unknown> => {
      this.assertScope(scopeId)
      if (workspace !== this.workspace)
        throw new RuntimeError('runtime.stale-scope', '工作区已切换')
      return this.executeCommand(name, payload)
    }
    return workspace &&
      /^(tree\.|page\.|folder\.|conversation\.|topic\.|queue\.|viewState\.|attachment\.|library\.|backup\.)/.test(
        name
      )
      ? workspace.run(write)
      : write()
  }

  private async executeCommand(name: string, payload: unknown): Promise<unknown> {
    switch (name) {
      // 会话
      case 'session.selectAccount':
        return this.selectAccount(readString(payload, 'accountId'))
      case 'session.selectWorkspace':
        return this.selectWorkspace(readString(payload, 'workspaceId'))

      // 账户
      case 'account.create': {
        const input = payload as { name: string; avatar?: string }
        const account = await this.accounts.create(input)
        try {
          await this.openAccount(account.id)
        } catch (error) {
          await this.accounts.remove(account.id)
          throw error
        }
        return account
      }
      case 'account.update': {
        const input = payload as { accountId: string; patch: { name?: string; avatar?: string } }
        const account = await this.accounts.update(input.accountId, input.patch, Date.now())
        this.emit('accounts.changed', this.accounts.list())
        if (account.id === this.accounts.getCurrentId() && this.registry) {
          this.emit('session.changed', this.snapshot())
        }
        return undefined
      }
      case 'account.delete': {
        const accountId = readString(payload, 'accountId')
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
      }

      // 工作区
      case 'workspace.create': {
        const input = payload as { name: string; type: 'default' | 'custom'; path?: string }
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
      }
      case 'workspace.validatePath':
        return this.requireRegistry().validatePath(readString(payload, 'dirPath'))
      case 'workspace.repairPath':
        return this.requireRegistry().repairPath(readString(payload, 'dirPath'), Date.now())
      case 'workspace.rename': {
        const input = payload as { workspaceId: string; name: string }
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
      }
      case 'workspace.delete': {
        const workspaceId = readString(payload, 'workspaceId')
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
      }
      case 'workspace.openInFileManager': {
        const id = (payload as { workspaceId?: string } | undefined)?.workspaceId
        const workspace = id
          ? this.requireRegistry().getById(id)
          : this.requireRegistry().getCurrent()
        if (!workspace) throw new RuntimeError('workspace.not-found', '工作区不存在')
        return this.options.host.openInFileManager(workspace.path)
      }
      case 'workspace.pickDirectory':
        return this.options.host.pickDirectory((payload as { title?: string } | undefined)?.title)

      // 页面树
      case 'tree.move': {
        const input = payload as RuntimeCommandPayload<'tree.move'>
        if (
          !input ||
          typeof input.nodeId !== 'string' ||
          typeof input.targetNodeId !== 'string' ||
          !['before', 'after', 'inside'].includes(input.placement) ||
          (input.conflictPolicy !== undefined &&
            !['error', 'rename'].includes(input.conflictPolicy))
        ) {
          throw new RuntimeError('tree.invalid-move', '无效的节点移动请求')
        }
        if (await this.requireWorkspace().moveTreeNode(input, Date.now())) this.emitTreeChanged()
        return undefined
      }
      case 'page.create': {
        const input = payload as {
          name?: string
          parentFolderId?: string
          afterNodeId?: string
          starred?: boolean
        }
        const page = await this.requireWorkspace().createPage(input, Date.now())
        this.emitTreeChanged()
        return page
      }
      case 'page.update': {
        const input = payload as { pageId: string; patch: { name?: string; starred?: boolean } }
        await this.requireWorkspace().updatePage(input.pageId, input.patch, Date.now())
        this.emitTreeChanged()
        return undefined
      }
      case 'page.move': {
        const input = payload as {
          pageId: string
          targetFolderId?: string
          beforeNodeId?: string
        }
        await this.requireWorkspace().movePage(
          input.pageId,
          input.targetFolderId,
          input.beforeNodeId,
          Date.now()
        )
        this.emitTreeChanged()
        return undefined
      }
      case 'page.delete': {
        const input = payload as { pageIds: string[] }
        await this.requireWorkspace().deletePages(input.pageIds)
        this.emitTreeChanged()
        return undefined
      }
      case 'folder.create': {
        const input = payload as {
          name?: string
          parentFolderId?: string
          afterNodeId?: string
        }
        const folder = await this.requireWorkspace().createFolder(input, Date.now())
        this.emitTreeChanged()
        return folder
      }
      case 'folder.update': {
        const input = payload as { folderId: string; patch: { name?: string } }
        await this.requireWorkspace().updateFolder(input.folderId, input.patch, Date.now())
        this.emitTreeChanged()
        return undefined
      }
      case 'folder.move': {
        const input = payload as {
          folderId: string
          targetFolderId?: string
          beforeNodeId?: string
        }
        await this.requireWorkspace().moveFolder(
          input.folderId,
          input.targetFolderId,
          input.beforeNodeId,
          Date.now()
        )
        this.emitTreeChanged()
        return undefined
      }
      case 'folder.delete': {
        const input = payload as { folderIds: string[]; mode?: 'promote' | 'cascade' }
        const removed = await this.requireWorkspace().deleteFolders(
          input.folderIds,
          input.mode ?? 'promote',
          Date.now()
        )
        for (const pageId of removed) this.emit('conversation.changed', { pageId })
        this.emitTreeChanged()
        return undefined
      }
      case 'folder.clear': {
        const removed = await this.requireWorkspace().clearFolder(readString(payload, 'folderId'))
        for (const pageId of removed) this.emit('conversation.changed', { pageId })
        this.emitTreeChanged()
        return undefined
      }

      // 会话内容
      case 'conversation.append':
        return this.appendToConversation(payload)
      case 'conversation.replace': {
        const input = payload as { pageId: string; conversation: Conversation }
        const workspace = this.requireWorkspace()
        if (!workspace.getPage(input.pageId)) {
          throw new RuntimeError('page.not-found', `页面不存在：${input.pageId}`)
        }
        await workspace.writeConversation({ ...input.conversation, pageId: input.pageId })
        this.chat.abortMissingParents(input.pageId, input.conversation)
        this.emit('conversation.changed', { pageId: input.pageId })
        return undefined
      }
      case 'conversation.updateMessage':
        return this.mutateConversation<{
          pageId: string
          messageId: string
          patch: Parameters<typeof updateMessage>[2]
        }>(payload, (conversation, input, at) =>
          updateMessage(conversation, input.messageId, input.patch, at)
        )
      case 'conversation.updateMessages':
        return this.mutateConversation<{
          pageId: string
          messageIds: string[]
          patch: Parameters<typeof updateMessages>[2]
        }>(payload, (conversation, input, at) =>
          updateMessages(conversation, input.messageIds, input.patch, at)
        )
      case 'conversation.deleteMessage':
        return this.mutateConversation<{ pageId: string; messageId: string }>(
          payload,
          (conversation, input, at) => deleteMessage(conversation, input.messageId, at)
        )
      case 'conversation.setLeaf':
        return this.mutateConversation<{ pageId: string; messageId?: string }>(
          payload,
          (conversation, input, at) =>
            input.messageId
              ? switchBranchToMessage(conversation, input.messageId, at)
              : setLeaf(conversation, undefined, at)
        )
      case 'conversation.setSelected':
        return this.mutateConversation<{ pageId: string; messageId?: string }>(
          payload,
          (conversation, input) => setSelected(conversation, input.messageId)
        )
      case 'topic.create':
        return this.mutateConversation<{
          pageId: string
          topic: Parameters<typeof createTopic>[1]
        }>(payload, (conversation, input, at) => createTopic(conversation, input.topic, at))
      case 'topic.update':
        return this.mutateConversation<{
          pageId: string
          topicId: string
          patch: Parameters<typeof updateTopic>[2]
        }>(payload, (conversation, input, at) =>
          updateTopic(conversation, input.topicId, input.patch, at)
        )
      case 'topic.delete':
        return this.mutateConversation<{ pageId: string; topicId: string }>(
          payload,
          (conversation, input, at) => deleteTopic(conversation, input.topicId, at)
        )

      // 对话执行
      case 'chat.send': {
        const input = payload as Parameters<ChatEngine['send']>[0]
        return this.chat.send(input)
      }
      case 'chat.regenerate': {
        const input = payload as Parameters<ChatEngine['regenerate']>[0]
        return this.chat.regenerate(input)
      }
      case 'chat.continue': {
        const input = payload as Parameters<ChatEngine['continueFromUserMessage']>[0]
        return this.chat.continueFromUserMessage(input)
      }
      case 'chat.stop': {
        const input = payload as { requestId?: string; pageId?: string }
        if (input.requestId && (await this.chat.stop(input.requestId))) return undefined
        if (input.pageId) return this.chat.stopPage(input.pageId)
        return undefined
      }
      case 'chat.generateTitle':
        return this.generateTitle(payload)
      case 'chat.retrySave':
        return this.chat.retrySave(readString(payload, 'requestId'))
      case 'ai.generateText': {
        const input = payload as { prompt: string; llmId?: string; modelConfigId?: string }
        return this.chat.generateText(input)
      }

      // 消息队列
      case 'queue.add': {
        const input = payload as { pageId: string; content: string }
        const at = Date.now()
        const id = randomUUID()
        await this.requireQueues().add(input.pageId, {
          id,
          content: input.content,
          createdAt: at
        })
        this.emit('queue.changed', { pageId: input.pageId })
        void this.chat.drain(input.pageId)
        return id
      }
      case 'queue.update': {
        const input = payload as { pageId: string; itemId: string; content: string }
        await this.requireQueues().update(input.pageId, input.itemId, input.content)
        this.emit('queue.changed', { pageId: input.pageId })
        return undefined
      }
      case 'queue.remove': {
        const input = payload as { pageId: string; itemId: string }
        await this.requireQueues().remove(input.pageId, input.itemId)
        this.emit('queue.changed', { pageId: input.pageId })
        return undefined
      }
      case 'queue.clear': {
        const pageId = readString(payload, 'pageId')
        await this.requireQueues().clear(pageId)
        this.emit('queue.changed', { pageId })
        return undefined
      }
      case 'queue.setPaused': {
        const input = payload as { pageId: string; paused: boolean }
        await this.requireQueues().setPaused(input.pageId, input.paused)
        this.emit('queue.changed', { pageId: input.pageId })
        if (!input.paused) void this.chat.drain(input.pageId)
        return undefined
      }

      // 设置
      case 'settings.replace': {
        const scopeId = this.scopeId
        const input = payload as RuntimeCommandPayload<'settings.replace'>
        const settings = await this.requireSettings().replace(
          input.settings,
          input.baseRevision,
          input.mutationId
        )
        this.dispatchEvent({ type: 'settings.changed', payload: settings, scopeId })
        return settings
      }

      case 'data.reset': {
        const { targets } = payload as RuntimeCommandPayload<'data.reset'>
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
      }

      // 展示层状态
      case 'viewState.replace':
        return this.requireViewState().replace((payload as { viewState: ViewState }).viewState)

      // 附件与文件
      case 'attachment.import': {
        const input = payload as {
          pageId: string
          files: Array<{ name: string; mimeType: string; dataBase64: string }>
        }
        if (!this.requireWorkspace().getPage(input.pageId))
          throw new RuntimeError('page.not-found', '页面不存在')
        return this.requireWorkspace().importAttachments(input.files, Date.now())
      }
      case 'attachment.delete':
        return this.requireWorkspace().deleteAttachment(readString(payload, 'relativePath'))
      case 'dialog.saveFile': {
        const input = payload as {
          suggestedName: string
          content: string
          filters?: Array<{ name: string; extensions: string[] }>
        }
        return this.options.host.saveFile(input)
      }
      case 'dialog.openTextFile':
        return this.options.host.openTextFile(
          payload as { filters?: Array<{ name: string; extensions: string[] }> } | undefined
        )
      case 'dialog.pickImages':
        return this.options.host.pickImages(
          (payload as { multiple?: boolean } | undefined) ?? { multiple: true }
        )
      case 'library.import':
        return this.importLibrary(payload as ImportSource)
      case 'backup.restore': {
        const result = await restoreBackup(
          this.requireWorkspace(),
          this.requireSettings(),
          this.requireViewState(),
          payload as RuntimeCommandPayload<'backup.restore'>
        )
        this.emitTreeChanged()
        this.emit('settings.changed', this.requireSettings().snapshot())
        this.emit('viewState.changed', this.requireViewState().get())
        for (const pageId of Object.values(result.ids.pages))
          this.emit('conversation.changed', { pageId })
        return result
      }

      // 更新
      case 'app.checkUpdate':
        return (await this.updater?.check()) ?? { available: false }
      case 'app.downloadUpdate':
        return this.updater?.download()
      case 'app.quitAndInstall':
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

      default:
        throw new RuntimeError('runtime.unknown-command', `未知命令：${name}`)
    }
  }

  // ==================== 会话管理 ====================

  private async openAccount(accountId: string, preferredWorkspaceId?: string): Promise<void> {
    if (!this.accounts.getById(accountId)) throw new RuntimeError('account.not-found', '账户不存在')
    const settingsStore = new SettingsStore(this.paths, accountId)
    await settingsStore.load(accountId)

    const registry = new WorkspaceRegistry(this.paths, accountId)
    await registry.load(accountId)

    const preferred = preferredWorkspaceId ? registry.getById(preferredWorkspaceId) : undefined
    const workspace =
      preferred && (await registry.validatePath(preferred.path)).valid
        ? preferred
        : await registry.ensureDefault(Date.now())

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
    const previousSession = this.accounts.getSession()
    try {
      index = IndexDb.open(this.paths.indexFile(workspace.path))
      store = new WorkspaceStore(this.paths, workspace, index)
      await store.open()
      await viewState.load()
      await account.registry.setCurrent(workspace.id)
      await this.accounts.setCurrent(account.registry.account)
      await this.accounts.setSession({
        accountId: account.registry.account,
        workspaceId: workspace.id
      })
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
        },
        async () => {
          if (JSON.stringify(this.accounts.getSession()) !== JSON.stringify(previousSession))
            await this.accounts.setSession(previousSession)
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
      this.watcher = watch(workspacePath, { recursive: true }, () => this.scheduleExternalCheck())
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
      await workspace.run(async () => {
        if (workspace !== this.workspace || this.transitioning) return
        const changed = await workspace.detectExternalChanges()
        if (changed.length === 0) return

        await workspace.reload(changed)
        this.emit('tree.changed', workspace.getTree())
        this.emit('workspace.externalChange', { pageIds: changed })
      })
    } catch (error) {
      console.warn('[runtime] 处理外部改动失败：', error)
    }
  }

  // ==================== 具体业务 ====================

  private async appendToConversation(payload: unknown): Promise<ChatMessage> {
    const input = payload as {
      pageId: string
      draft: ChatMessage | Parameters<typeof appendMessage>[1]
    }
    const workspace = this.requireWorkspace()
    const conversation = await workspace.readConversation(input.pageId)
    const result = appendMessage(conversation, input.draft, Date.now())

    await workspace.writeConversation(result.conversation)
    this.emit('conversation.message', { pageId: input.pageId, message: result.message })
    this.emit('conversation.changed', { pageId: input.pageId })
    return result.message
  }

  private async mutateConversation<TPayload>(
    payload: unknown,
    mutate: (conversation: Conversation, input: TPayload, at: number) => Conversation
  ): Promise<undefined> {
    const input = payload as TPayload & { pageId: string }
    const workspace = this.requireWorkspace()
    const conversation = await workspace.readConversation(input.pageId)
    const next = mutate(conversation, input, Date.now())
    await workspace.writeConversation(next)
    this.chat.abortMissingParents(input.pageId, next)
    this.emit('conversation.changed', { pageId: input.pageId })
    return undefined
  }

  private async generateTitle(payload: unknown): Promise<string> {
    const input = payload as {
      pageId: string
      target: TitleTarget
      llmId?: string
      modelConfigId?: string
      extraRequirements?: string
    }

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

  private runSearch(payload: unknown): Promise<WorkspaceSearchResult> {
    const input = payload as { query: string; options: SearchOptions }
    return this.requireSearch().search(input.query, input.options)
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

  private async readAttachment(payload: unknown): Promise<AttachmentContent> {
    const relativePath = readString(payload, 'relativePath')
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

  private emit(type: RuntimeEvent['type'], payload: unknown): void {
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
