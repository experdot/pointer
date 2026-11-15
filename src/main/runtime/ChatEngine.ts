/**
 * 对话执行引擎
 *
 * 负责流式请求的完整生命周期：上下文构造、事件推送、落盘时机、中止与错误处理。
 * 落盘策略：流式过程中不写盘；用户消息立即落盘，助手消息在结束（完成/中止/失败）时落盘一次。
 */

import { msg, formatError, LocalizedError } from '@shared/i18n/message'
import type { Translate } from '@shared/i18n'
import type { SupportedLanguage } from '@shared/domain/locale'

import type { RuntimeEventName, RuntimeEventPayload } from '@shared/contracts'
import { randomUUID } from 'node:crypto'
import type {
  AttachmentRef,
  ChatMessage,
  Conversation,
  ModelParameters,
  ProviderConnection,
  Settings
} from '@shared/domain'
import {
  appendMessage,
  buildIndex,
  computeTopicGroups,
  currentPath,
  pathToMessage,
  updateMessage,
  updateTopic
} from '@shared/domain'
import type { ChatRequestHandle, RuntimeEvent } from '@shared/contracts'
import { RuntimeError } from '@shared/contracts'
import type { SettingsStore } from './SettingsStore'
import type { WorkspaceStore } from './WorkspaceStore'
import type { QueueStore } from './QueueStore'
import type { ProviderMessage } from './providers'
import { isAbortError, streamChat } from './providers'
import { buildLocalizedTitlePrompt, normalizeTitle, truncateForPrompt } from '@shared/domain'

interface ChatEngineDeps {
  t: Translate
  language: () => SupportedLanguage
  workspace: () => WorkspaceStore | null
  settings: () => SettingsStore | null
  scope: () => string | null
  queues: () => QueueStore | null
  emit: (event: RuntimeEvent) => void
}

interface SendInput {
  pageId: string
  content: string
  attachments?: AttachmentRef[]
  parentMessageId?: string | null
  llmId?: string
  modelConfigId?: string
}

interface ActiveRequest {
  workspace: WorkspaceStore
  scopeId: string | null
  requestId: string
  pageId: string
  messageId: string
  controller: AbortController
  assistant: ChatMessage
  /** 该请求的收尾（落盘）完成时 resolve */
  finished: Promise<void>
  markFinished: () => void
}

type ResolvedConfig = {
  connection: ProviderConnection
  parameters: ModelParameters
  llmId?: string
  modelConfigId?: string
}

export class ChatEngine {
  private readonly active = new Map<string, ActiveRequest>()
  private readonly auxiliary = new Map<AbortController, Promise<void>>()
  private readonly unsaved = new Map<string, { request: ActiveRequest; terminal: RuntimeEvent }>()
  private suspended = false

  constructor(private readonly deps: ChatEngineDeps) {}

  suspend(): void {
    this.suspended = true
  }
  resume(): void {
    this.suspended = false
  }

  assertSaved(): void {
    if (this.unsaved.size)
      throw new RuntimeError('chat.unsaved', msg('errors.chat.unsaved'), [...this.unsaved.keys()])
  }

  isPageBusy(pageId: string): boolean {
    return (
      [...this.active.values()].some((request) => request.pageId === pageId) ||
      [...this.unsaved.values()].some(({ request }) => request.pageId === pageId)
    )
  }

  async abortAll(): Promise<void> {
    const active = [...this.active.values()]
    const auxiliary = [...this.auxiliary.entries()]
    for (const request of active) request.controller.abort()
    for (const [controller] of auxiliary) controller.abort()
    await Promise.all([
      ...active.map((request) => request.finished),
      ...auxiliary.map(([, finished]) => finished)
    ])
  }

  async stop(requestId: string): Promise<boolean> {
    const request = this.active.get(requestId)
    if (!request) return false
    request.controller.abort()
    return true
  }

  async stopPage(pageId: string): Promise<void> {
    for (const request of this.active.values()) {
      if (request.pageId === pageId) request.controller.abort()
    }
  }

  abortMissingParents(pageId: string, conversation: Conversation): void {
    const ids = new Set(conversation.messages.map((message) => message.id))
    for (const request of this.active.values()) {
      const parent = request.assistant.parentMessageId
      if (request.pageId === pageId && parent && !ids.has(parent)) request.controller.abort()
    }
  }

  private assertReady(workspace: WorkspaceStore, pageId?: string): void {
    if (this.suspended || workspace !== this.deps.workspace())
      throw new RuntimeError('runtime.stale-scope', msg('errors.workspace.closing'))
    if (pageId && !workspace.getPage(pageId))
      throw new RuntimeError('page.not-found', msg('errors.chat.targetMissing'))
    if (pageId && this.isPageBusy(pageId))
      throw new RuntimeError('chat.busy', msg('errors.chat.alreadyGenerating'))
  }

