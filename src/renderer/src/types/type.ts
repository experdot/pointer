export interface ModelConfig {
  id: string
  name: string
  systemPrompt: string
  topP: number
  temperature: number
  createdAt: number
}

export interface LLMConfig {
  id: string
  name: string
  apiHost: string
  apiKey: string
  modelName: string
  createdAt: number
  modelConfigId?: string
}

// 文件附件类型
export interface FileAttachment {
  id: string
  name: string
  type: string // MIME type
  size: number
  localPath: string // 本地文件路径（相对于attachments目录）
  createdAt: number // 创建时间
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning_content?: string
  timestamp: number
  isBookmarked?: boolean
  modelId?: string
  parentId?: string
  children?: string[]
  branchIndex?: number
  isStreaming?: boolean
  attachments?: FileAttachment[] // 文件附件数组
  hasError?: boolean // 标记消息生成时是否发生错误
}

// 页面溯源信息
export interface PageLineage {
  source:
    | 'user'
    | 'object_to_crosstab'
    | 'crosstab_to_chat'
    | 'object_to_chat'
    | 'chat_to_object'
    | 'other'
  sourcePageId?: string // 源页面ID
  sourceContext?: {
    // 对象页面到交叉分析页面的上下文
    objectCrosstab?: {
      horizontalNodeId: string
      verticalNodeId: string
      horizontalNodeName: string
      verticalNodeName: string
    }
    // 交叉分析页面到聊天页面的上下文
    crosstabChat?: {
      horizontalItem: string
      verticalItem: string
      cellContent: string
    }
    // 其他生成上下文
    customContext?: any
  }
  generatedPageIds: string[] // 后续催生的页面ID列表
  generatedAt?: number // 生成时间戳
  description?: string // 溯源描述
}

export interface PageBase {
  id: string
  title: string
  type: 'regular' | 'crosstab' | 'object' | 'settings'

  folderId?: string
  createdAt: number
  updatedAt: number

  order?: number // 添加排序字段
  pinned?: boolean // 是否固定标签页
  starred?: boolean // 是否标记为星标

  lineage?: PageLineage // 页面溯源信息

  data?: any
}

export interface PageFolder {
  id: string
  name: string
  expanded?: boolean
  createdAt: number
  order?: number // 添加排序字段
  parentId?: string // 支持嵌套文件夹
}

// 普通聊天类型
export interface RegularChat extends PageBase {
  type: 'regular'
  messages: ChatMessage[]

  // 树状结构支持
  messageMap?: { [messageId: string]: ChatMessage } // 消息ID到消息的映射
  currentPath?: string[] // 当前选择的消息路径（从根到叶子）
  rootMessageId?: string // 根消息ID
  selectedMessageId?: string // 当前选中的消息ID（用于滚动定位）

  streamingMessage?: {
    content: string
    timestamp: number
  }
}

// 交叉表轴维度定义
export interface CrosstabAxisDimension {
  id: string
  name: string
  description?: string
  values: string[]
  order: number // 在轴中的顺序，决定父子关系（数字越小越是父级）
  suggestions?: string[]
}

// 交叉表值维度定义
export interface CrosstabValueDimension {
  id: string
  name: string
  description: string
  suggestions?: string[]
}

// 多维度交叉表元数据
export interface CrosstabMetadata {
  topic: string
  horizontalDimensions: CrosstabAxisDimension[]
  verticalDimensions: CrosstabAxisDimension[]
  valueDimensions: CrosstabValueDimension[]
  topicSuggestions?: string[]
}

// 多维度数据存储结构
export interface CrosstabMultiDimensionData {
  // 使用嵌套结构存储多维度数据
  // 键是维度路径（用"/"分隔），值是对应的内容
  [dimensionPath: string]: {
    [valueDimensionId: string]: string
  }
}

export interface CrosstabStep {
  id: string
  stepType: 'metadata' | 'horizontal' | 'vertical' | 'values'
  stepName: string
  description: string
  prompt: string
  response?: string
  isCompleted: boolean
  timestamp: number
}

