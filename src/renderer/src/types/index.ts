export interface LLMConfig {
  id: string
  name: string
  apiHost: string
  apiKey: string
  modelName: string
  isDefault: boolean
  createdAt: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
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
  type: 'regular' | 'crosstab' | 'object'

  folderId?: string
  createdAt: number
  updatedAt: number

  order?: number // 添加排序字段
  pinned?: boolean // 是否固定标签页

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

export interface CrosstabChat extends Page {
  type: 'crosstab'
  crosstabData: CrosstabData
}

// 对象节点引用接口
export interface ObjectNodeReference {
  id: string // 引用的节点ID
  name: string // 引用的节点名称（冗余存储，便于显示和搜索）
  description?: string // 引用关系的描述
  type: 'dependency' | 'related' | 'inspiration' | 'conflict' | 'custom' // 引用类型
  strength: 'weak' | 'medium' | 'strong' // 引用强度
  metadata?: {
    createdAt?: number
    updatedAt?: number
    source?: 'user' | 'ai' // 来源：用户手动添加或AI生成
    aiPrompt?: string // 如果是AI生成，记录使用的提示
    bidirectional?: boolean // 是否双向引用
    tags?: string[] // 引用标签
  }
}

// 对象节点接口
export interface ObjectNode {
  id: string
  name: string
  description?: string // 节点描述
  parentId?: string // 父节点ID
  children?: string[] // 子节点ID数组
  expanded?: boolean // 是否展开
  metadata?: {
    // 元数据信息
    createdAt?: number
    updatedAt?: number
    lastModified?: number
    source?: 'user' | 'ai' // 来源：用户创建或AI生成
    aiPrompt?: string // 如果是AI生成，记录使用的提示
    tags?: string[] // 标签
    readonly?: boolean // 是否只读
  }
  properties?: { [key: string]: any } // 对象属性（键值对）
  references?: ObjectNodeReference[] // 引用/依赖的其他节点
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
    references?: {
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

// 聊天类型 - 包含所有属性
export interface Page extends PageBase {
  type: 'regular' | 'crosstab' | 'object'

  // RegularChat 的属性
  messages?: ChatMessage[]
  messageMap?: { [messageId: string]: ChatMessage }
  currentPath?: string[]
  rootMessageId?: string
  streamingMessage?: {
    content: string
    timestamp: number
  }

  // CrosstabChat 的属性
  crosstabData?: CrosstabData

  // ObjectChat 的属性
  objectData?: ObjectData
}

export interface Settings {
  llmConfigs: LLMConfig[]
  defaultLLMId?: string
  fontSize: 'small' | 'medium' | 'large'
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

export interface AppState {
  pages: Page[]
  folders: PageFolder[]
  openTabs: string[] // chat ids
  activeTabId: string | null
  selectedNodeId: string | null // 当前选中的节点ID
  selectedNodeType: 'folder' | 'chat' | null // 当前选中的节点类型
  checkedNodeIds: string[] // 选中的节点ID数组（支持ctrl+shift多选）

  settings: Settings
  sidebarCollapsed: boolean
  sidebarWidth: number // 侧边栏宽度

  // 搜索状态
  searchQuery: string
  searchResults: SearchResult[]
  isSearching: boolean
  showSearchResults: boolean

  // 消息折叠状态
  collapsedMessages: { [chatId: string]: string[] } // 每个聊天中折叠的消息ID列表
  allMessagesCollapsed: { [chatId: string]: boolean } // 每个聊天的全部折叠状态

  // 页面溯源显示折叠状态
  lineageDisplayCollapsed: { [pageId: string]: boolean } // 每个页面的溯源显示折叠状态

  // AI任务监控状态
  aiTasks: AITask[] // 所有AI任务列表
}

export type AppAction =
  | { type: 'CREATE_CHAT'; payload: { title: string; folderId?: string; lineage?: PageLineage } }
  | {
      type: 'CREATE_AND_OPEN_CHAT'
      payload: {
        title: string
        folderId?: string
        initialMessage?: ChatMessage
        lineage?: PageLineage
      }
    }
  | {
      type: 'CREATE_CHAT_FROM_CELL'
      payload: {
        folderId?: string
        horizontalItem: string
        verticalItem: string
        cellContent: string
        metadata: any
        sourcePageId?: string
      }
    }
  | {
      type: 'CREATE_CROSSTAB_CHAT'
      payload: { title: string; folderId?: string; lineage?: PageLineage }
    }
  | {
      type: 'CREATE_AND_OPEN_CROSSTAB_CHAT'
      payload: { title: string; folderId?: string; lineage?: PageLineage }
    }
  | {
      type: 'CREATE_CROSSTAB_FROM_OBJECTS'
      payload: {
        title: string
        folderId?: string
        horizontalNodeId: string
        verticalNodeId: string
        objectData: ObjectData
        horizontalContext?: NodeContext
        verticalContext?: NodeContext
        sourcePageId?: string
      }
    }
  | {
      type: 'CREATE_OBJECT_CHAT'
      payload: { title: string; folderId?: string; lineage?: PageLineage }
    }
  | {
      type: 'CREATE_AND_OPEN_OBJECT_CHAT'
      payload: { title: string; folderId?: string; lineage?: PageLineage }
    }
  | {
      type: 'CREATE_CHAT_FROM_OBJECT_NODE'
      payload: {
        folderId?: string
        nodeId: string
        nodeName: string
        nodeContext: string
        sourcePageId?: string
      }
    }
  | { type: 'UPDATE_CHAT'; payload: { id: string; updates: Partial<Page> } }
  | { type: 'UPDATE_PAGE_LINEAGE'; payload: { pageId: string; lineage: Partial<PageLineage> } }
  | { type: 'ADD_GENERATED_PAGE'; payload: { sourcePageId: string; generatedPageId: string } }
  | {
      type: 'UPDATE_CROSSTAB_STEP'
      payload: { chatId: string; stepIndex: number; response: string }
    }
  | { type: 'COMPLETE_CROSSTAB_STEP'; payload: { chatId: string; stepIndex: number } }
  | {
      type: 'UPDATE_CROSSTAB_DATA'
      payload: { chatId: string; data: Partial<CrosstabChat['crosstabData']> }
    }
  // 对象相关操作
  | {
      type: 'UPDATE_OBJECT_DATA'
      payload: { chatId: string; data: Partial<ObjectChat['objectData']> }
    }
  | {
      type: 'ADD_OBJECT_NODE'
      payload: { chatId: string; node: ObjectNode; parentId?: string }
    }
  | {
      type: 'UPDATE_OBJECT_NODE'
      payload: { chatId: string; nodeId: string; updates: Partial<ObjectNode> }
    }
  | {
      type: 'DELETE_OBJECT_NODE'
      payload: { chatId: string; nodeId: string }
    }
  | {
      type: 'CLEAR_OBJECT_NODE_CHILDREN'
      payload: { chatId: string; nodeId: string }
    }
  | {
      type: 'SELECT_OBJECT_NODE'
      payload: { chatId: string; nodeId: string | null }
    }
  | {
      type: 'TOGGLE_OBJECT_NODE_EXPANSION'
      payload: { chatId: string; nodeId: string }
    }
  | {
      type: 'EXPAND_OBJECT_NODE'
      payload: { chatId: string; nodeId: string }
    }
  | {
      type: 'COLLAPSE_OBJECT_NODE'
      payload: { chatId: string; nodeId: string }
    }
  | {
      type: 'SEARCH_OBJECT_NODES'
      payload: { chatId: string; query: string }
    }
  | {
      type: 'CLEAR_OBJECT_SEARCH'
      payload: { chatId: string }
    }
  | {
      type: 'GENERATE_OBJECT_CHILDREN'
      payload: {
        chatId: string
        nodeId: string
        prompt: string
        modelId?: string
        generationId?: string
      }
    }
  | {
      type: 'ADD_OBJECT_GENERATION_RECORD'
      payload: { chatId: string; record: ObjectGenerationRecord }
    }
  | {
      type: 'UPDATE_GENERATION_RECORD'
      payload: { chatId: string; generationId: string; generatedNodeIds: string[] }
    }
  | {
      type: 'IMPORT_OBJECT_FROM_JSON'
      payload: { chatId: string; jsonData: any; targetNodeId?: string }
    }
  | {
      type: 'EXPORT_OBJECT_NODE'
      payload: { chatId: string; nodeId: string }
    }
  | { type: 'DELETE_CHAT'; payload: { id: string } }
  | { type: 'DELETE_MULTIPLE_PAGES'; payload: { chatIds: string[] } }
  | { type: 'CREATE_FOLDER'; payload: { name: string; parentId?: string } }
  | { type: 'UPDATE_FOLDER'; payload: { id: string; updates: Partial<PageFolder> } }
  | { type: 'DELETE_FOLDER'; payload: { id: string } }
  | { type: 'OPEN_TAB'; payload: { chatId: string } }
  | { type: 'CLOSE_TAB'; payload: { chatId: string } }
  | { type: 'CLOSE_OTHER_TABS'; payload: { chatId: string } }
  | { type: 'CLOSE_TABS_TO_RIGHT'; payload: { chatId: string } }
  | { type: 'CLOSE_ALL_TABS' }
  | { type: 'PIN_TAB'; payload: { chatId: string } }
  | { type: 'UNPIN_TAB'; payload: { chatId: string } }
  | { type: 'SET_ACTIVE_TAB'; payload: { chatId: string } }
  | { type: 'REORDER_TABS'; payload: { newOrder: string[] } }
  | {
      type: 'SET_SELECTED_NODE'
      payload: { nodeId: string | null; nodeType: 'folder' | 'chat' | null }
    }
  | { type: 'SET_CHECKED_NODES'; payload: { nodeIds: string[] } }
  | { type: 'CLEAR_CHECKED_NODES' }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<Settings> }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR_WIDTH'; payload: { width: number } }
  | { type: 'ADD_MESSAGE'; payload: { chatId: string; message: ChatMessage } }
  | {
      type: 'ADD_MESSAGE_TO_PARENT'
      payload: { chatId: string; message: ChatMessage; parentId?: string }
    }
  | {
      type: 'UPDATE_MESSAGE_CONTENT'
      payload: { chatId: string; messageId: string; content: string }
    }
  | {
      type: 'UPDATE_MESSAGE_REASONING'
      payload: { chatId: string; messageId: string; reasoning_content: string }
    }
  | {
      type: 'COMPLETE_MESSAGE_STREAMING'
      payload: { chatId: string; messageId: string; content: string }
    }
  | {
      type: 'COMPLETE_MESSAGE_STREAMING_WITH_REASONING'
      payload: { chatId: string; messageId: string; content: string; reasoning_content?: string }
    }
  | { type: 'REMOVE_MESSAGE'; payload: { chatId: string; messageId: string } }
  | {
      type: 'UPDATE_STREAMING_MESSAGE'
      payload: { chatId: string; content: string; timestamp: number }
    }
  | { type: 'COMPLETE_STREAMING_MESSAGE'; payload: { chatId: string; message: ChatMessage } }
  | { type: 'CLEAR_STREAMING_MESSAGE'; payload: { chatId: string } }
  | { type: 'SWITCH_BRANCH'; payload: { chatId: string; messageId: string; branchIndex: number } }
  | { type: 'UPDATE_CURRENT_PATH'; payload: { chatId: string; path: string[] } }
  | { type: 'LOAD_STATE'; payload: Partial<AppState> }
  | { type: 'MOVE_CHAT'; payload: { chatId: string; targetFolderId?: string; newOrder?: number } }
  | {
      type: 'MOVE_FOLDER'
      payload: { folderId: string; targetParentId?: string; newOrder: number }
    }
  | { type: 'REORDER_PAGES_IN_FOLDER'; payload: { folderId?: string; chatIds: string[] } }
  // 搜索相关的操作
  | { type: 'SET_SEARCH_QUERY'; payload: { query: string } }
  | { type: 'SET_SEARCH_RESULTS'; payload: { results: SearchResult[] } }
  | { type: 'SET_IS_SEARCHING'; payload: { isSearching: boolean } }
  | { type: 'TOGGLE_SEARCH_RESULTS'; payload: { show: boolean } }
  | { type: 'CLEAR_SEARCH' }
  // 消息折叠相关操作
  | { type: 'TOGGLE_MESSAGE_COLLAPSE'; payload: { chatId: string; messageId: string } }
  | { type: 'COLLAPSE_ALL_MESSAGES'; payload: { chatId: string } }
  | { type: 'EXPAND_ALL_MESSAGES'; payload: { chatId: string } }
  // 页面溯源显示折叠相关操作
  | { type: 'TOGGLE_LINEAGE_DISPLAY_COLLAPSE'; payload: { pageId: string } }
  // AI任务监控相关操作
  | { type: 'ADD_AI_TASK'; payload: { task: AITask } }
  | { type: 'UPDATE_AI_TASK'; payload: { taskId: string; updates: Partial<AITask> } }
  | { type: 'REMOVE_AI_TASK'; payload: { taskId: string } }
  | { type: 'CLEAR_COMPLETED_AI_TASKS' }
  | { type: 'CLEAR_ALL_AI_TASKS' }
