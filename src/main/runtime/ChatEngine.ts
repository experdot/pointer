/**
 * 对话执行引擎
 *
 * 负责流式请求的完整生命周期：上下文构造、事件推送、落盘时机、中止与错误处理。
 * 落盘策略：流式过程中不写盘；用户消息立即落盘，助手消息在结束（完成/中止/失败）时落盘一次。
 */

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
import type { RuntimeEvent } from '@shared/contracts'
import { RuntimeError } from '@shared/contracts'
import type { SettingsStore } from './SettingsStore'
import type { WorkspaceStore } from './WorkspaceStore'
import type { QueueStore } from './QueueStore'
import type { ProviderMessage } from './providers'
import { isAbortError, streamChat } from './providers'
import {
  MESSAGE_TITLE_PROMPT,
  SESSION_TITLE_PROMPT,
  TOPIC_TITLE_PROMPT,
  applyExtraRequirements,
  buildPrompt,
  normalizeTitle,
  truncateForPrompt
} from '@shared/domain'

export interface ChatEngineDeps {
  workspace: () => WorkspaceStore | null
  settings: () => SettingsStore | null
  queues: () => QueueStore | null
  emit: (event: RuntimeEvent) => void
}

export interface ChatRequestHandle {
  requestId: string
  messageId: string
}

export interface SendInput {
  pageId: string
  content: string
  attachments?: AttachmentRef[]
  parentMessageId?: string
  llmId?: string
  modelConfigId?: string
}

interface ActiveRequest {
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

  constructor(private readonly deps: ChatEngineDeps) {}

  isPageBusy(pageId: string): boolean {
    return [...this.active.values()].some((request) => request.pageId === pageId)
  }

  /**
   * 中止全部生成并等待收尾落盘
   *
   * 切换账户/工作区前必须调用：否则收尾时会写到新打开的上下文里，
   * 迁移前的切换事务同样是"先停止活动任务再切换"。
   */
  async abortAll(): Promise<void> {
    const pending = [...this.active.values()]
    if (pending.length === 0) return

    for (const request of pending) request.controller.abort()
    await Promise.all(pending.map((request) => request.finished))
  }

  async stop(requestId: string): Promise<void> {
    const request = this.active.get(requestId)
    if (!request) return
    request.controller.abort()
  }

  /**
   * 按页面中止生成
   *
   * 覆盖内核侧发起的生成（例如消息队列自动发送）：渲染进程没有请求句柄，
   * 但同样需要能停止当前页面的输出。
   */
  async stopPage(pageId: string): Promise<void> {
    for (const request of this.active.values()) {
      if (request.pageId === pageId) request.controller.abort()
    }
  }

  async send(input: SendInput): Promise<ChatRequestHandle> {
    const workspace = this.requireWorkspace()
    const at = Date.now()
    let conversation = await workspace.readConversation(input.pageId)

    const requestedParent =
      input.parentMessageId && conversation.messages.some((m) => m.id === input.parentMessageId)
        ? input.parentMessageId
        : conversation.leafMessageId

    let userMessage: ChatMessage | undefined
    const hasContent = input.content.trim().length > 0 || (input.attachments?.length ?? 0) > 0
    if (hasContent) {
      const appended = appendMessage(
        conversation,
        {
          id: randomUUID(),
          role: 'user',
          content: input.content,
          attachments: input.attachments,
          parentMessageId: requestedParent
        },
        at
      )
      conversation = appended.conversation
      userMessage = appended.message
      await workspace.writeConversation(conversation)
      this.emit('conversation.message', { pageId: input.pageId, message: userMessage })
    }

    const parentForAssistant = userMessage?.id ?? requestedParent

    return this.startGeneration({
      pageId: input.pageId,
      parentMessageId: parentForAssistant,
      conversation,
      llmId: input.llmId,
      modelConfigId: input.modelConfigId,
      at
    })
  }

  /** 重新生成：以目标助手消息为参照，在其父节点下创建新的分支 */
  async regenerate(input: {
    pageId: string
    messageId: string
    llmId?: string
    modelConfigId?: string
  }): Promise<ChatRequestHandle> {
    const workspace = this.requireWorkspace()
    const conversation = await workspace.readConversation(input.pageId)
    const message = conversation.messages.find((item) => item.id === input.messageId)
    if (!message) {
      throw new RuntimeError('chat.message-not-found', `消息不存在：${input.messageId}`)
    }

    const at = Date.now()
    return this.startGeneration({
      pageId: input.pageId,
      parentMessageId: message.parentMessageId,
      conversation,
      llmId: input.llmId ?? message.llmId,
      modelConfigId: input.modelConfigId ?? message.modelConfigId,
      at
    })
  }

