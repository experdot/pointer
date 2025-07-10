import { ChatMessage, LLMConfig } from '../types'
import { v4 as uuidv4 } from 'uuid'

export interface StreamingResponse {
  onChunk: (chunk: string) => void
  onReasoning?: (reasoning: string) => void
  onComplete: (fullResponse: string, reasoning?: string) => void
  onError: (error: Error) => void
}

export class AIService {
  private llmConfig: LLMConfig
  private requestId: string
  private isAborted: boolean = false

  constructor(llmConfig: LLMConfig) {
    this.llmConfig = llmConfig
    this.requestId = uuidv4()
  }

  // 添加getter方法来暴露requestId
  get id(): string {
    return this.requestId
  }

  async stopStreaming(): Promise<void> {
    try {
      this.isAborted = true
      await window.api.ai.stopStreaming(this.requestId)
    } catch (error) {
      console.error('Failed to stop streaming:', error)
    }
  }

  async sendMessage(messages: ChatMessage[], callbacks: StreamingResponse): Promise<void> {
    if (this.isAborted) {
      callbacks.onError(new Error('Request was aborted'))
      return
    }

    try {
      let fullResponse = ''
      let fullReasoning = ''

      // 设置流数据监听器 - 每个请求使用独立的监听器
      const handleStreamData = (data: any) => {
        // 验证数据是否属于当前请求
        if (data.requestId !== this.requestId) {
          return // 忽略不属于当前请求的数据
        }

        if (this.isAborted) {
          return // 请求已被中止，忽略后续数据
        }

        switch (data.type) {
          case 'chunk':
            if (data.content) {
              fullResponse += data.content
              callbacks.onChunk(data.content)
            }
            break
          case 'reasoning_content':
            if (data.reasoning_content) {
              fullReasoning += data.reasoning_content
              callbacks.onReasoning?.(data.reasoning_content)
            }
            break
          case 'complete':
            const finalReasoning = data.reasoning_content || fullReasoning || undefined
            callbacks.onComplete(fullResponse || data.content || '', finalReasoning)
            this.removeStreamListener()
            break
          case 'error':
            callbacks.onError(new Error(data.error || 'Unknown error'))
            this.removeStreamListener()
            break
        }
      }

      // 监听流数据 - 使用请求ID作为标识
      window.api.ai.onStreamData(this.requestId, handleStreamData)

      // 发送流式请求，包含请求ID
      await window.api.ai.sendMessageStreaming({
        requestId: this.requestId,
        config: this.llmConfig,
        messages: messages
      })
    } catch (error) {
      this.removeStreamListener()
      if (!this.isAborted) {
        callbacks.onError(error as Error)
      }
    }
  }

  private removeStreamListener() {
    window.api.ai.removeStreamListener(this.requestId)
  }

  // 备用的非流式方法
  async sendMessageNonStreaming(
    messages: ChatMessage[]
  ): Promise<{ content: string; reasoning_content?: string }> {
    try {
      const result = await window.api.ai.sendMessage({
        requestId: this.requestId,
        config: this.llmConfig,
        messages: messages
      })

      if (result.success) {
        return {
          content: result.content || '抱歉，我无法生成回复。',
          reasoning_content: result.reasoning_content
        }
      } else {
        throw new Error(result.error || 'Unknown error')
      }
    } catch (error) {
      console.error('AI Service Error:', error)
      throw error
    }
  }

  // 测试连接
  async testConnection(): Promise<boolean> {
    try {
      const result = await window.api.ai.testConnection(this.llmConfig)
      return result.success
    } catch (error) {
      console.error('Connection test failed:', error)
      return false
    }
  }
}

// 工厂函数
export function createAIService(llmConfig: LLMConfig): AIService {
  return new AIService(llmConfig)
}
