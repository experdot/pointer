// ==================== 账户类型定义 ====================

export interface Account {
  id: string
  name: string
  avatar?: string
  createdAt: number
  updatedAt?: number
}

// ==================== 通用树形结构类型 ====================

// 通用配置文件夹
export interface ConfigFolder {
  type: 'folder'
  id: string
  name: string
  parentFolderId?: string
  expanded?: boolean
  order?: number
  createdAt: number
  updatedAt?: number
}

// 通用配置项基础属性
export interface ConfigItemBase {
  type?: string // 用于区分 item 和 folder，item 的 type 不是 'folder'
  id: string
  name: string
  parentFolderId?: string
  order?: number
  createdAt: number
  updatedAt?: number
}

// 泛型树容器
export interface ConfigTree<T extends ConfigItemBase> {
  items: T[]
  folders: ConfigFolder[]
}

// ==================== 设置配置类型 ====================

export interface ModelConfig extends ConfigItemBase {
  systemPrompt: string
  topP: number
  temperature: number
}

export interface LLMConfig extends ConfigItemBase {
  baseUrl: string
  apiKey: string
  modelName: string
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
  modelConfigId?: string // 模型配置ID
  starred?: boolean

  hasError?: boolean // 标记消息生成时是否发生错误
  isStreaming?: boolean
  collapsed?: boolean // 消息折叠状态

  /** 消息标题 - AI 自动生成或用户手动设置 */
  title?: string
}

// ==================== Topic 类型定义 ====================

/** 独立的 Topic 实体 */
export interface Topic {
  /** Topic 唯一 ID */
  id: string
  /** Topic 名称 */
  name: string
  /** 起始消息 ID */
  startMessageId: string
  /** 终止消息 ID（包含），空表示到下一个同级 Topic 为止 */
  endMessageId?: string
  /** 缩进层级 - 0 为顶级，1 为次级，依此类推 */
  indent: number
  /** 是否折叠 */
  collapsed: boolean
}

export interface ChatSession {
  messages: ChatMessage[]
  /** 独立存储的 Topic 列表 */
  topics: Topic[]

  rootMessageId?: string // 根消息ID
  leafMessageId?: string // 当前选择的消息路径（叶子节点）
  selectedMessageId?: string // 当前选中的消息ID（用于滚动定位）
}

// ==================== Topic 分组类型定义（运行时计算） ====================

/** Topic 分组信息（运行时计算，基于当前路径） */
export interface TopicGroup {
  /** 关联的 Topic ID */
  topicId: string
  /** Topic 起始消息 ID */
  startMessageId: string
  /** Topic 终止消息 ID（包含） */
  endMessageId: string
  /** Topic 名称 */
  name: string
  /** 缩进层级 */
  indent: number
  /** 组内消息 ID 列表（包含起始和终止消息） */
  messageIds: string[]
  /** 是否折叠 */
  collapsed: boolean
}

/** 大纲节点 */
export interface OutlineNode {
  /** 节点唯一 ID */
  id: string
  /** 显示标题 */
  title: string
  /** 节点类型：topic 或 title（带标题的普通消息） */
  type: 'topic' | 'title'
  /** 缩进层级 */
  indent: number
  /** 关联的消息 ID */
  messageId: string
  /** 关联的 Topic ID（仅 topic 类型有） */
  topicId?: string
  /** 消息角色 */
  role?: 'user' | 'assistant' | 'system'
  /** 子节点（仅 topic 类型有） */
  children?: OutlineNode[]
  /** Topic 是否折叠（仅 topic 类型有） */
  collapsed?: boolean
}

export interface PageFolder {
  type: 'folder'
  id: string
  name: string
  expanded?: boolean
  createdAt: number
  updatedAt?: number
  order?: number // 添加排序字段
  parentFolderId?: string // 支持嵌套文件夹
}

export interface Page<T> {
  type: 'page'
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
export interface PromptListConfig extends ConfigItemBase {
  description?: string
  prompts: string[]
}

export interface Settings {
  fontSize: 'small' | 'medium' | 'large'

