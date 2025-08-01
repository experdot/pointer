import { ChatFormat } from './types'

/**
 * 生成导入文件夹名称
 */
export function generateFolderName(formatType: ChatFormat, data: any): string {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD格式

  if (formatType === 'deepseek') {
    // 尝试从DeepSeek数据中获取日期
    if (Array.isArray(data) && data.length > 0) {
      const firstChat = data[0]
      if (firstChat.inserted_at) {
        const chatDate = new Date(firstChat.inserted_at).toISOString().split('T')[0]
        return `DeepSeek导入-${chatDate}`
      }
    }
    return `DeepSeek导入-${today}`
  } else if (formatType === 'openai') {
    // 尝试从OpenAI数据中获取日期
    if (Array.isArray(data) && data.length > 0 && data[0].create_time) {
      const chatDate = new Date(data[0].create_time * 1000).toISOString().split('T')[0]
      return `OpenAI导入-${chatDate}`
    } else if (data.create_time) {
      const chatDate = new Date(data.create_time * 1000).toISOString().split('T')[0]
      return `OpenAI导入-${chatDate}`
    }
    return `OpenAI导入-${today}`
  } else {
    return `外部导入-${today}`
  }
}
