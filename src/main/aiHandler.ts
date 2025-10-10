import { ipcMain } from 'electron'
import { createParser } from 'eventsource-parser'

export interface LLMConfig {
  apiHost: string
  apiKey: string
  modelName: string
}

export interface ModelConfig {
  systemPrompt: string
  topP: number
  temperature: number
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIRequest {
  requestId: string
  llmConfig: LLMConfig
  modelConfig: ModelConfig
  messages: ChatMessage[]
}

export interface AIStreamChunk {
  requestId: string
  type: 'chunk' | 'complete' | 'error' | 'reasoning_content'
  content?: string
  reasoning_content?: string
  error?: string
}

class AIHandler {
  // 使用 Map 管理多个并行请求的 AbortController
  private abortControllers = new Map<string, AbortController>()

  /**
   * 准备 API 消息数组，处理 systemPrompt
   */
  private prepareApiMessages(messages: ChatMessage[], modelConfig: ModelConfig): ChatMessage[] {
    const apiMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content
    }))

    // 如果有systemPrompt且第一条消息不是system消息，则插入system消息
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

  /**
   * 获取或创建默认的 ModelConfig
   */
  private getModelConfig(modelConfig?: ModelConfig): ModelConfig {
    return (
      modelConfig || {
        systemPrompt: '',
        topP: 1,
        temperature: 1
      }
    )
  }

  /**
   * 发送错误消息给渲染进程
   */
  private sendError(event: Electron.IpcMainInvokeEvent, eventChannel: string, error: string): void {
    event.sender.send(eventChannel, {
      type: 'error',
      error
    } as AIStreamChunk)
  }

  /**
   * 发送完成消息给渲染进程
   */
  private sendComplete(
    event: Electron.IpcMainInvokeEvent,
    eventChannel: string,
    content: string,
    reasoning_content?: string
  ): void {
    event.sender.send(eventChannel, {
      type: 'complete',
      content,
      reasoning_content: reasoning_content || undefined
    } as AIStreamChunk)
  }

  /**
   * 创建并发送 API 请求
   */
  private async fetchStreamingResponse(
    request: AIRequest,
    apiMessages: ChatMessage[],
    modelConfig: ModelConfig,
    abortController: AbortController
  ): Promise<Response> {
    return await fetch(`${request.llmConfig.apiHost.replace(/\/$/, '')}/chat/completions`, {
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

  /**
   * 创建 SSE 事件解析器
   */
  private createStreamParser(
    event: Electron.IpcMainInvokeEvent,
    eventChannel: string,
    fullResponse: { value: string },
    fullReasoning: { value: string }
  ) {
    return createParser({
      onEvent: (eventData) => {
        if (eventData.data === '[DONE]') {
          this.sendComplete(event, eventChannel, fullResponse.value, fullReasoning.value)
          return
        }

        try {
          const parsed = JSON.parse(eventData.data)
          const delta = parsed.choices?.[0]?.delta
          const content = delta?.content
          const reasoning_content =
            delta?.reasoning_content ||
            delta?.reasoning ||
            parsed.reasoning_content ||
            parsed?.reasoning

          if (content) {
            fullResponse.value += content
            event.sender.send(eventChannel, {
              type: 'chunk',
              content: content
            } as AIStreamChunk)
          }

          if (reasoning_content) {
            fullReasoning.value += reasoning_content
            event.sender.send(eventChannel, {
              type: 'reasoning_content',
              reasoning_content: reasoning_content
            } as AIStreamChunk)
          }
        } catch (e) {
          console.warn('Failed to parse streaming data:', e)
        }
      }
    })
  }

  /**
   * 处理流式响应
   */
  private async processStreamResponse(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    parser: ReturnType<typeof createParser>,
    event: Electron.IpcMainInvokeEvent,
    eventChannel: string,
    fullResponse: { value: string },
    fullReasoning: { value: string }
  ): Promise<void> {
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        parser.feed(chunk)
      }

      this.sendComplete(event, eventChannel, fullResponse.value, fullReasoning.value)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.sendComplete(event, eventChannel, fullResponse.value, fullReasoning.value)
      } else {
        this.sendError(
          event,
          eventChannel,
          error instanceof Error ? error.message : 'Unknown error'
        )
      }
    }
  }

  public async sendMessageStreaming(
    event: Electron.IpcMainInvokeEvent,
    request: AIRequest,
    eventChannel: string
  ): Promise<void> {
    const abortController = new AbortController()
    this.abortControllers.set(request.requestId, abortController)

    try {
      const modelConfig = this.getModelConfig(request.modelConfig)
      const apiMessages = this.prepareApiMessages(request.messages, modelConfig)

      const response = await this.fetchStreamingResponse(
        request,
        apiMessages,
        modelConfig,
        abortController
      )

      if (!response.ok) {
        this.sendError(event, eventChannel, `HTTP error! status: ${response.status}`)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        this.sendError(event, eventChannel, 'No response body reader available')
        return
      }

      const fullResponse = { value: '' }
      const fullReasoning = { value: '' }

      const parser = this.createStreamParser(
        event,
        eventChannel,
        fullResponse,
        fullReasoning
      )

      await this.processStreamResponse(
        reader,
        parser,
        event,
        eventChannel,
        fullResponse,
        fullReasoning
      )
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.sendComplete(event, eventChannel, '', undefined)
      } else {
        this.sendError(
          event,
          eventChannel,
          error instanceof Error ? error.message : 'Unknown error'
        )
      }
    } finally {
      this.abortControllers.delete(request.requestId)
    }
  }

  public async stopStreaming(requestId: string): Promise<void> {
    const abortController = this.abortControllers.get(requestId)
    if (abortController) {
      abortController.abort()
      this.abortControllers.delete(requestId)
    }
  }

  public async testConnection(config: LLMConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${config.apiHost.replace(/\/$/, '')}/chat/completions`, {
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
      } else {
        const errorText = await response.text()
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText || response.statusText}`
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }
    }
  }

  public async getModels(config: LLMConfig): Promise<{ success: boolean; models?: string[]; error?: string }> {
    try {
      const response = await fetch(`${config.apiHost.replace(/\/$/, '')}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const models = data.data?.map((model: any) => model.id) || []
        return { success: true, models }
      } else {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch models'
      }
    }
  }
}

export const aiHandler = new AIHandler()

export function setupAIHandlers() {
  ipcMain.handle('ai:send-message-streaming', (event, request: AIRequest, eventChannel: string) =>
    aiHandler.sendMessageStreaming(event, request, eventChannel)
  )
  ipcMain.handle('ai:stop-streaming', (_event, requestId: string) => aiHandler.stopStreaming(requestId))
  ipcMain.handle('ai:test-connection', (_event, config: LLMConfig) => aiHandler.testConnection(config))
  ipcMain.handle('ai:get-models', (_event, config: LLMConfig) => aiHandler.getModels(config))
}
