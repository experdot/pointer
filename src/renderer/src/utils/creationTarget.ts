/**
 * 新建节点时的落位计算
 *
 * 工具栏的「新建」以当前选中项为参照：新节点与选中项同级并紧随其后；
 * 未选中任何节点时放在根目录末尾。
 */

import type { Folder, Page } from '@renderer/types/shared'

export interface CreationTarget {
  parentFolderId?: string
  afterNodeId?: string
}

export function resolveCreationTarget(
  selectedKey: string | null | undefined,
  folders: readonly Folder[],
  pages: readonly Page[]
): CreationTarget {
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
