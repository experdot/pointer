import { Page } from '../../types/type'

// DeepSeek导出格式的类型定义
export interface DeepSeekMessage {
  id: string
  parent: string | null
  children: string[]
  message: {
    files: any[]
    search_results: any
    model: string
    reasoning_content: string | null
    content: string
    inserted_at: string
  } | null
}

export interface DeepSeekChat {
  id: string
  title: string
  inserted_at: string
  updated_at: string
  mapping: { [key: string]: DeepSeekMessage }
}

// OpenAI导出格式的类型定义
export interface OpenAIMessage {
  id: string
  message: {
    id: string
    author: {
      role: 'user' | 'assistant' | 'system'
      name?: string | null
      metadata?: any
    }
    create_time: number | null
    update_time: number | null
    content: {
      content_type: string
      parts: string[]
    }
    status: string
    end_turn?: boolean | null
    weight: number
    metadata?: any
    recipient?: string
    channel?: string | null
  } | null
  parent: string | null
  children: string[]
}

export interface OpenAIChat {
  title: string
  create_time: number
  update_time: number
  mapping: { [key: string]: OpenAIMessage }
  moderation_results?: any[]
  current_node?: string
  plugin_ids?: string[] | null
  conversation_id: string
  conversation_template_id?: string | null
  gizmo_id?: string | null
  gizmo_type?: string | null
  is_archived?: boolean
  is_starred?: boolean | null
  safe_urls?: string[]
  blocked_urls?: string[]
  default_model_slug?: string
  conversation_origin?: string | null
  voice?: string | null
  async_status?: string | null
  disabled_tool_ids?: string[]
  is_do_not_remember?: boolean | null
  memory_scope?: string
  sugar_item_id?: string | null
  id: string
}

// 支持的聊天格式类型
export type ChatFormat = 'deepseek' | 'openai' | 'unknown'

// 导入结果
export interface ImportResult {
  success: boolean
  pages: Page[]
  folder?: { id: string; name: string }
  successCount: number
  errorCount: number
  message: string
}

// 可选择的聊天项
export interface SelectableChatItem {
  id: string
  title: string
  messageCount: number
  createTime: number
  formatType: ChatFormat
  originalData: DeepSeekChat | OpenAIChat
}

// 解析结果
export interface ParseResult {
  success: boolean
  formatType: ChatFormat
  pages: SelectableChatItem[]
  message: string
}