  /** 继续：针对某条用户消息重新生成回答（同样产生新分支） */
  async continueFromUserMessage(input: {
    pageId: string
    messageId?: string
    llmId?: string
    modelConfigId?: string
  }): Promise<ChatRequestHandle> {
    const workspace = this.requireWorkspace()
    const conversation = await workspace.readConversation(input.pageId)

    const targetId = input.messageId ?? conversation.leafMessageId
    const message = conversation.messages.find((item) => item.id === targetId)
    if (!message) {
      throw new RuntimeError('chat.message-not-found', `消息不存在：${String(targetId)}`)
    }

    const parentMessageId = message.role === 'user' ? message.id : message.parentMessageId
    const at = Date.now()
    return this.startGeneration({
      pageId: input.pageId,
      parentMessageId,
      conversation,
      llmId: input.llmId ?? message.llmId,
      modelConfigId: input.modelConfigId ?? message.modelConfigId,
      at
    })
  }

  // ==================== 内部实现 ====================

  private async startGeneration(input: {
    pageId: string
    parentMessageId?: string
    conversation: Conversation
    llmId?: string
    modelConfigId?: string
    at: number
  }): Promise<ChatRequestHandle> {
    let config: ResolvedConfig
    try {
      config = this.resolveConfig(input.llmId, input.modelConfigId)
    } catch (error) {
      // 启动前失败（缺少 LLM 配置 / API Key）：先落一条带原因的错误消息，再抛给界面提示
      await this.persistConfigFailure(input, error)
      throw error
    }

    const appended = appendMessage(
      input.conversation,
      {
        id: randomUUID(),
        role: 'assistant',
        content: '',
        parentMessageId: input.parentMessageId,
        llmId: config.llmId,
        modelConfigId: config.modelConfigId
      },
      input.at
    )

    const assistant = appended.message
    const requestId = randomUUID()
    const controller = new AbortController()
    let markFinished = (): void => undefined
    const finished = new Promise<void>((resolve) => {
      markFinished = resolve
    })
    this.active.set(requestId, {
      requestId,
      pageId: input.pageId,
      messageId: assistant.id,
      controller,
      assistant,
      finished,
      markFinished
    })

    // 助手占位消息先推送给界面，不落盘
    this.emit('conversation.message', { pageId: input.pageId, message: assistant })

    const providerMessages = await this.buildProviderMessages(
      input.conversation,
      input.parentMessageId
    )

    void this.runStream({
      requestId,
      pageId: input.pageId,
      assistant,
      config,
      providerMessages,
      signal: controller.signal
    })

    return { requestId, messageId: assistant.id }
  }

  /**
   * 启动前失败：与迁移前一致，把失败原因写入一条助手消息，
   * 保证用户在会话里能看到原因（异常仍向上抛，供界面 toast）。
   */
  private async persistConfigFailure(
    input: { pageId: string; parentMessageId?: string; conversation: Conversation; at: number },
    error: unknown
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[runtime] 生成失败：', message)

    const workspace = this.deps.workspace()
    if (!workspace) return

    try {
      const appended = appendMessage(
        input.conversation,
        {
          id: randomUUID(),
          role: 'assistant',
          content: `**错误:** ${message}`,
          parentMessageId: input.parentMessageId,
          hasError: true
        },
        input.at
      )
      await workspace.writeConversation(appended.conversation)
      this.emit('conversation.message', { pageId: input.pageId, message: appended.message })
      this.emit('chat.failed', {
        requestId: randomUUID(),
        pageId: input.pageId,
        messageId: appended.message.id,
        error: message
      })
    } catch (writeError) {
      console.error('[runtime] 写入错误消息失败：', writeError)
    }
  }

