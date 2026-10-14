/**
 * 第三方聊天记录导入服务
 *
 * 解析与写盘都在内核完成，这里只做文件内容搬运与结果汇总。
 */

import { command } from '../runtime/client'

export type ImportPlatform = 'openai' | 'deepseek' | 'pointer'

export interface ImportFileInput {
  name: string
  content: string
}

export interface ImportSummary {
  success: number
  skipped: number
  failed: number
  errors: string[]
}

const PLATFORM_LABELS: Record<ImportPlatform, string> = {
  openai: 'ChatGPT',
  deepseek: 'DeepSeek',
  pointer: 'Pointer 旧版'
}

/** 内核使用 chatgpt 作为 ChatGPT 的来源标识 */
const KERNEL_SOURCES: Record<ImportPlatform, 'chatgpt' | 'deepseek' | 'pointer'> = {
  openai: 'chatgpt',
  deepseek: 'deepseek',
  pointer: 'pointer'
}

export function getPlatformName(platform: ImportPlatform | string): string {
  return PLATFORM_LABELS[platform as ImportPlatform] ?? platform
}

export function getSupportedPlatforms(): Array<{ platform: ImportPlatform; name: string }> {
  return (Object.keys(PLATFORM_LABELS) as ImportPlatform[]).map((platform) => ({
    platform,
    name: PLATFORM_LABELS[platform]
  }))
}

export async function importConversations(
  files: readonly ImportFileInput[],
  options: { platform: ImportPlatform; folderName?: string; ids?: string[] }
): Promise<ImportSummary> {
  const summary: ImportSummary = { success: 0, skipped: 0, failed: 0, errors: [] }

  for (const file of files) {
    try {
      const result = await command('library.import', {
        source: KERNEL_SOURCES[options.platform],
        payload: file.content,
        folderName: options.folderName,
        ids: options.ids
      })

      if (result.importedPages === 0) {
        summary.skipped += 1
        summary.errors.push(`${file.name}：没有可导入的对话`)
      } else {
        summary.success += result.importedPages
      }
    } catch (error) {
      summary.failed += 1
      summary.errors.push(`${file.name}：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return summary
}
