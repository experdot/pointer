export interface LLMConfig {
  baseUrl: string
  apiKey: string
  modelName: string
}

export interface ModelConfig {
  systemPrompt: string
  topP: number
  temperature: number
}

export interface FileAttachment {
  id: string
  name: string
  type: string
  size: number
  localPath: string
  createdAt: number
}

export type AIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | AIContentPart[]
  attachments?: FileAttachment[]
}

export interface AIRequest {
  requestId: string
  llmConfig: LLMConfig
  modelConfig?: ModelConfig
  messages: ChatMessage[]
}

export interface AIStreamChunk {
  requestId: string
  type: 'chunk' | 'complete' | 'error' | 'reasoning_content'
  content?: string
  reasoning_content?: string
  error?: string
}

export interface AIStreamCallbacks {
  onChunk: (chunk: string) => void
  onReasoning?: (reasoning: string) => void
  onComplete?: (fullResponse: string, reasoning?: string) => void
  onError?: (error: string) => void
}
