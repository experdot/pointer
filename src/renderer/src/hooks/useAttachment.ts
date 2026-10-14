/**
 * 附件 Hook
 *
 * 附件直接导入工作区的 .pointer/attachments 目录，由内核负责落盘；
 * 展示层只持有引用（相对工作区根目录的路径）。
 */

import { useCallback } from 'react'
import type { AttachmentRef, PickedImage } from '@renderer/types/shared'
import { command, query } from '../runtime/client'
import { useChatUIStore } from '../stores/chatUIStore'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

function isValid(file: { name: string; mimeType?: string; type?: string; size: number }): boolean {
  const mimeType = file.mimeType ?? file.type ?? 'application/octet-stream'
  if (!ALLOWED_TYPES.includes(mimeType)) {
    console.warn(`不支持的附件类型：${file.name}`)
    return false
  }
  if (file.size > MAX_SIZE) {
    console.warn(`附件过大：${file.name}`)
    return false
  }
  return true
}

interface UseAttachmentResult {
  pendingAttachments: AttachmentRef[]
  addAttachments: (files: FileList | File[]) => Promise<void>
  addAttachmentsFromSelector: () => Promise<void>
  removeAttachment: (attachmentId: string) => Promise<void>
  clearAttachments: () => void
  moveAttachmentsToMessage: (attachments: AttachmentRef[]) => Promise<AttachmentRef[]>
}

export function useAttachment(pageId: string): UseAttachmentResult {
  const pendingAttachments = useChatUIStore((state) => state.getState(pageId).pendingAttachments)
  const addPendingAttachment = useChatUIStore((state) => state.addPendingAttachment)
  const removePendingAttachment = useChatUIStore((state) => state.removePendingAttachment)
  const clearPendingAttachments = useChatUIStore((state) => state.clearPendingAttachments)

  const importFiles = useCallback(
    async (files: Array<{ name: string; mimeType: string; size: number; dataBase64: string }>) => {
      if (files.length === 0) return
      const imported = await command('attachment.import', {
        pageId,
        files: files.map((file) => ({
          name: file.name,
          mimeType: file.mimeType,
          dataBase64: file.dataBase64
        }))
      })
      for (const attachment of imported) addPendingAttachment(pageId, attachment)
    },
    [addPendingAttachment, pageId]
  )

  const addAttachments = useCallback(
    async (files: FileList | File[]) => {
      const accepted: Array<{ name: string; mimeType: string; size: number; dataBase64: string }> =
        []

      for (const file of Array.from(files)) {
        if (!isValid({ name: file.name, type: file.type, size: file.size })) continue
        accepted.push({
          name: file.name,
          mimeType: file.type,
          size: file.size,
          dataBase64: await readFileAsBase64(file)
        })
      }

      await importFiles(accepted)
    },
    [importFiles]
  )

  const addAttachmentsFromSelector = useCallback(async () => {
    const picked = await command('dialog.pickImages', { multiple: true })
    await importFiles(
      picked
        .filter((image) => isValid(image))
        .map((image) => ({
          name: image.name,
          mimeType: image.mimeType,
          size: image.size,
          dataBase64: image.dataBase64
        }))
    )
  }, [importFiles])

  const removeAttachment = useCallback(
    async (attachmentId: string) => {
      const attachment = pendingAttachments.find((item) => item.id === attachmentId)
      removePendingAttachment(pageId, attachmentId)
      if (attachment) {
        await command('attachment.delete', { relativePath: attachment.relativePath })
      }
    },
    [pageId, pendingAttachments, removePendingAttachment]
  )

  const clearAttachments = useCallback(() => {
    clearPendingAttachments(pageId)
  }, [clearPendingAttachments, pageId])

  /** 附件在导入时已就位，这里只做透传，保持调用方接口不变 */
  const moveAttachmentsToMessage = useCallback(
    async (attachments: AttachmentRef[]) => attachments,
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

/** 读取附件为 data URL（用于预览） */
export async function getAttachmentDataUrl(attachment: AttachmentRef): Promise<string> {
  const content = await query('attachment.read', { relativePath: attachment.relativePath })
  return `data:${content.mimeType};base64,${content.dataBase64}`
}

/** 通过文件选择器导入附件（用于消息编辑等场景） */
export async function selectAndSaveAttachments(pageId: string): Promise<AttachmentRef[]> {
  const picked: PickedImage[] = await command('dialog.pickImages', { multiple: true })
  const files = picked.filter((image) => isValid(image))
  if (files.length === 0) return []

  return command('attachment.import', {
    pageId,
    files: files.map((image) => ({
      name: image.name,
      mimeType: image.mimeType,
      dataBase64: image.dataBase64
    }))
  })
}

/** 导入拖拽或粘贴进来的文件（用于消息编辑等场景） */
export async function importAttachmentsFromFiles(
  pageId: string,
  files: File[]
): Promise<AttachmentRef[]> {
  const accepted: Array<{ name: string; mimeType: string; dataBase64: string }> = []

  for (const file of files) {
    if (!isValid({ name: file.name, type: file.type, size: file.size })) continue
    accepted.push({
      name: file.name,
      mimeType: file.type,
      dataBase64: await readFileAsBase64(file)
    })
  }

  if (accepted.length === 0) return []
  return command('attachment.import', { pageId, files: accepted })
}
