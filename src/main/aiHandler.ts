import { ipcMain } from 'electron'

export interface LLMConfig {
  apiHost: string
  apiKey: string
  modelName: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIRequest {
  requestId: string
  config: LLMConfig
  messages: ChatMessage[]
  streaming?: boolean
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

  constructor() {
    this.setupHandlers()
  }

  private setupHandlers() {
    ipcMain.handle('ai:send-message', (event, request: AIRequest) => this.sendMessage(request))
    ipcMain.handle('ai:send-message-streaming', (event, request: AIRequest) =>
      this.sendMessageStreaming(event, request)
    )
    ipcMain.handle('ai:stop-streaming', (event, requestId: string) => this.stopStreaming(requestId))
    ipcMain.handle('ai:test-connection', (event, config: LLMConfig) => this.testConnection(config))
  }

  private async sendMessageStreaming(
    event: Electron.IpcMainInvokeEvent,
    request: AIRequest
  ): Promise<void> {
    try {
      // 为当前请求创建新的AbortController
      const abortController = new AbortController()
      this.abortControllers.set(request.requestId, abortController)

      const response = await fetch(
        `${request.config.apiHost.replace(/\/$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${request.config.apiKey}`
          },
          body: JSON.stringify({
            model: request.config.modelName,
            messages: request.messages.map((msg) => ({
              role: msg.role,
              content: msg.content
            })),
            stream: true,
            temperature: 0.7,
            max_tokens: 2000
          }),
          signal: abortController.signal // 添加中断信号
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

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n').filter((line) => line.trim() !== '')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()

              if (data === '[DONE]') {
                event.sender.send('ai-stream-data', {
                  requestId: request.requestId,
                  type: 'complete',
                  content: fullResponse,
                  reasoning_content: fullReasoning || undefined
                } as AIStreamChunk)
                return
              }

              try {
                const parsed = JSON.parse(data)
                const delta = parsed.choices?.[0]?.delta
                const content = delta?.content
                const reasoning_content = delta?.reasoning_content || parsed.reasoning_content

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
          }
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

  private async stopStreaming(requestId: string): Promise<void> {
    const abortController = this.abortControllers.get(requestId)
    if (abortController) {
      abortController.abort()
      this.abortControllers.delete(requestId)
    }
  }

  private async sendMessage(
    request: AIRequest
  ): Promise<{ success: boolean; content?: string; reasoning_content?: string; error?: string }> {
    try {
      const response = await fetch(
        `${request.config.apiHost.replace(/\/$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${request.config.apiKey}`
          },
          body: JSON.stringify({
            model: request.config.modelName,
            messages: request.messages.map((msg) => ({
              role: msg.role,
              content: msg.content
            })),
            temperature: 0.7,
            max_tokens: 2000
          })
        }
      )

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP error! status: ${response.status}`
        }
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      const reasoning_content = data.choices?.[0]?.message?.reasoning_content

      return {
        success: true,
        content,
        reasoning_content
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private async testConnection(config: LLMConfig): Promise<{ success: boolean; error?: string }> {
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