  async send(input: SendInput): Promise<ChatRequestHandle> {
    const workspace = this.requireWorkspace()
    return workspace.write(() => this.sendInside(workspace, input))
  }

  /** 准入、读取和用户消息写入在同一事务内；模型流不占用写队列。 */
  private async sendInside(
    workspace: WorkspaceStore,
    input: SendInput,
    accept?: () => Promise<void>
  ): Promise<ChatRequestHandle> {
    this.assertReady(workspace, input.pageId)
    let conversation = await workspace.readConversation(input.pageId)
    let parentMessageId =
      input.parentMessageId === null
        ? undefined
        : (input.parentMessageId ?? conversation.leafMessageId)
    if (parentMessageId && !conversation.messages.some((message) => message.id === parentMessageId))
      throw new RuntimeError('chat.message-not-found', msg('errors.chat.messageMissing'))
    let user: ChatMessage | undefined
    if (input.content.trim() || input.attachments?.length) {
      const appended = appendMessage(
        conversation,
        {
          id: randomUUID(),
          role: 'user',
          content: input.content,
          attachments: input.attachments,
          parentMessageId
        },
        Date.now()
      )
      conversation = appended.conversation
      user = appended.message
      parentMessageId = user.id
    }
    return this.startGeneration(workspace, conversation, parentMessageId, input, user, accept)
  }

  async regenerate(input: {
    pageId: string
    messageId: string
    llmId?: string
    modelConfigId?: string
  }): Promise<ChatRequestHandle> {
    const workspace = this.requireWorkspace()
    return workspace.write(async () => {
      this.assertReady(workspace, input.pageId)
      const conversation = await workspace.readConversation(input.pageId)
      const message = conversation.messages.find((item) => item.id === input.messageId)
      if (!message)
        throw new RuntimeError('chat.message-not-found', msg('errors.chat.targetMissing'))
      return this.startGeneration(workspace, conversation, message.parentMessageId, {
        llmId: input.llmId ?? message.llmId,
        modelConfigId: input.modelConfigId ?? message.modelConfigId
      })
    })
  }

  async continueFromUserMessage(input: {
    pageId: string
    messageId?: string
    llmId?: string
    modelConfigId?: string
  }): Promise<ChatRequestHandle> {
    const workspace = this.requireWorkspace()
    return workspace.write(async () => {
      this.assertReady(workspace, input.pageId)
      const conversation = await workspace.readConversation(input.pageId)
      const message = conversation.messages.find(
        (item) => item.id === (input.messageId ?? conversation.leafMessageId)
      )
      if (!message)
        throw new RuntimeError('chat.message-not-found', msg('errors.chat.targetMissing'))
      return this.startGeneration(
        workspace,
        conversation,
        message.role === 'user' ? message.id : message.parentMessageId,
        {
          llmId: input.llmId ?? message.llmId,
          modelConfigId: input.modelConfigId ?? message.modelConfigId
        }
      )
    })
  }

  private async startGeneration(
    workspace: WorkspaceStore,
    conversation: Conversation,
    parentMessageId: string | undefined,
    input: { llmId?: string; modelConfigId?: string },
    user?: ChatMessage,
    accept?: () => Promise<void>
  ): Promise<ChatRequestHandle> {
    const config = this.resolveConfig(input.llmId, input.modelConfigId)
    const providerMessages = await this.buildProviderMessages(
      workspace,
      conversation,
      parentMessageId
    )
    this.assertReady(workspace, conversation.pageId)
    if (user) {
      await workspace.writeConversation(conversation)
    }
    // 队列移除等准入写入必须先成功，才能发起不可撤销的远端请求。
    await accept?.()
    const assistant = appendMessage(
      conversation,
      {
        id: randomUUID(),
        role: 'assistant',
        content: '',
        parentMessageId,
        llmId: config.llmId,
        modelConfigId: config.modelConfigId
      },
      Date.now()
    ).message
    let markFinished = (): void => undefined
    const finished = new Promise<void>((resolve) => {
      markFinished = resolve
    })
    const request: ActiveRequest = {
      workspace,
      scopeId: this.deps.scope(),
      requestId: randomUUID(),
      pageId: conversation.pageId,
      messageId: assistant.id,
      controller: new AbortController(),
      assistant,
      finished,
      markFinished
    }
    workspace.afterCommit(() => {
      if (user)
        this.emit(
          'conversation.message',
          { pageId: conversation.pageId, message: user },
          request.scopeId
        )
      this.active.set(request.requestId, request)
      if (this.suspended) request.controller.abort()
      this.emit(
        'conversation.message',
        { pageId: request.pageId, message: assistant, requestId: request.requestId },
        request.scopeId
      )
      void this.runStream(request, config, providerMessages)
    })
    return { requestId: request.requestId, messageId: assistant.id }
  }

