/**
 * 新建节点时的落位计算
 *
 * 新建对话只决定「放进哪个文件夹」，
 * 位置固定落到该层级最前面（由内核处理）——
 * 选中文件夹 → 放进该文件夹内部；选中对话 → 放进它所在的文件夹；
 * 未选中任何节点时返回空参照，由内核回落到根目录最前面。
 * 新建文件夹（resolveFolderCreationTarget）保持「紧随参照节点之后」。
 */

import type { Folder, Page } from '@renderer/types/shared'

interface PageCreationTarget {
  parentFolderId?: string
}

interface FolderCreationTarget {
  parentFolderId?: string
  /** 新建文件夹落位：插到该参照节点之后 */
  afterNodeId?: string
}

export function resolvePageCreationTarget(
  selectedKey: string | null | undefined,
  folders: readonly Folder[],
  pages: readonly Page[]
): PageCreationTarget {
  if (!selectedKey) return {}

  const folder = folders.find((item) => item.id === selectedKey)
  if (folder) {
    return { parentFolderId: folder.id }
  }

  const page = pages.find((item) => item.id === selectedKey)
  if (page) {
    return { parentFolderId: page.parentFolderId }
  }

  return {}
}

/** 新建文件夹的落位：保持「紧随选中节点之后」，参照节点是对话时也一样 */
export function resolveFolderCreationTarget(
  selectedKey: string | null | undefined,
  folders: readonly Folder[],
  pages: readonly Page[]
): FolderCreationTarget {
  if (!selectedKey) return {}

  const folder = folders.find((item) => item.id === selectedKey)
  if (folder) {
    return { parentFolderId: folder.parentFolderId, afterNodeId: folder.id }
  }

  const page = pages.find((item) => item.id === selectedKey)
  if (page) {
    return { parentFolderId: page.parentFolderId, afterNodeId: page.id }
  }

  return {}
}
