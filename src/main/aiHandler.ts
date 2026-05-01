import { ipcMain } from 'electron'
import { createParser, type EventSourceParser } from 'eventsource-parser'
import { readFile } from 'fs/promises'
import type {
  AIContentPart,
  AIRequest,
  AIStreamChunk,
  ChatMessage,
  LLMConfig,
  ModelConfig
} from '../shared/ai'
import { resolveAttachmentPathForAI } from './attachmentStorage'

type RequestStatus = 'running' | 'completed' | 'failed' | 'aborted'

interface RequestState {
  event: Electron.IpcMainInvokeEvent
  eventChannel: string
  fullResponse: string
  fullReasoning: string
  status: RequestStatus
}

class AIHandler {
  private abortControllers = new Map<string, AbortController>()
  private requestStates = new Map<string, RequestState>()

  private initRequestState(
    requestId: string,
    event: Electron.IpcMainInvokeEvent,
    eventChannel: string
  ): void {
    this.requestStates.set(requestId, {
      event,
      eventChannel,
      fullResponse: '',
      fullReasoning: '',
      status: 'running'
    })
  }

  private cleanupRequest(requestId: string): void {
    this.abortControllers.delete(requestId)
    this.requestStates.delete(requestId)
  }

  private emitChunk(requestId: string, content: string): void {
    const state = this.requestStates.get(requestId)
    if (!state || state.status !== 'running') {
      return
    }

    state.fullResponse += content
    state.event.sender.send(state.eventChannel, {
      requestId,
      type: 'chunk',
      content
    } as AIStreamChunk)
  }

  private emitReasoning(requestId: string, reasoning: string): void {
    const state = this.requestStates.get(requestId)
    if (!state || state.status !== 'running') {
      return
    }

    state.fullReasoning += reasoning
    state.event.sender.send(state.eventChannel, {
      requestId,
      type: 'reasoning_content',
      reasoning_content: reasoning
    } as AIStreamChunk)
  }

  private finalizeComplete(requestId: string): void {
    const state = this.requestStates.get(requestId)
    if (!state || (state.status !== 'running' && state.status !== 'aborted')) {
      return
    }

    state.status = 'completed'
    state.event.sender.send(state.eventChannel, {
      requestId,
      type: 'complete',
      content: state.fullResponse,
      reasoning_content: state.fullReasoning || undefined
    } as AIStreamChunk)

    this.cleanupRequest(requestId)
  }

  private finalizeError(requestId: string, error: string): void {
    const state = this.requestStates.get(requestId)
    if (!state || state.status !== 'running') {
      return
    }

    state.status = 'failed'
    state.event.sender.send(state.eventChannel, {
      requestId,
      type: 'error',
      error
    } as AIStreamChunk)

    this.cleanupRequest(requestId)
  }

  private finalizeTerminalError(requestId: string, error: string): void {
    const state = this.requestStates.get(requestId)
    if (!state) {
      return
    }

    if (state.status === 'aborted') {
      this.finalizeComplete(requestId)
      return
    }

    this.finalizeError(requestId, error)
  }

  private getModelConfig(modelConfig?: ModelConfig): ModelConfig {
    return (
      modelConfig || {
        systemPrompt: '',
        topP: 1,
        temperature: 1
      }
    )
  }

  private async prepareApiMessages(
    messages: ChatMessage[],
    modelConfig: ModelConfig
  ): Promise<ChatMessage[]> {
    const apiMessages = await Promise.all(
      messages.map(async (message) => {
        if (!message.attachments || message.attachments.length === 0) {
          return {
            role: message.role,
            content: message.content
          }
        }

        const contentParts: AIContentPart[] = []

        if (typeof message.content === 'string' && message.content.trim()) {
          contentParts.push({
            type: 'text',
            text: message.content
          })
        }

        for (const attachment of message.attachments) {
          if (!attachment.type.startsWith('image/')) {
            continue
          }

          try {
            const filePath = await resolveAttachmentPathForAI(attachment.localPath)
            const buffer = await readFile(filePath)
            contentParts.push({
              type: 'image_url',
              image_url: {
                url: `data:${attachment.type};base64,${buffer.toString('base64')}`
              }
            })
          } catch (error) {
            console.error('Failed to read attachment for AI request:', attachment.localPath, error)
          }
        }

        return {
          role: message.role,
          content: contentParts
        }
      })
    )

    if (
      modelConfig.systemPrompt &&
      (apiMessages.length === 0 || apiMessages[0].role !== 'system')
    ) {
      apiMessages.unshift({
        role: 'system',
        content: modelConfig.systemPrompt
      })
    }

    return apiMessages
  }

