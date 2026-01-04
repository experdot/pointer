/**
 * 第三方聊天数据导入服务
 */

import { usePagesStore } from '../stores/pagesStore'
import { useFoldersStore } from '../stores/foldersStore'
import * as db from '../utils/database'
import type { PageRecord, MessagesRecord } from '../utils/database'
import type { PageFolder } from '../types/type'
import type { ParsedConversation, ImportOptions, ImportResult, ImportPlatform } from './importers/types'

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
 * 获取或创建来源文件夹
 */
async function getOrCreatePlatformFolder(platform: ImportPlatform): Promise<string> {
  const folderName = PLATFORM_NAMES[platform]
  const foldersStore = useFoldersStore.getState()

  // 查找现有文件夹
  const existing = foldersStore.folders.find((f) => f.name === folderName)
  if (existing) return existing.id

  // 创建新文件夹
  const folder: PageFolder = {
    type: 'folder',
    id: crypto.randomUUID(),
    name: folderName,
    expanded: true,
    order: 0,
    createdAt: Date.now()
  }

  await foldersStore.addFolder(folder)
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

    const rootMessage = messages.find((m) => !m.parentMessageId)
    const leafMessageId = conv.leafMessageId ? idMap.get(conv.leafMessageId) : undefined

    return {
      page: {
        id: pageId,
        type: 'page',
        title: conv.title,
        parentFolderId: platformFolders.get(conv.platform),
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      },
      messagesRecord: {
        pageId,
        messages,
        rootMessageId: rootMessage?.id,
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
    const folderId = await getOrCreatePlatformFolder(platform)
    platformFolders.set(platform, folderId)
  }

  const pagesStore = usePagesStore.getState()

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
    const pages = batch.map((b) => b.page)
    const messagesRecords = batch.map((b) => b.messagesRecord)

    try {
      // 批量写入页面和消息
      await Promise.all([pagesStore.addPages(pages), db.putMessagesBatch(messagesRecords)])

      result.success += batch.length
    } catch (err) {
      // 批量失败时，逐个重试
      for (const item of batch) {
        try {
          await pagesStore.addPage(item.page)
          await db.putMessages(item.messagesRecord)
          result.success++
        } catch (itemErr) {
          result.failed++
          result.errors.push(
            `${item.title}: ${itemErr instanceof Error ? itemErr.message : 'Unknown error'}`
          )
        }
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
