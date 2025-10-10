import { ChatMessage, LLMConfig, ModelConfig } from '../types/type'
import { v4 as uuidv4 } from 'uuid'

export interface StreamingResponse {
  onChunk: (chunk: string) => void
  onReasoning?: (reasoning: string) => void
  onComplete: (fullResponse: string, reasoning?: string) => void
  onError: (error: Error) => void
}

export class AIService {
  private llmConfig: LLMConfig
  private modelConfig: ModelConfig
  private requestId: string
  private isAborted: boolean = false

  constructor(llmConfig: LLMConfig, modelConfig: ModelConfig) {
    this.llmConfig = llmConfig
    this.modelConfig = modelConfig
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
      // 直接调用新接口，传递回调函数对象
      await window.api.ai.sendMessageStreaming(
        {
          requestId: this.requestId,
          llmConfig: this.llmConfig,
          modelConfig: this.modelConfig,
          messages: messages
        },
        {
          onChunk: (chunk: string) => {
            if (!this.isAborted) {
              callbacks.onChunk(chunk)
            }
          },
          onReasoning: (reasoning: string) => {
            if (!this.isAborted) {
              callbacks.onReasoning?.(reasoning)
            }
          },
          onComplete: (fullResponse: string, reasoning?: string) => {
            if (!this.isAborted) {
              callbacks.onComplete(fullResponse, reasoning)
            }
          },
          onError: (error: string) => {
            if (!this.isAborted) {
              callbacks.onError(new Error(error))
            }
          }
        }
      )
    } catch (error) {
      if (!this.isAborted) {
        callbacks.onError(error as Error)
      }
    }
  }

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
export function createAIService(llmConfig: LLMConfig, modelConfig: ModelConfig): AIService {
  return new AIService(llmConfig, modelConfig)
}
