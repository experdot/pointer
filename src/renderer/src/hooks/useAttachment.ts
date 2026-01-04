import { useCallback } from 'react'
import { useChatUIStore } from '../stores/chatUIStore'
import type { FileAttachment } from '../types/type'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

// 从文件名推断 MIME 类型
function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp'
  }
  return mimeMap[ext || ''] || 'image/jpeg'
}

// 生成唯一 ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

// 读取 File 对象为 base64
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // 移除 data:xxx;base64, 前缀
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

interface UseAttachmentResult {
  pendingAttachments: FileAttachment[]
  addAttachments: (files: FileList | File[]) => Promise<void>
  addAttachmentsFromSelector: () => Promise<void>
  removeAttachment: (attachmentId: string) => Promise<void>
  clearAttachments: () => void
  moveAttachmentsToMessage: (
    attachments: FileAttachment[],
    pageId: string,
    messageId: string
  ) => Promise<FileAttachment[]>
}

export function useAttachment(pageId: string): UseAttachmentResult {
  const { getState, addPendingAttachment, removePendingAttachment, clearPendingAttachments } =
    useChatUIStore()
  const pendingAttachments = getState(pageId).pendingAttachments

  // 从拖拽或粘贴的 File 对象添加附件
  const addAttachments = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)

      for (const file of fileArray) {
        // 类型校验
        if (!ALLOWED_TYPES.includes(file.type)) {
          console.warn(`不支持的文件类型: ${file.type}`)
          continue
        }

        // 大小校验
        if (file.size > MAX_SIZE) {
          console.warn(`文件过大: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)
          continue
        }

        const fileId = generateId()

        // 读取文件为 base64
        const base64Content = await readFileAsBase64(file)

        // 保存到 temp 目录
        const result = await window.api.attachment.save({
          fileId,
          fileName: file.name,
          base64Content
        })

        if (result.success && result.localPath) {
          const attachment: FileAttachment = {
            id: fileId,
            name: file.name,
            type: file.type,
            size: file.size,
            localPath: result.localPath,
            createdAt: Date.now()
          }
          addPendingAttachment(pageId, attachment)
        } else {
          console.error('保存附件失败:', result.error)
        }
      }
    },
    [pageId, addPendingAttachment]
  )

  // 从文件选择器添加附件
  const addAttachmentsFromSelector = useCallback(async () => {
    const result = await window.api.selectFiles({
      multiple: true,
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }]
    })

    if (!result.success || result.cancelled || !result.files) {
      return
    }

    for (const file of result.files) {
      const mimeType = getMimeType(file.name)

      // 类型校验
      if (!ALLOWED_TYPES.includes(mimeType)) {
        console.warn(`不支持的文件类型: ${file.name}`)
        continue
      }

      // 大小校验
      if (file.size > MAX_SIZE) {
        console.warn(`文件过大: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)
        continue
      }

      const fileId = generateId()

      // 保存到 temp 目录（selectFiles 已返回 base64 content）
      const saveResult = await window.api.attachment.save({
        fileId,
        fileName: file.name,
        base64Content: file.content
      })

      if (saveResult.success && saveResult.localPath) {
        const attachment: FileAttachment = {
          id: fileId,
          name: file.name,
          type: mimeType,
          size: file.size,
          localPath: saveResult.localPath,
          createdAt: Date.now()
        }
        addPendingAttachment(pageId, attachment)
      } else {
        console.error('保存附件失败:', saveResult.error)
      }
    }
  }, [pageId, addPendingAttachment])

  // 移除待发送的附件
  const removeAttachment = useCallback(
    async (attachmentId: string) => {
      const attachment = pendingAttachments.find((a) => a.id === attachmentId)

      if (attachment) {
        await window.api.attachment.delete(attachment.localPath)
        removePendingAttachment(pageId, attachmentId)
      }
    },
    [pageId, pendingAttachments, removePendingAttachment]
  )

  // 清空所有待发送附件
  const clearAttachments = useCallback(() => {
    clearPendingAttachments(pageId)
  }, [pageId, clearPendingAttachments])

  // 将附件从 temp 移动到正式目录
  const moveAttachmentsToMessage = useCallback(
    async (
      attachments: FileAttachment[],
      targetPageId: string,
      messageId: string
    ): Promise<FileAttachment[]> => {
      const movedAttachments: FileAttachment[] = []

      // 并行移动所有附件
      const results = await Promise.all(
        attachments.map(async (attachment) => {
          const result = await window.api.attachment.move({
            fileId: attachment.id,
            fileName: attachment.name,
            fromPath: attachment.localPath,
            pageId: targetPageId,
            messageId
          })

          if (result.success && result.localPath) {
            return { ...attachment, localPath: result.localPath }
          }
          console.error('移动附件失败:', result.error)
          return attachment
        })
      )

      movedAttachments.push(...results)
      return movedAttachments
    },
    []
  )

  return {
    pendingAttachments,
    addAttachments,
    addAttachmentsFromSelector,
    removeAttachment,
    clearAttachments,
    moveAttachmentsToMessage
  }
}

// 读取附件为 data URL（用于预览）
export async function getAttachmentDataUrl(attachment: FileAttachment): Promise<string> {
  const result = await window.api.attachment.read(attachment.localPath)
  if (result.success && result.content) {
    return `data:${attachment.type};base64,${result.content}`
  }
  throw new Error(result.error || 'Failed to read attachment')
}

// 独立的文件选择并保存函数（用于消息编辑等场景）
export async function selectAndSaveAttachments(): Promise<FileAttachment[]> {
  const result = await window.api.selectFiles({
    multiple: true,
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }]
  })

  if (!result.success || result.cancelled || !result.files) {
    return []
  }

  const attachments: FileAttachment[] = []

  for (const file of result.files) {
    const mimeType = getMimeType(file.name)

    if (!ALLOWED_TYPES.includes(mimeType)) {
      console.warn(`不支持的文件类型: ${file.name}`)
      continue
    }

    if (file.size > MAX_SIZE) {
      console.warn(`文件过大: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)
      continue
    }

    const fileId = generateId()

    const saveResult = await window.api.attachment.save({
      fileId,
      fileName: file.name,
      base64Content: file.content
    })

    if (saveResult.success && saveResult.localPath) {
      attachments.push({
        id: fileId,
        name: file.name,
        type: mimeType,
        size: file.size,
        localPath: saveResult.localPath,
        createdAt: Date.now()
      })
    } else {
      console.error('保存附件失败:', saveResult.error)
    }
  }

  return attachments
}