  private async runStream(input: {
    requestId: string
    pageId: string
    assistant: ChatMessage
    config: ResolvedConfig
    providerMessages: ProviderMessage[]
    signal: AbortSignal
  }): Promise<void> {
    const { requestId, pageId, assistant, signal } = input

    /** 收尾：广播终态事件、释放请求并检查队列（不写盘） */
    const finish = (event: RuntimeEvent): void => {
      this.emit(event.type, event.payload as never)
      const request = this.active.get(requestId)
      request?.markFinished()
      this.active.delete(requestId)
      void this.drain(pageId)
    }

    const finalize = async (patch: Partial<ChatMessage>, event: RuntimeEvent): Promise<void> => {
      const workspace = this.deps.workspace()
      if (!workspace) {
        finish(event)
        return
      }

      try {
        const current = await workspace.readConversation(pageId)
        const now = Date.now()
        const existing = current.messages.some((message) => message.id === assistant.id)
        const next = existing
          ? updateMessage(current, assistant.id, patch, now)
          : appendMessage(
              current,
              {
                id: assistant.id,
                role: 'assistant',
                content: patch.content ?? '',
                reasoning: patch.reasoning,
                parentMessageId: assistant.parentMessageId,
                llmId: assistant.llmId,
                modelConfigId: assistant.modelConfigId,
                hasError: patch.hasError
              },
              now
            ).conversation
        await workspace.writeConversation(next)
      } catch (error) {
        console.error('[runtime] 保存助手消息失败：', error)
      }

      finish(event)
    }

    try {
      const streamed = await streamChat(
        input.config.connection,
        input.config.parameters,
        input.providerMessages,
        signal,
        {
          onDelta: (text) => {
            assistant.content += text
            this.emit('chat.delta', { requestId, pageId, messageId: assistant.id, text })
          },
          onReasoning: (text) => {
            assistant.reasoning = `${assistant.reasoning ?? ''}${text}`
            this.emit('chat.reasoning', { requestId, pageId, messageId: assistant.id, text })
          }
        }
      )

      const content = streamed.content
      const reasoning = assistant.reasoning ?? streamed.reasoning

      if (signal.aborted) {
        const event: RuntimeEvent = {
          type: 'chat.aborted',
          payload: { requestId, pageId, messageId: assistant.id }
        }
        if (!content) {
          // 与迁移前一致：没有任何正文输出就被停止的占位消息直接移除，不落盘
          finish(event)
          return
        }
        await finalize({ content, reasoning }, event)
        return
      }

      await finalize(
        { content, reasoning, hasError: false },
        { type: 'chat.completed', payload: { requestId, pageId, messageId: assistant.id } }
      )
    } catch (error) {
      if (isAbortError(error) || signal.aborted) {
        const event: RuntimeEvent = {
          type: 'chat.aborted',
          payload: { requestId, pageId, messageId: assistant.id }
        }
        if (!assistant.content) {
          finish(event)
          return
        }
        await finalize({ content: assistant.content, reasoning: assistant.reasoning }, event)
        return
      }

      const message = error instanceof Error ? error.message : String(error)
      console.error('[runtime] 生成失败：', message)
      // 与迁移前一致：把失败原因并入消息内容，用户可直接看到
      const errorContent = assistant.content
        ? `${assistant.content}\n\n---\n\n**错误:** ${message}`
        : `**错误:** ${message}`
      await finalize(
        { content: errorContent, reasoning: assistant.reasoning, hasError: true },
        {
          type: 'chat.failed',
          payload: { requestId, pageId, messageId: assistant.id, error: message }
        }
      )
    }
  }

  /** 把路径上的消息转换为供应商请求格式，附件按图片内联 */
  private async buildProviderMessages(
    conversation: Conversation,
    leafMessageId: string | undefined
  ): Promise<ProviderMessage[]> {
    const workspace = this.requireWorkspace()
    const index = buildIndex(conversation.messages)
    const path = pathToMessage(index, leafMessageId)

    const messages: ProviderMessage[] = []
    for (const message of path) {
      if (message.role === 'assistant' && !message.content.trim()) continue

      const attachments = message.attachments ?? []
      if (attachments.length === 0) {
        messages.push({ role: message.role, content: message.content })
        continue
      }

      const parts: ProviderMessage['content'] = []
      if (message.content.trim()) {
        parts.push({ type: 'text', text: message.content })
      }
      for (const attachment of attachments) {
        if (!attachment.mimeType.startsWith('image/')) continue
        const data = await workspace.readAttachmentAsDataUrl(attachment)
        if (data) parts.push({ type: 'image_url', image_url: { url: data } })
      }
      messages.push({ role: message.role, content: parts.length > 0 ? parts : message.content })
    }

    return messages
  }