  llmConfigs: ConfigTree<LLMConfig>
  defaultLLMId?: string

  modelConfigs: ConfigTree<ModelConfig>
  defaultModelConfigId?: string

  promptLists: ConfigTree<PromptListConfig>

  // 自动检查更新
  autoCheckUpdate?: boolean
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

// ==================== 全局搜索类型定义 ====================

/** 全局搜索单条匹配结果 */
export interface GlobalSearchMatch {
  messageId: string
  pageId: string
  role: 'user' | 'assistant' | 'system'
  /** 匹配文本片段（含上下文） */
  snippet: string
  /** 匹配在 snippet 中的起止位置 */
  matchStart: number
  matchEnd: number
  /** 匹配在原始消息内容中的起止位置（用于高亮定位） */
  contentStart: number
  contentEnd: number
  /** 消息创建时间 */
  createdAt: number
}

/** 按消息分组的搜索结果 */
export interface GlobalSearchMessageGroup {
  messageId: string
  pageId: string
  role: 'user' | 'assistant' | 'system'
  /** 消息标题（如果有） */
  title?: string
  /** 消息内容预览（前 N 个字符，用于 title 不存在时显示） */
  contentPreview: string
  /** 消息创建时间 */
  createdAt: number
  /** 该消息内的所有匹配项 */
  matches: GlobalSearchMatch[]
  /** 是否展开 */
  expanded: boolean
}

/** 按页面分组的全局搜索结果 */
export interface GlobalSearchResultGroup {
  pageId: string
  pageTitle: string
  /** 页面创建时间 */
  createdAt: number
  /** 文件夹路径（如果有） */
  folderPath?: string
  /** 按消息分组的结果 */
  messageGroups: GlobalSearchMessageGroup[]
  /** 是否展开 */
  expanded: boolean
}

/** 全局搜索选项 */
export interface GlobalSearchOptions {
  matchCase: boolean
  useRegex: boolean
  matchWholeWord: boolean
  /** 角色筛选 */
  roleFilter: 'all' | 'user' | 'assistant'
  /** 时间范围筛选 */
  timeRange: 'all' | 'today' | 'week' | 'month'
  /** 文件夹筛选 */
  folderIds?: string[]
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

// ==================== Tab 类型定义 ====================

// Tab 基础接口
export interface Tab {
  id: string
  type: string
  title: string
  dataId?: string // 通用的关联数据 ID
  closable?: boolean
  pinned?: boolean
  preview?: boolean
}

// 历史记录项（用于恢复已关闭的 tab）
export interface TabHistoryEntry {
  tabId: string
  type: string
  dataId?: string
}

// ==================== 类型守卫函数 ====================

// 配置类型守卫
export function isLLMConfig(item: ConfigItemBase): item is LLMConfig {
  return 'baseUrl' in item && 'apiKey' in item && 'modelName' in item
}

export function isModelConfig(item: ConfigItemBase): item is ModelConfig {
  return 'systemPrompt' in item && 'topP' in item && 'temperature' in item
}

export function isPromptListConfig(item: ConfigItemBase): item is PromptListConfig {
  return 'prompts' in item && Array.isArray((item as PromptListConfig).prompts)
}

// 页面类型守卫
export function isPage<T>(item: Page<T> | PageFolder): item is Page<T> {
  return item.type === 'page'
}

export function isPageFolder(item: Page<unknown> | PageFolder): item is PageFolder {
  return item.type === 'folder'
}

export function isConfigFolder(item: ConfigItemBase | ConfigFolder): item is ConfigFolder {
  return 'type' in item && item.type === 'folder'
}

// 收藏类型守卫
export function isChatFavoriteItem(item: FavoriteItem): item is ChatFavoriteItem {
  return item.type === 'chat'
}

export function isMessageFavoriteItem(item: FavoriteItem): item is MessageFavoriteItem {
  return item.type === 'message'
}

export function isTextFragmentFavoriteItem(item: FavoriteItem): item is TextFragmentFavoriteItem {
  return item.type === 'text-fragment'
}
