export interface ModelConfig {
  id: string
  name: string
  systemPrompt: string
  topP: number
  temperature: number
  createdAt: number
  updatedAt?: number
}

export interface LLMConfig {
  id: string
  name: string
  apiHost: string
  apiKey: string
  modelName: string
  createdAt: number
  updatedAt?: number
  modelConfigId?: string
}

// 文件附件类型
export interface FileAttachment {
  id: string
  name: string
  type: string // MIME type
  size: number
  localPath: string // 本地文件路径（相对于attachments目录）
  createdAt: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning_content?: string
  attachments?: FileAttachment[]
  createdAt: number
  updatedAt?: number

  parentMessageId?: string
  branchIndex?: number

  modelId?: string
  starred?: boolean

  hasError?: boolean // 标记消息生成时是否发生错误
  isStreaming?: boolean
}

export interface ChatSession {
  messages: Map<string, ChatMessage>

  rootMessageId?: string // 根消息ID
  leafMessageId?: string // 当前选择的消息路径（叶子节点）
  selectedMessageId?: string // 当前选中的消息ID（用于滚动定位）

  streamingMessage?: {
    content: string
    reasoning_content?: string
    createdAt: number
  }
}

export interface PageFolder {
  id: string
  name: string
  expanded?: boolean
  createdAt: number
  updatedAt?: number
  order?: number // 添加排序字段
  parentFolderId?: string // 支持嵌套文件夹
}

export interface Page<T> {
  id: string
  title: string

  parentFolderId?: string // 支持嵌套文件夹
  createdAt: number
  updatedAt?: number

  order?: number // 添加排序字段
  pinned?: boolean // 是否固定标签页
  starred?: boolean // 是否标记为星标

  data?: T
}

export type ChatPage = Page<ChatSession>
export type SettingsPage = Page<Settings>

// 预设提示词列表配置
export interface PromptListConfig {
  id: string
  name: string
  description?: string
  prompts: string[]
  createdAt: number
  updatedAt?: number
}

export interface Settings {
  fontSize: 'small' | 'medium' | 'large'

  llmConfigs: LLMConfig[]
  defaultLLMId?: string

  modelConfigs: ModelConfig[]
  defaultModelConfigId?: string

  promptLists: PromptListConfig[]
}

export interface SearchResult {
  id: string
  chatId: string
  chatTitle: string
  messageId: string
  snippet: string // 搜索结果的文本片段
  highlightIndices: number[] // 高亮位置
}

export interface SearchOptions {
  matchCase: boolean // 匹配大小写
  matchWholeWord: boolean // 匹配整个单词
  useRegex: boolean // 使用正则表达式
}

// AI任务状态
export type AITaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

// AI任务类型
export type AITaskType = 'chat' | 'retry' | 'edit_resend' | 'model_change'

// AI任务信息
export interface AITask {
  id: string
  requestId: string // AI服务的请求ID，用于中止请求
  type: AITaskType
  status: AITaskStatus
  title: string // 任务标题
  description?: string // 任务描述

  // 关联信息
  chatId?: string // 关联的聊天ID
  messageId?: string // 关联的消息ID
  modelId?: string // 使用的模型ID

  // 时间信息
  startTime: number
  endTime?: number

  // 进度信息
  progress?: {
    current: number
    total: number
    message?: string
  }

  // 错误信息
  error?: string

  // 任务特定的数据
  context?: {
    // 普通聊天上下文
    chat?: {
      messageContent?: string
      parentMessageId?: string
    }
    // 重试上下文
    retry?: {
      originalMessageId: string
    }
    // 编辑重发上下文
    editResend?: {
      originalMessageId: string
      newContent: string
    }
    // 模型切换上下文
    modelChange?: {
      originalMessageId: string
      newModelId: string
    }
  }
}

// ==================== 收藏功能类型定义 ====================

// 收藏项类型
export type FavoriteItemType = 'chat' | 'message' | 'text-fragment'

// 收藏项来源信息（用于溯源）
export interface FavoriteSource {
  type: 'chat' | 'message'
  pageId?: string // 源页面 ID
  messageId?: string // 源消息 ID
  pageTitle?: string // 源页面标题（快照）
  createdAt: number
  updatedAt?: number
}

// 会话收藏项数据
export interface ChatFavoriteData {
  chatSnapshot: ChatSession // 完整的会话快照
  thumbnailUrl?: string // 可选的缩略图
}

// 消息收藏项数据
export interface MessageFavoriteData {
  message: ChatMessage // 消息快照
  contextMessages?: ChatMessage[] // 可选的上下文消息（前后各2条）
  pageTitle: string // 所属页面标题
}

// 文本片段收藏项数据
export interface TextFragmentFavoriteData {
  text: string // 选中的文本内容
  fullMessage: ChatMessage // 完整的消息快照
  pageTitle: string // 所属页面标题
}

// 收藏项基础属性
export interface FavoriteItemBase {
  id: string
  title: string // 收藏项标题
  description?: string // 可选的描述
  parentFolderId?: string // 所属文件夹 ID
  createdAt: number // 收藏时间
  updatedAt?: number // 最后更新时间
  order?: number // 排序顺序
  source?: FavoriteSource // 来源信息
  starred?: boolean // 是否标记为星标
  notes?: string // 用户笔记
}

// 对话收藏项
export interface ChatFavoriteItem extends FavoriteItemBase {
  type: 'chat'
  data: ChatFavoriteData
}

// 消息收藏项
export interface MessageFavoriteItem extends FavoriteItemBase {
  type: 'message'
  data: MessageFavoriteData
}

// 文本片段收藏项
export interface TextFragmentFavoriteItem extends FavoriteItemBase {
  type: 'text-fragment'
  data: TextFragmentFavoriteData
}

// 收藏项联合类型 - 支持类型守卫
export type FavoriteItem = ChatFavoriteItem | MessageFavoriteItem | TextFragmentFavoriteItem

// 收藏文件夹
export interface FavoriteFolder {
  id: string
  name: string
  description?: string
  parentFolderId?: string // 支持文件夹嵌套
  expanded?: boolean // 是否展开
  color?: string // 文件夹颜色
  icon?: string // 自定义图标
  createdAt: number
  updatedAt?: number
  order?: number
}

// ==================== 消息队列功能类型定义 ====================

// 消息队列项状态
export type MessageQueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed'

// 消息队列项类型
export type MessageQueueItemType = 'normal' | 'ai-generated' | 'prompt-list'

// 消息队列项
export interface MessageQueueItem {
  id: string // 队列项唯一ID
  content: string // 消息内容
  attachments?: FileAttachment[] // 文件附件（可选）

  type: MessageQueueItemType // 消息类型：normal（普通消息）、ai-generated（AI生成的追问）、prompt-list（来自提示词列表）
  modelId?: string // 指定的模型ID（可选）
  status: MessageQueueItemStatus // 状态
  createdAt: number // 创建时间
  startedAt?: number // 开始处理时间
  completedAt?: number // 完成时间
  error?: string // 错误信息
  order: number // 队列顺序
  // 以下字段仅在 type 为 'prompt-list' 时使用
  promptListId?: string // 提示词列表ID
  promptIndex?: number // 当前提示词索引
}

// 消息队列配置
export interface MessageQueueConfig {
  enabled: boolean // 是否启用队列
  autoProcess: boolean // 是否自动处理队列（当前任务完成后自动处理下一个）
  paused: boolean // 是否暂停队列处理
  maxRetries: number // 最大重试次数
}
