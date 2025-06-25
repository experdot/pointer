export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoning_content?: string
  timestamp: number
  isFavorited?: boolean
  modelId?: string
  parentId?: string
  children?: string[]
  branchIndex?: number
  isStreaming?: boolean
}

export interface LLMConfig {
  id: string
  name: string
  apiHost: string
  apiKey: string
  modelName: string
  isDefault: boolean
  createdAt: number
}