  private async save(request: ActiveRequest): Promise<void> {
    const { workspace, assistant, pageId } = request
    await workspace.write(async () => {
      if (!workspace.getPage(pageId)) return
      const current = await workspace.readConversation(pageId)
      if (
        assistant.parentMessageId &&
        !current.messages.some((message) => message.id === assistant.parentMessageId)
      )
        return
      const next = current.messages.some((message) => message.id === assistant.id)
        ? updateMessage(current, assistant.id, assistant, Date.now())
        : appendMessage(current, assistant, assistant.createdAt).conversation
      await workspace.writeConversation(next)
    })
  }

  async retrySave(requestId: string): Promise<void> {
    const failed = this.unsaved.get(requestId)
    if (!failed) return
    await this.save(failed.request)
    this.unsaved.delete(requestId)
    this.deps.emit(failed.terminal)
    void this.drain(failed.request.pageId)
  }

  async retryAllSaves(): Promise<void> {
    for (const id of this.unsaved.keys()) await this.retrySave(id)
  }

  private async runStream(
    request: ActiveRequest,
    config: ResolvedConfig,
    providerMessages: ProviderMessage[]
  ): Promise<void> {
    const { requestId, pageId, assistant, controller, scopeId } = request
    const payload = { requestId, pageId, messageId: assistant.id }
    let terminal: RuntimeEvent = { type: 'chat.completed', payload, scopeId }
    try {
      controller.signal.throwIfAborted()
      await streamChat(config.connection, config.parameters, providerMessages, controller.signal, {
        onDelta: (text) => {
          assistant.content += text
          this.emit('chat.delta', { ...payload, text }, scopeId)
        },
        onReasoning: (text) => {
          assistant.reasoning = (assistant.reasoning ?? '') + text
          this.emit('chat.reasoning', { ...payload, text }, scopeId)
        }
      })
      if (controller.signal.aborted) terminal = { type: 'chat.aborted', payload, scopeId }
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted)
        terminal = { type: 'chat.aborted', payload, scopeId }
      else {
        const message = formatError(error, this.deps.t)
        assistant.hasError = true
        assistant.content += this.deps.t('chat.savedError', {
          v0: assistant.content ? '\n\n---\n\n' : '',
          v1: message
        })
        terminal = {
          type: 'chat.failed',
          payload: {
            ...payload,
            error: message,
            ...(error instanceof LocalizedError ? { localized: error.localized } : {})
          },
          scopeId
        }
      }
    }
    try {
      // 已删除的页面不重新创建，无输出的中止不留下空白回答。
      if (
        request.workspace.getPage(pageId) &&
        (assistant.content || assistant.reasoning || terminal.type !== 'chat.aborted')
      )
        await this.save(request)
      this.deps.emit(terminal)
    } catch (error) {
      this.unsaved.set(requestId, { request, terminal })
      this.emit(
        'chat.saveFailed',
        {
          ...payload,
          message: { ...assistant },
          error: formatError(error, this.deps.t),
          ...(error instanceof LocalizedError ? { localized: error.localized } : {})
        },
        scopeId
      )
    } finally {
      this.active.delete(requestId)
      request.markFinished()
      void this.drain(pageId)
    }
  }

  private async buildProviderMessages(
    workspace: WorkspaceStore,
    conversation: Conversation,
    leafMessageId: string | undefined
  ): Promise<ProviderMessage[]> {
    const path = pathToMessage(buildIndex(conversation.messages), leafMessageId)
    const messages: ProviderMessage[] = []
    for (const message of path) {
      if (message.role === 'assistant' && !message.content.trim()) continue
      const parts: Exclude<ProviderMessage['content'], string> = []
      if (message.content.trim()) parts.push({ type: 'text', text: message.content })
      for (const attachment of message.attachments ?? []) {
        if (!attachment.mimeType.startsWith('image/')) continue
        const data = await workspace.readAttachmentAsDataUrl(attachment)
        if (data) parts.push({ type: 'image_url', image_url: { url: data } })
      }
      messages.push({
        role: message.role,
        content: parts.length > 1 ? parts : message.content || parts
      })
    }
    return messages
  }

  private resolveConfig(llmId?: string, modelConfigId?: string): ResolvedConfig {
    const settingsStore = this.deps.settings()
    if (!settingsStore) {
      throw new RuntimeError('settings.unavailable', msg('errors.settings.notLoaded'))
    }

    const settings: Settings = settingsStore.get()
    const targetLlmId = llmId ?? settings.defaultLLMId ?? settings.llmConfigs.items[0]?.id
    const llm = settings.llmConfigs.items.find((item) => item.id === targetLlmId)
    if (!llm) {
      throw new RuntimeError('ai.no-llm-config', msg('errors.ai.noConfig'))
    }

    const apiKey = llm.apiKey
    if (!apiKey) {
      throw new RuntimeError('ai.no-api-key', msg('errors.ai.noKey', { v0: String(llm.name) }))
    }

    const targetModelConfigId =
      modelConfigId ?? settings.defaultModelConfigId ?? settings.modelConfigs.items[0]?.id
    const model = settings.modelConfigs.items.find((item) => item.id === targetModelConfigId)

    return {
      connection: { baseUrl: llm.baseUrl, apiKey, modelName: llm.modelName },
      parameters: {
        systemPrompt: model?.systemPrompt ?? '',
        topP: model?.topP ?? 1,
        temperature: model?.temperature ?? 1
      },
      llmId: llm.id,
      modelConfigId: model?.id
    }
  }

  // ==================== 无界面调用 ====================

  async generateText(input: {
    prompt: string
    llmId?: string
    modelConfigId?: string
  }): Promise<{ content: string; reasoning?: string }> {
    if (this.suspended) throw new RuntimeError('runtime.closing', msg('errors.chat.targetChanged'))
    const config = this.resolveConfig(input.llmId, input.modelConfigId)
    const controller = new AbortController()
    let resolveFinished = (): void => undefined
    this.auxiliary.set(
      controller,
      new Promise<void>((resolve) => {
        resolveFinished = resolve
      })
    )
    try {
      const result = await streamChat(
        config.connection,
        config.parameters,
        [{ role: 'user', content: input.prompt }],
        controller.signal,
        { onDelta: () => undefined, onReasoning: () => undefined }
      )
      if (controller.signal.aborted)
        throw new RuntimeError('chat.aborted', msg('errors.chat.targetMissing'))
      return { content: result.content.trim(), reasoning: result.reasoning || undefined }
    } finally {
      this.auxiliary.delete(controller)
      resolveFinished()
    }
  }

  async generateMessageTitle(input: {
    pageId: string
    messageId: string
    llmId?: string
    modelConfigId?: string
    extraRequirements?: string
  }): Promise<string> {
    const workspace = this.requireWorkspace()
    const conversation = await workspace.read(() => workspace.readConversation(input.pageId))
    if (workspace !== this.deps.workspace() || this.suspended)
      throw new RuntimeError('runtime.stale-scope', msg('errors.workspace.changed'))
    const message = conversation.messages.find((item) => item.id === input.messageId)
    if (!message) {
      throw new RuntimeError(
        'chat.message-not-found',
        msg('errors.chat.messageMissingId', { v0: String(input.messageId) })
      )
    }

    const language = this.deps.language()
    const { content } = await this.generateText({
      prompt: buildLocalizedTitlePrompt(
        'message',
        language,
        message.content,
        input.extraRequirements
      ),
      llmId: input.llmId,
      modelConfigId: input.modelConfigId
    })
    const title = normalizeTitle(content, language === 'zh-CN' ? 15 : 60)
    if (!title) throw new RuntimeError('chat.title-empty', msg('errors.ai.emptyTitle'))

    await workspace.write(() =>
      workspace.mutateConversation(input.pageId, (current) => {
        if (
          workspace !== this.deps.workspace() ||
          this.suspended ||
          !current.messages.some((item) => item.id === message.id)
        )
          throw new RuntimeError('runtime.stale-scope', msg('errors.chat.targetChanged'))
        return {
          conversation: updateMessage(current, message.id, { title }, Date.now()),
          result: undefined
        }
      })
    )
    this.emit('conversation.changed', { pageId: input.pageId })
    return title
  }

  async generateTopicTitle(input: {
    pageId: string
    topicId: string
    llmId?: string
    modelConfigId?: string
    extraRequirements?: string
  }): Promise<string> {
    const workspace = this.requireWorkspace()
    const conversation = await workspace.read(() => workspace.readConversation(input.pageId))
    if (workspace !== this.deps.workspace() || this.suspended)
      throw new RuntimeError('runtime.stale-scope', msg('errors.workspace.changed'))
    const topic = conversation.topics.find((item) => item.id === input.topicId)
    if (!topic) {
      throw new RuntimeError(
        'topic.not-found',
        msg('errors.chat.topicMissingId', { v0: String(input.topicId) })
      )
    }

    const index = buildIndex(conversation.messages)
    const path = currentPath(conversation)
    const group = computeTopicGroups(conversation.topics, path).find(
      (item) => item.topicId === topic.id
    )
    const ids = group?.messageIds ?? [topic.startMessageId]
    const content = ids
      .map((id) => index.byId.get(id))
      .filter((message): message is ChatMessage => Boolean(message))
      .map(
        (message) =>
          `${message.role === 'user' ? this.deps.t('roles.user') : this.deps.t('roles.assistant')}：${message.content}`
      )
      .join('\n\n')

    const language = this.deps.language()
    const { content: generated } = await this.generateText({
      prompt: buildLocalizedTitlePrompt('topic', language, content, input.extraRequirements),
      llmId: input.llmId,
      modelConfigId: input.modelConfigId
    })
    const name = normalizeTitle(generated, language === 'zh-CN' ? 15 : 60)
    if (!name) throw new RuntimeError('chat.title-empty', msg('errors.ai.emptyTopic'))

    await workspace.write(() =>
      workspace.mutateConversation(input.pageId, (current) => {
        if (
          workspace !== this.deps.workspace() ||
          this.suspended ||
          !current.topics.some((item) => item.id === topic.id)
        )
          throw new RuntimeError('runtime.stale-scope', msg('errors.chat.targetChanged'))
        return {
          conversation: updateTopic(current, topic.id, { name }, Date.now()),
          result: undefined
        }
      })
    )
    this.emit('conversation.changed', { pageId: input.pageId })
    return name
  }

  async generateSessionTitle(input: {
    pageId: string
    llmId?: string
    modelConfigId?: string
    extraRequirements?: string
  }): Promise<string> {
    const workspace = this.requireWorkspace()
    const conversation = await workspace.read(() => workspace.readConversation(input.pageId))
    if (workspace !== this.deps.workspace() || this.suspended)
      throw new RuntimeError('runtime.stale-scope', msg('errors.workspace.changed'))
    const path = currentPath(conversation)
    const content = path
      .slice(0, 10)
      .map(
        (message) =>
          `${message.role === 'user' ? this.deps.t('roles.user') : this.deps.t('roles.assistant')}：${truncateForPrompt(message.content, 200)}`
      )
      .join('\n')

    const language = this.deps.language()
    const { content: generated } = await this.generateText({
      prompt: buildLocalizedTitlePrompt(
        'session',
        language,
        content,
        input.extraRequirements,
        1500
      ),
      llmId: input.llmId,
      modelConfigId: input.modelConfigId
    })
    const title = normalizeTitle(generated, language === 'zh-CN' ? 20 : 80)
    if (!title) throw new RuntimeError('chat.title-empty', msg('errors.ai.emptyTitle'))

    await workspace.write(async () => {
      if (workspace !== this.deps.workspace() || this.suspended)
        throw new RuntimeError('runtime.stale-scope', msg('errors.chat.messageMissing'))
      await workspace.updatePage(input.pageId, { name: title }, Date.now())
    })
    const page = workspace.getPage(input.pageId)
    if (page) this.emit('page.changed', { page })
    return title
  }

  // ==================== 消息队列 ====================

  /** 队列在会话空闲时自动出队发送 */
  async drain(pageId: string): Promise<void> {
    const queues = this.deps.queues()
    const workspace = this.deps.workspace()
    if (!queues || !workspace || this.suspended) return
    try {
      await workspace.write(async () => {
        if (
          this.suspended ||
          this.isPageBusy(pageId) ||
          workspace !== this.deps.workspace() ||
          !workspace.getPage(pageId)
        )
          return
        const queue = await queues.get(pageId)
        const item = queue.items[0]
        if (queue.paused || !item) return
        await this.sendInside(workspace, { pageId, content: item.content }, async () => {
          await queues.remove(pageId, item.id)
        })
        workspace.afterCommit(() => this.emit('queue.changed', { pageId }))
      })
    } catch (error) {
      console.warn('[runtime] 队列启动失败，已保留队列项', error)
    }
  }

  private emit<K extends RuntimeEventName>(
    type: K,
    payload: RuntimeEventPayload<K>,
    scopeId = this.deps.scope()
  ): void {
    this.deps.emit({ type, payload, scopeId } as RuntimeEvent)
  }

  private requireWorkspace(): WorkspaceStore {
    const workspace = this.deps.workspace()
    if (!workspace) {
      throw new RuntimeError('workspace.unavailable', msg('errors.workspace.notOpen'))
    }
    return workspace
  }
}