  private resolveConfig(llmId?: string, modelConfigId?: string): ResolvedConfig {
    const settingsStore = this.deps.settings()
    if (!settingsStore) {
      throw new RuntimeError('settings.unavailable', '尚未加载账户设置')
    }

    const settings: Settings = settingsStore.get()
    const targetLlmId = llmId ?? settings.defaultLLMId ?? settings.llmConfigs.items[0]?.id
    const llm = settings.llmConfigs.items.find((item) => item.id === targetLlmId)
    if (!llm) {
      throw new RuntimeError('ai.no-llm-config', '未找到可用的 LLM 配置')
    }

    const apiKey = llm.apiKey
    if (!apiKey) {
      throw new RuntimeError('ai.no-api-key', `LLM 配置「${llm.name}」缺少 API Key`)
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
    const config = this.resolveConfig(input.llmId, input.modelConfigId)
    const controller = new AbortController()
    const { content, reasoning: reasoningText } = await streamChat(
      config.connection,
      config.parameters,
      [{ role: 'user', content: input.prompt }],
      controller.signal,
      { onDelta: () => undefined, onReasoning: () => undefined }
    )

    return { content: content.trim(), reasoning: reasoningText || undefined }
  }

  async generateMessageTitle(input: {
    pageId: string
    messageId: string
    llmId?: string
    modelConfigId?: string
    extraRequirements?: string
  }): Promise<string> {
    const workspace = this.requireWorkspace()
    const conversation = await workspace.readConversation(input.pageId)
    const message = conversation.messages.find((item) => item.id === input.messageId)
    if (!message) {
      throw new RuntimeError('chat.message-not-found', `消息不存在：${input.messageId}`)
    }

    const { content } = await this.generateText({
      prompt: applyExtraRequirements(
        buildPrompt(MESSAGE_TITLE_PROMPT, message.content),
        input.extraRequirements
      ),
      llmId: input.llmId,
      modelConfigId: input.modelConfigId
    })
    const title = normalizeTitle(content, 15)
    if (!title) throw new RuntimeError('chat.title-empty', '模型未返回有效标题')

    const next = updateMessage(conversation, message.id, { title }, Date.now())
    await workspace.writeConversation(next)
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
    const conversation = await workspace.readConversation(input.pageId)
    const topic = conversation.topics.find((item) => item.id === input.topicId)
    if (!topic) {
      throw new RuntimeError('topic.not-found', `Topic 不存在：${input.topicId}`)
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
      .map((message) => `${message.role === 'user' ? '用户' : '助手'}：${message.content}`)
      .join('\n\n')

    const { content: generated } = await this.generateText({
      prompt: applyExtraRequirements(
        buildPrompt(TOPIC_TITLE_PROMPT, content),
        input.extraRequirements
      ),
      llmId: input.llmId,
      modelConfigId: input.modelConfigId
    })
    const name = normalizeTitle(generated, 15)
    if (!name) throw new RuntimeError('chat.title-empty', '模型未返回有效话题名称')

    const next = updateTopic(conversation, topic.id, { name }, Date.now())
    await workspace.writeConversation(next)
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
    const conversation = await workspace.readConversation(input.pageId)
    const path = currentPath(conversation)
    const content = path
      .slice(0, 10)
      .map(
        (message) =>
          `${message.role === 'user' ? '用户' : '助手'}：${truncateForPrompt(message.content, 200)}`
      )
      .join('\n')

    const { content: generated } = await this.generateText({
      prompt: applyExtraRequirements(
        buildPrompt(SESSION_TITLE_PROMPT, content, 1500),
        input.extraRequirements
      ),
      llmId: input.llmId,
      modelConfigId: input.modelConfigId
    })
    const title = normalizeTitle(generated, 20)
    if (!title) throw new RuntimeError('chat.title-empty', '模型未返回有效标题')

    await workspace.updatePage(input.pageId, { name: title }, Date.now())
    const page = workspace.getPage(input.pageId)
    if (page) this.emit('page.changed', { page })
    return title
  }

  // ==================== 消息队列 ====================

  /** 队列在会话空闲时自动出队发送 */
  async drain(pageId: string): Promise<void> {
    const queues = this.deps.queues()
    const workspace = this.deps.workspace()
    if (!queues || !workspace) return

    const queue = await queues.get(pageId)
    if (queue.paused || queue.items.length === 0) return
    if (this.isPageBusy(pageId)) return

    const { item } = await queues.shift(pageId)
    if (!item) return

    this.emit('queue.changed', { pageId })

    try {
      await this.send({ pageId, content: item.content })
    } catch (error) {
      console.error('[runtime] 队列消息发送失败：', error)
    }
  }

  private emit(type: RuntimeEvent['type'], payload: unknown): void {
    this.deps.emit({ type, payload } as RuntimeEvent)
  }

  private requireWorkspace(): WorkspaceStore {
    const workspace = this.deps.workspace()
    if (!workspace) {
      throw new RuntimeError('workspace.unavailable', '尚未打开工作区')
    }
    return workspace
  }
}
