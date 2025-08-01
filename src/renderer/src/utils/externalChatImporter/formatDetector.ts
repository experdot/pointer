import { ChatFormat } from './types'

/**
 * 检测聊天历史的格式类型
 */
export function detectChatFormat(data: any): ChatFormat {
  if (Array.isArray(data)) {
    const firstItem = data[0]
    if (firstItem && firstItem.mapping && firstItem.title && firstItem.inserted_at) {
      return 'deepseek'
    }
    // 检查OpenAI数组格式
    if (
      firstItem &&
      firstItem.mapping &&
      firstItem.title &&
      firstItem.create_time &&
      firstItem.conversation_id
    ) {
      return 'openai'
    }
  }

  if (data.title && data.mapping && data.create_time) {
    return 'openai'
  }

  return 'unknown'
}
