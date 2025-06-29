// 导入共享类型
import type { ChatMessage, LLMConfig } from '@shared/types'
// 重新导出共享类型
export type { ChatMessage, LLMConfig }

export interface Chat {
  id: string
  title: string
  messages: ChatMessage[]
  // 树状结构支持
  messageMap?: { [messageId: string]: ChatMessage } // 消息ID到消息的映射
  currentPath?: string[] // 当前选择的消息路径（从根到叶子）
  rootMessageId?: string // 根消息ID
  folderId?: string
  createdAt: number
  updatedAt: number
  order?: number // 添加排序字段
  pinned?: boolean // 是否固定标签页
  streamingMessage?: {
    content: string
    timestamp: number
  }
}

export interface ChatFolder {
  id: string
  name: string
  expanded?: boolean
  createdAt: number
  order?: number // 添加排序字段
  parentId?: string // 支持嵌套文件夹
}

export interface Settings {
  theme: 'light' | 'dark' | 'auto'
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

export interface AppState {
  chats: Chat[]
  folders: ChatFolder[]
  openTabs: string[] // chat ids
  activeTabId: string | null
  selectedNodeId: string | null // 当前选中的节点ID
  selectedNodeType: 'folder' | 'chat' | null // 当前选中的节点类型
  multiSelectMode: boolean // 多选模式
  checkedNodeIds: string[] // 多选状态下选中的节点ID数组
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
}

export type AppAction =
  | { type: 'CREATE_CHAT'; payload: { title: string; folderId?: string } }
  | { type: 'CREATE_AND_OPEN_CHAT'; payload: { title: string; folderId?: string } }
  | { type: 'UPDATE_CHAT'; payload: { id: string; updates: Partial<Chat> } }
  | { type: 'DELETE_CHAT'; payload: { id: string } }
  | { type: 'DELETE_MULTIPLE_CHATS'; payload: { chatIds: string[] } }
  | { type: 'CREATE_FOLDER'; payload: { name: string; parentId?: string } }
  | { type: 'UPDATE_FOLDER'; payload: { id: string; updates: Partial<ChatFolder> } }
  | { type: 'DELETE_FOLDER'; payload: { id: string } }
  | { type: 'OPEN_TAB'; payload: { chatId: string } }
  | { type: 'CLOSE_TAB'; payload: { chatId: string } }
  | { type: 'CLOSE_OTHER_TABS'; payload: { chatId: string } }
  | { type: 'CLOSE_TABS_TO_RIGHT'; payload: { chatId: string } }
  | { type: 'CLOSE_ALL_TABS' }
  | { type: 'PIN_TAB'; payload: { chatId: string } }
  | { type: 'UNPIN_TAB'; payload: { chatId: string } }
  | { type: 'SET_ACTIVE_TAB'; payload: { chatId: string } }
  | {
      type: 'SET_SELECTED_NODE'
      payload: { nodeId: string | null; nodeType: 'folder' | 'chat' | null }
    }
  | { type: 'TOGGLE_MULTI_SELECT_MODE' }
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
  | { type: 'REORDER_CHATS_IN_FOLDER'; payload: { folderId?: string; chatIds: string[] } }
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
