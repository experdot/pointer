// 导出类型定义
export type {
  DeepSeekMessage,
  DeepSeekChat,
  OpenAIMessage,
  OpenAIChat,
  ChatFormat,
  ImportResult,
  SelectableChatItem,
  ParseResult
} from './types'


// 导出格式检测
export { detectChatFormat } from './formatDetector'

// 导出消息转换器
export { convertOpenAIMessages, convertDeepSeekMessages } from './converters'

// 导出工具函数
export { generateFolderName } from './utils'

// 导出核心导入功能
export { parseExternalChatHistory, importSelectedChats } from './importer'