export interface CrosstabData {
  metadata: CrosstabMetadata | null
  tableData: CrosstabMultiDimensionData
  currentStep: number
  steps: CrosstabStep[]
}

export interface CrosstabChat extends PageBase {
  type: 'crosstab'
  crosstabData: CrosstabData
}

// 定义连接的角色
export interface NodeConnection {
  nodeId: string // 连接到哪个节点的ID
  role: string // 在这个连接关系中扮演的角色，比如 "subject", "object", "instrument", "location"等
  description?: string // 对这个角色的额外描述
  strength?: 'weak' | 'medium' | 'strong' // 连接强度
  metadata?: {
    createdAt?: number
    updatedAt?: number
    source?: 'user' | 'ai' // 来源：用户手动添加或AI生成
    aiPrompt?: string // 如果是AI生成，记录使用的提示
    bidirectional?: boolean // 是否双向连接
    tags?: string[] // 连接标签
  }
}

// 统一的对象节点接口
export interface ObjectNode {
  id: string
  name: string
  description?: string // 节点描述
  type: string // 节点类型：entity（实体）、event（事件）、relation（关系）等，完全自定义

  // 树状视图结构支持，用于显示和编辑
  parentId?: string // 父节点ID
  children?: string[] // 子节点ID数组
  expanded?: boolean // 是否展开

  connections?: NodeConnection[] // 连接到其他节点的关系
  properties?: { [key: string]: any } // 对象属性（键值对）

  metadata?: {
    // 元数据信息
    createdAt?: number
    updatedAt?: number
    source?: 'user' | 'ai' // 来源：用户创建或AI生成
    aiPrompt?: string // 如果是AI生成，记录使用的提示
    tags?: string[] // 标签
    readonly?: boolean // 是否只读
  }

  aiRecommendations?: {
    // AI推荐的提示词，按生成类型分类
    children?: {
      recommendations: string[]
      timestamp: number
      modelId?: string
    }
    description?: {
      recommendations: string[]
      timestamp: number
      modelId?: string
    }
    properties?: {
      recommendations: string[]
      timestamp: number
      modelId?: string
    }
    relations?: {
      recommendations: string[]
      timestamp: number
      modelId?: string
    }
  }
}

// 节点上下文信息，用于交叉分析
export interface NodeContext {
  node: ObjectNode
  ancestorChain: ObjectNode[]
  children: ObjectNode[]
  siblings: ObjectNode[]
}

// 对象数据结构
export interface ObjectData {
  rootNodeId: string // 根节点ID
  nodes: { [nodeId: string]: ObjectNode } // 所有节点的映射
  selectedNodeId?: string // 当前选中的节点ID
  expandedNodes: string[] // 展开的节点ID列表
  searchQuery?: string // 对象内搜索查询
  filteredNodeIds?: string[] // 过滤后的节点ID列表
  generationHistory: ObjectGenerationRecord[] // AI生成历史记录
}

// AI生成记录
export interface ObjectGenerationRecord {
  id: string
  parentNodeId: string
  prompt: string
  generatedNodeIds: string[]
  timestamp: number
  modelId?: string
}

// 对象聊天类型
export interface ObjectChat extends PageBase {
  type: 'object'
  objectData: ObjectData
}

// 设置页面类型
export interface SettingsPage extends PageBase {
  type: 'settings'
}

// 聊天类型 - 包含所有属性
export interface Page extends PageBase {
  type: 'regular' | 'crosstab' | 'object' | 'settings'

  // RegularChat 的属性
  messages?: ChatMessage[]
  messageMap?: { [messageId: string]: ChatMessage }
  currentPath?: string[]
  rootMessageId?: string
  selectedMessageId?: string
  streamingMessage?: {
    content: string
    timestamp: number
  }

  // CrosstabChat 的属性
  crosstabData?: CrosstabData

  // ObjectChat 的属性
  objectData?: ObjectData
}

// 预设提示词列表配置
export interface PromptListConfig {
  id: string
  name: string
  description?: string
  prompts: string[]
  createdAt: number
}