  private async fetchStreamingResponse(
    request: AIRequest,
    apiMessages: ChatMessage[],
    modelConfig: ModelConfig,
    abortController: AbortController
  ): Promise<Response> {
    return fetch(`${request.llmConfig.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${request.llmConfig.apiKey}`
      },
      body: JSON.stringify({
        model: request.llmConfig.modelName,
        messages: apiMessages,
        temperature: modelConfig.temperature,
        top_p: modelConfig.topP,
        stream: true
      }),
      signal: abortController.signal
    })
  }

  private createStreamParser(requestId: string): EventSourceParser {
    return createParser({
      onEvent: (eventData) => {
        if (eventData.data === '[DONE]') {
          return
        }

        try {
          const parsed = JSON.parse(eventData.data)
          const delta = parsed.choices?.[0]?.delta
          const content = delta?.content
          const reasoningContent =
            delta?.reasoning_content ||
            delta?.reasoning ||
            parsed.reasoning_content ||
            parsed.reasoning

          if (content) {
            this.emitChunk(requestId, content)
          }

          if (reasoningContent) {
            this.emitReasoning(requestId, reasoningContent)
          }
        } catch (error) {
          console.warn('Failed to parse streaming data:', error)
        }
      }
    })
  }

  private async processStreamResponse(
    requestId: string,
    reader: ReadableStreamDefaultReader<Uint8Array>,
    parser: EventSourceParser
  ): Promise<void> {
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        parser.feed(decoder.decode(value, { stream: true }))
      }

      this.finalizeComplete(requestId)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.finalizeComplete(requestId)
        return
      }

      this.finalizeTerminalError(
        requestId,
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  public async sendMessageStreaming(
    event: Electron.IpcMainInvokeEvent,
    request: AIRequest,
    eventChannel: string
  ): Promise<void> {
    const abortController = new AbortController()
    this.abortControllers.set(request.requestId, abortController)
    this.initRequestState(request.requestId, event, eventChannel)

    try {
      const modelConfig = this.getModelConfig(request.modelConfig)
      const apiMessages = await this.prepareApiMessages(request.messages, modelConfig)
      const response = await this.fetchStreamingResponse(
        request,
        apiMessages,
        modelConfig,
        abortController
      )

      if (!response.ok) {
        let errorDetail = ''
        try {
          const errorBody = await response.text()
          const parsed = JSON.parse(errorBody)
          errorDetail = parsed.error?.message || parsed.message || errorBody
        } catch {
          errorDetail = response.statusText
        }

        this.finalizeTerminalError(request.requestId, `HTTP ${response.status}: ${errorDetail}`)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        this.finalizeTerminalError(request.requestId, 'No response body reader available')
        return
      }

      const parser = this.createStreamParser(request.requestId)
      await this.processStreamResponse(request.requestId, reader, parser)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.finalizeComplete(request.requestId)
        return
      }

      this.finalizeTerminalError(
        request.requestId,
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  public async stopStreaming(requestId: string): Promise<void> {
    const abortController = this.abortControllers.get(requestId)
    const state = this.requestStates.get(requestId)

    if (state && state.status === 'running') {
      state.status = 'aborted'
    }

    if (abortController) {
      abortController.abort()
    }
  }

  public async testConnection(config: LLMConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.modelName,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5
        })
      })

      if (response.ok) {
        return { success: true }
      }

      const errorText = await response.text()
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText || response.statusText}`
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }
    }
  }

  public async getModels(
    config: LLMConfig
  ): Promise<{ success: boolean; models?: string[]; error?: string }> {
    try {
      const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`
        }
      })

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }

      const data = await response.json()
      const models = data.data?.map((model: { id: string }) => model.id) || []
      return { success: true, models }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch models'
      }
    }
  }
}

export const aiHandler = new AIHandler()

export function setupAIHandlers(): void {
  ipcMain.handle('ai:send-message-streaming', (event, request: AIRequest, eventChannel: string) =>
    aiHandler.sendMessageStreaming(event, request, eventChannel)
  )
  ipcMain.handle('ai:stop-streaming', (_event, requestId: string) =>
    aiHandler.stopStreaming(requestId)
  )
  ipcMain.handle('ai:test-connection', (_event, config: LLMConfig) =>
    aiHandler.testConnection(config)
  )
  ipcMain.handle('ai:get-models', (_event, config: LLMConfig) => aiHandler.getModels(config))
}
