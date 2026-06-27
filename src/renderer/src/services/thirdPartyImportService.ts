/**
 * 第三方聊天数据导入服务
 */

import { stores } from '../stores/registry'
import type { PageRecord, MessagesRecord } from '../persistence/interfaces/userData'
import type {
  ParsedConversation,
  ImportOptions,
  ImportResult,
  ImportPlatform
} from './importers/types'

// 平台显示名称
const PLATFORM_NAMES: Record<ImportPlatform, string> = {
  openai: 'OpenAI 导入',
  deepseek: 'DeepSeek 导入',
  claude: 'Claude 导入',
  custom: '第三方导入'
}

// 批量大小
const BATCH_SIZE = 50

/**
 * 格式化日期时间
 */
function formatDateTime(date: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 创建带时间戳的导入文件夹
 */
async function createPlatformFolder(platform: ImportPlatform): Promise<string> {
  const baseName = PLATFORM_NAMES[platform]
  const timestamp = formatDateTime(new Date())
  const folderName = `${baseName} ${timestamp}`

  const folder = await stores.folder.create({
    name: folderName,
    expanded: true,
    order: 0
  })

  return folder.id
}

/**
 * 准备单个对话的导入数据
 */
function prepareConversation(
  conv: ParsedConversation,
  platformFolders: Map<ImportPlatform, string>
): { page: PageRecord; messagesRecord: MessagesRecord } | null {
  try {
    const pageId = crypto.randomUUID()

    // 重新映射消息 ID
    const idMap = new Map<string, string>()
    const messages = conv.messages.map((m) => {
      const newId = crypto.randomUUID()
      idMap.set(m.id, newId)
      return {
        id: newId,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        reasoning_content: m.reasoning_content,
        createdAt: m.createdAt,
        parentMessageId: m.parentMessageId,
        branchIndex: m.branchIndex
      }
    })

    // 更新 parentMessageId 引用
    messages.forEach((m) => {
      if (m.parentMessageId && idMap.has(m.parentMessageId)) {
        m.parentMessageId = idMap.get(m.parentMessageId)
      } else if (m.parentMessageId) {
        m.parentMessageId = undefined
      }
    })

    const leafMessageId = conv.leafMessageId ? idMap.get(conv.leafMessageId) : undefined

    return {
      page: {
        id: pageId,
        type: 'item',
        name: conv.title,
        parentFolderId: platformFolders.get(conv.platform),
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      },
      messagesRecord: {
        pageId,
        messages,
        topics: [],
        leafMessageId: leafMessageId || messages[messages.length - 1]?.id
      }
    }
  } catch {
    return null
  }
}

/**
 * 导入对话（批量）
 */
export async function importConversations(
  conversations: ParsedConversation[],
  options: ImportOptions,
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    skipped: 0,
    failed: 0,
    errors: []
  }

  // 过滤出选中的对话
  const selected = conversations.filter((c) => options.selectedIds.has(c.id))
  if (selected.length === 0) return result

  // 按平台分组，创建对应文件夹
  const platformFolders = new Map<ImportPlatform, string>()
  const platforms = [...new Set(selected.map((c) => c.platform))]

  for (const platform of platforms) {
    const folderId = await createPlatformFolder(platform)
    platformFolders.set(platform, folderId)
  }

  // 准备所有数据
  const prepared: Array<{ page: PageRecord; messagesRecord: MessagesRecord; title: string }> = []
  for (const conv of selected) {
    const data = prepareConversation(conv, platformFolders)
    if (data) {
      prepared.push({ ...data, title: conv.title })
    } else {
      result.failed++
      result.errors.push(`${conv.title}: 数据准备失败`)
    }
  }

  // 分批导入
  for (let i = 0; i < prepared.length; i += BATCH_SIZE) {
    const batch = prepared.slice(i, i + BATCH_SIZE)

    for (const item of batch) {
      try {
        await stores.page.create(item.page)
        await stores.message.update(item.messagesRecord.pageId, () => item.messagesRecord)
        result.success++
      } catch (itemErr) {
        result.failed++
        result.errors.push(
          `${item.title}: ${itemErr instanceof Error ? itemErr.message : 'Unknown error'}`
        )
      }
    }

    onProgress?.(Math.min(i + BATCH_SIZE, prepared.length), prepared.length)
  }

  return result
}

/**
 * 获取平台显示名称
 */
export function getPlatformName(platform: ImportPlatform): string {
  return PLATFORM_NAMES[platform] || platform
}
