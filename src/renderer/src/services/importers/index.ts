/**
 * 第三方聊天数据导入 - 统一导出
 */

import { OpenAIImporter } from './openai'
import { DeepSeekImporter } from './deepseek'
import { PointerImporter } from './pointer'
import type { ConversationImporter, ParsedConversation } from './types'

// 注册所有导入器
export const importers: ConversationImporter[] = [
  new PointerImporter(), // 优先检测 Pointer 格式（特征明确）
  new OpenAIImporter(),
  new DeepSeekImporter()
]

/**
 * 自动检测文件格式并返回对应的导入器
 */
export function detectImporter(data: unknown): ConversationImporter | null {
  for (const importer of importers) {
    if (importer.detect(data)) {
      return importer
    }
  }
  return null
}

/**
 * 解析导入文件
 * 自动检测格式并解析
 */
export function parseImportFile(data: unknown): {
  importer: ConversationImporter
  conversations: ParsedConversation[]
} | null {
  const importer = detectImporter(data)
  if (!importer) return null

  try {
    return {
      importer,
      conversations: importer.parse(data)
    }
  } catch {
    return null
  }
}

/**
 * 获取支持的平台列表（用于 UI 显示）
 */
export function getSupportedPlatforms(): Array<{
  platform: string
  name: string
  description: string
}> {
  return importers.map((importer) => ({
    platform: importer.platform,
    name: importer.name,
    description: importer.description
  }))
}

// 导出类型
export type {
  ConversationImporter,
  ParsedConversation,
  ParsedMessage,
  ImportPlatform,
  ImportOptions,
  ImportResult
} from './types'

// 导出具体实现（方便测试和单独使用）
export { OpenAIImporter } from './openai'
export { DeepSeekImporter } from './deepseek'
export { PointerImporter } from './pointer'
export { BaseImporter } from './base'
