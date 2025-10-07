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

  public async sendMessageStreaming(
    event: Electron.IpcMainInvokeEvent,
    request: AIRequest
  ): Promise<void> {
    try {
      // 为当前请求创建新的AbortController
      const abortController = new AbortController()
      this.abortControllers.set(request.requestId, abortController)

      // 准备消息数组，如果有systemPrompt，插入system消息
      const apiMessages = request.messages.map((msg) => ({
        role: msg.role,
        content: msg.content
      }))

      let modelConfig = request.modelConfig
      if (!request.modelConfig) {
        modelConfig = {
          systemPrompt: '',
          topP: 1,
          temperature: 1
        }
      }

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

      const response = await fetch(
        `${request.llmConfig.apiHost.replace(/\/$/, '')}/chat/completions`,
        {
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
        }
      )

      if (!response.ok) {
        event.sender.send('ai-stream-data', {
          requestId: request.requestId,
          type: 'error',
          error: `HTTP error! status: ${response.status}`
        } as AIStreamChunk)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        event.sender.send('ai-stream-data', {
          requestId: request.requestId,
          type: 'error',
          error: 'No response body reader available'
        } as AIStreamChunk)
        return
      }

      const decoder = new TextDecoder()
      let fullResponse = ''
      let fullReasoning = ''

      // 使用 eventsource-parser 来解析 SSE 数据
      const parser = createParser({
        onEvent: (eventData) => {
          if (eventData.data === '[DONE]') {
            event.sender.send('ai-stream-data', {
              requestId: request.requestId,
              type: 'complete',
              content: fullResponse,
              reasoning_content: fullReasoning || undefined
            } as AIStreamChunk)
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
              fullResponse += content
              event.sender.send('ai-stream-data', {
                requestId: request.requestId,
                type: 'chunk',
                content: content
              } as AIStreamChunk)
            }

            if (reasoning_content) {
              fullReasoning += reasoning_content
              event.sender.send('ai-stream-data', {
                requestId: request.requestId,
                type: 'reasoning_content',
                reasoning_content: reasoning_content
              } as AIStreamChunk)
            }
          } catch (e) {
            // 忽略解析错误，继续处理下一行
            console.warn('Failed to parse streaming data:', e)
          }
        }
      })

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          parser.feed(chunk)
        }

        event.sender.send('ai-stream-data', {
          requestId: request.requestId,
          type: 'complete',
          content: fullResponse,
          reasoning_content: fullReasoning || undefined
        } as AIStreamChunk)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // 请求被中断
          event.sender.send('ai-stream-data', {
            requestId: request.requestId,
            type: 'complete',
            content: fullResponse,
            reasoning_content: fullReasoning || undefined
          } as AIStreamChunk)
        } else {
          event.sender.send('ai-stream-data', {
            requestId: request.requestId,
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          } as AIStreamChunk)
        }
      } finally {
        this.abortControllers.delete(request.requestId)
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // 请求被中断，发送当前内容作为完成状态
        event.sender.send('ai-stream-data', {
          requestId: request.requestId,
          type: 'complete',
          content: '',
          reasoning_content: undefined
        } as AIStreamChunk)
      } else {
        event.sender.send('ai-stream-data', {
          requestId: request.requestId,
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        } as AIStreamChunk)
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
      const response = await fetch(`${config.apiHost.replace(/\/$/, '')}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`
        }
      })

      if (response.ok) {
        return { success: true }
      } else {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }
    }
  }
}

export const aiHandler = new AIHandler()

export function setupAIHandlers() {
  ipcMain.handle('ai:send-message-streaming', (event, request: AIRequest) =>
    aiHandler.sendMessageStreaming(event, request)
  )
  ipcMain.handle('ai:stop-streaming', (event, requestId: string) => aiHandler.stopStreaming(requestId))
  ipcMain.handle('ai:test-connection', (event, config: LLMConfig) => aiHandler.testConnection(config))
}
