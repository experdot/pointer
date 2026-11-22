/**
 * 第三方聊天记录导入服务
 *
 * 解析与写盘都在内核完成，这里只做文件内容搬运与结果汇总。
 */

import { t } from '@renderer/i18n'
import type { ImportDestination } from '@shared/contracts'
import { command } from '../runtime/client'

export { prepareDeepSeekIndex } from '../runtime/client'

type ImportPlatform = 'openai' | 'deepseek' | 'pointer'

interface ImportFileInput {
  name: string
  content: string
}

interface ImportSummary {
  success: number
  skipped: number
  failed: number
  errors: string[]
}

const PLATFORM_LABELS: Record<ImportPlatform, string> = {
  openai: 'ChatGPT',
  deepseek: 'DeepSeek',
  get pointer(): string {
    return t('import.legacyPointer')
  }
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

export async function importDeepSeekIndex(
  draftId: string,
  ids: string[],
  destination: ImportDestination
): Promise<ImportSummary> {
  const { importedPages } = await command('library.importDeepSeekIndex', {
    draftId,
    ids,
    ...destination
  })
  return { success: importedPages, skipped: 0, failed: 0, errors: [] }
}

export async function importConversations(
  files: readonly ImportFileInput[],
  options: ImportDestination & { platform: ImportPlatform; ids?: string[] }
): Promise<ImportSummary> {
  const summary: ImportSummary = { success: 0, skipped: 0, failed: 0, errors: [] }
  const { platform, ids, ...destination } = options

  for (const file of files) {
    try {
      const result = await command('library.import', {
        source: KERNEL_SOURCES[platform],
        payload: file.content,
        ids,
        ...destination
      })

      if (result.importedPages === 0) {
        summary.skipped += 1
        summary.errors.push(t('import.fileEmpty', { v0: String(file.name) }))
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