export interface Settings {
  llmConfigs: LLMConfig[]
  defaultLLMId?: string
  modelConfigs: ModelConfig[]
  defaultModelConfigId?: string
  fontSize: 'small' | 'medium' | 'large'
  promptLists: PromptListConfig[]
  defaultPromptListId?: string
}

export interface SearchResult {
  id: string
  chatId: string
  chatTitle: string
  messageId: string
  message: ChatMessage
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
export type AITaskType =
  | 'chat'
  | 'crosstab_cell'
  | 'object_generation'
  | 'retry'
  | 'edit_resend'
  | 'model_change'

// AI任务信息
export interface AITask {
  id: string // 任务ID，通常是messageId
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
    // 交叉分析单元格上下文
    crosstab?: {
      horizontalItem: string
      verticalItem: string
      metadata: any
    }
    // 对象生成上下文
    object?: {
      nodeId: string
      prompt: string
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
export type FavoriteItemType = 'page' | 'message' | 'text-fragment'

// 收藏项来源信息（用于溯源）
export interface FavoriteSource {
  type: 'page' | 'message'
  pageId?: string // 源页面 ID
  messageId?: string // 源消息 ID
  pageTitle?: string // 源页面标题（快照）
  pageType?: 'regular' | 'crosstab' | 'object' | 'settings'
  timestamp: number // 收藏时的时间戳
}

// 页面收藏项数据
export interface PageFavoriteData {
  pageSnapshot: Page // 完整的页面快照
  thumbnailUrl?: string // 可选的缩略图
}

// 消息收藏项数据
export interface MessageFavoriteData {
  message: ChatMessage // 消息快照
  contextMessages?: ChatMessage[] // 可选的上下文消息（前后各2条）
  pageTitle: string // 所属页面标题
  pageType: 'regular' | 'crosstab' | 'object'
}

// 文本片段收藏项数据
export interface TextFragmentFavoriteData {
  text: string // 选中的文本内容
  fullMessage: ChatMessage // 完整的消息快照
  pageTitle: string
  pageType: 'regular' | 'crosstab' | 'object'
}

// 收藏项基础接口
export interface FavoriteItem {
  id: string // 收藏项唯一 ID
  type: FavoriteItemType // 收藏项类型
  title: string // 收藏项标题
  description?: string // 可选的描述
  tags?: string[] // 标签
  folderId?: string // 所属文件夹 ID
  source?: FavoriteSource // 来源信息

  // 类型特定的数据
  data: PageFavoriteData | MessageFavoriteData | TextFragmentFavoriteData

  createdAt: number // 收藏时间
  updatedAt: number // 最后更新时间
  order?: number // 排序顺序
  color?: string // 可选的标记颜色
  starred?: boolean // 是否标记为星标

  // 笔记和统计
  notes?: string // 用户笔记
  viewCount?: number // 查看次数
  lastViewedAt?: number // 最后查看时间
}

// 收藏文件夹
export interface FavoriteFolder {
  id: string
  name: string
  description?: string
  parentId?: string // 支持嵌套
  expanded?: boolean // 是否展开
  color?: string // 文件夹颜色
  icon?: string // 自定义图标
  createdAt: number
  order?: number
}

// ==================== 消息队列功能类型定义 ====================

// 消息队列项状态
export type MessageQueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed'

// 消息队列项
export interface MessageQueueItem {
  id: string // 队列项唯一ID
  content: string // 消息内容
  modelId?: string // 指定的模型ID（可选）
  attachments?: FileAttachment[] // 文件附件（可选）
  status: MessageQueueItemStatus // 状态
  createdAt: number // 创建时间
  startedAt?: number // 开始处理时间
  completedAt?: number // 完成时间
  error?: string // 错误信息
  order: number // 队列顺序
}

// 消息队列配置
export interface MessageQueueConfig {
  enabled: boolean // 是否启用队列
  autoProcess: boolean // 是否自动处理队列（当前任务完成后自动处理下一个）
  paused: boolean // 是否暂停队列处理
  maxRetries: number // 最大重试次数
}
