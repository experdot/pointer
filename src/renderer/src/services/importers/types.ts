/**
 * 第三方聊天数据导入 - 类型定义
 */

// 支持的导入平台
export type ImportPlatform = 'openai' | 'deepseek' | 'claude' | 'custom'

// 解析后的消息（统一中间格式）
export interface ParsedMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  parentMessageId?: string
  branchIndex?: number
  model?: string
  hidden?: boolean // 用于过滤隐藏的系统消息
}

// 解析后的对话（统一中间格式）
export interface ParsedConversation {
  id: string
  title: string
  platform: ImportPlatform
  createdAt: number
  updatedAt?: number
  messages: ParsedMessage[]
  leafMessageId?: string
}

// 导入器接口
export interface ConversationImporter {
  platform: ImportPlatform
  name: string
  description: string

  // 检测文件是否匹配此平台格式
  detect(data: unknown): boolean

  // 解析文件内容
  parse(data: unknown): ParsedConversation[]
}

// 导入选项
export interface ImportOptions {
  conflictStrategy: 'generate-new' | 'skip' | 'overwrite'
  selectedIds: Set<string>
}

// 导入结果
export interface ImportResult {
  success: number
  skipped: number
  failed: number
  errors: string[]
}

// OpenAI 导出格式
export interface OpenAIMessage {
  id: string
  author: {
    role: 'system' | 'user' | 'assistant'
    name?: string | null
    metadata?: Record<string, unknown>
  }
  content: {
    content_type: string
    parts: string[]
  }
  create_time: number | null
  update_time?: number | null
  status?: string
  metadata?: {
    is_visually_hidden_from_conversation?: boolean
    model_slug?: string
    [key: string]: unknown
  }
}

export interface OpenAIMappingNode {
  id: string
  parent: string | null
  children: string[]
  message: OpenAIMessage | null
}

export interface OpenAIExport {
  title: string
  conversation_id: string
  create_time: number
  update_time: number
  mapping: Record<string, OpenAIMappingNode>
  current_node: string
  moderation_results?: unknown[]
  plugin_ids?: string[] | null
  gizmo_id?: string | null
  is_archived?: boolean
  default_model_slug?: string
  id?: string
}

// DeepSeek 导出格式
export interface DeepSeekFragment {
  type: 'REQUEST' | 'RESPONSE'
  content: string
}

export interface DeepSeekMessage {
  files: unknown[]
  model: string
  inserted_at: string
  fragments: DeepSeekFragment[]
}

export interface DeepSeekMappingNode {
  id: string
  parent: string | null
  children: string[]
  message: DeepSeekMessage | null
}

export interface DeepSeekExport {
  id: string
  title: string
  inserted_at: string
  updated_at: string
  mapping: Record<string, DeepSeekMappingNode>
}
