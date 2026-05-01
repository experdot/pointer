// ==================== 账户类型定义 ====================

export interface Account {
  id: string
  name: string
  avatar?: string
  createdAt: number
  updatedAt?: number
}

// ==================== 基础树形结构类型 ====================
// 基础树元素属性
export interface TreeItemBase {
  type: 'item' | 'folder'
  id: string
  name: string
  parentFolderId?: string
  order?: number
  createdAt: number
  updatedAt?: number
}

export interface TreeFolderBase extends TreeItemBase {
  type: 'folder'
  expanded?: boolean
}

// ==================== 通用树形结构类型 ====================

// 通用配置项基础属性
export interface ConfigItemBase extends TreeItemBase {
  type: 'item'
}

// 通用配置文件夹
export type ConfigFolder = TreeFolderBase

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
  localPath: string // 本地文件路径（相对于当前工作区 .pointer/attachments 目录）
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

  modelId?: string // LLM 模型ID
  modelConfigId?: string // 模型配置ID

  starred?: boolean // 是否星标
  collapsed?: boolean // 是否折叠

  hasError?: boolean // 标记消息生成时是否发生错误
  isStreaming?: boolean

  /** 自定义消息标题 */
  title?: string
}

export interface Topic {
  id: string
  name: string
  /** 起始消息 ID */
  startMessageId: string
  /** 终止消息 ID（包含），空表示到下一个 Topic 为止 */
  endMessageId?: string
  collapsed: boolean
}

export interface ChatSession {
  messages: ChatMessage[]
  topics: Topic[] // 独立存储的 Topic 列表

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
  /** 节点类型：topic、title（带标题的消息）或 untitled（无标题的消息） */
  type: 'topic' | 'title' | 'untitled'
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

// PageFolder
export type PageFolder = TreeFolderBase

// Page 类型
export interface Page<T> extends TreeItemBase {
  type: 'item'
  starred?: boolean
  data?: T
}

export type ChatPage = Page<ChatSession>

// 页面类型守卫（通过 type 属性区分 Page 和 PageFolder）
export function isPage<T>(item: Page<T> | PageFolder): item is Page<T> {
  return item.type === 'item'
}

export interface Settings {
  fontSize: 'small' | 'medium' | 'large'

  llmConfigs: ConfigTree<LLMConfig>
  defaultLLMId?: string

  modelConfigs: ConfigTree<ModelConfig>
  defaultModelConfigId?: string

  autoCheckUpdate?: boolean // 自动检查更新
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
  pageId: string
  messageId: string
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
  pageId: string
  messageId: string
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
