/**
 * 页面树领域模型（页面与文件夹）
 *
 * 页面只承载元数据；消息与 Topic 属于 Conversation（见 chat.ts）。
 */

import type { Diagnostic, TreeNodeBase } from './common'
import { compareNodes, nameKey } from './common'

export interface Folder extends TreeNodeBase {
  kind: 'folder'
}

export interface Page extends TreeNodeBase {
  kind: 'page'
  starred?: boolean
}

export interface PageTree {
  folders: Folder[]
  pages: Page[]
}

export const EMPTY_PAGE_TREE: PageTree = { folders: [], pages: [] }

/** 同级节点（文件夹 + 页面），按 order 排序 */
export function childrenOf(tree: PageTree, parentFolderId: string | undefined): TreeNodeBase[] {
  const folders = tree.folders.filter((folder) => folder.parentFolderId === parentFolderId)
  const pages = tree.pages.filter((page) => page.parentFolderId === parentFolderId)
  return [...folders, ...pages].sort(compareNodes)
}

/** 某层级下一个可用的 order 值 */
export function nextOrder(tree: PageTree, parentFolderId: string | undefined): number {
  const siblings = childrenOf(tree, parentFolderId)
  return siblings.reduce((max, node) => Math.max(max, node.order + 1), 0)
}

/** 文件夹的全部后代文件夹 id（不含自身） */
export function descendantFolderIds(tree: PageTree, folderId: string): string[] {
  const result: string[] = []
  const stack = [folderId]

  while (stack.length > 0) {
    const current = stack.pop() as string
    for (const folder of tree.folders) {
      if (folder.parentFolderId === current) {
        result.push(folder.id)
        stack.push(folder.id)
      }
    }
  }

  return result
}

/** 节点所在的完整文件夹路径（自根向下），用于生成磁盘目录 */
export function folderPathNames(tree: PageTree, folderId: string | undefined): string[] {
  const names: string[] = []
  const visited = new Set<string>()
  let currentId = folderId

  while (currentId) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    const folder = tree.folders.find((item) => item.id === currentId)
    if (!folder) break
    names.unshift(folder.name)
    currentId = folder.parentFolderId
  }

  return names
}

/** 判断 candidateAncestorId 是否是 nodeId 的祖先文件夹（含自身） */
export function isFolderAncestor(
  tree: PageTree,
  candidateAncestorId: string,
  nodeId: string
): boolean {
  const visited = new Set<string>()
  let currentId: string | undefined = nodeId

  while (currentId) {
    if (currentId === candidateAncestorId) return true
    if (visited.has(currentId)) return false
    visited.add(currentId)
    const folder = tree.folders.find((item) => item.id === currentId)
    currentId = folder?.parentFolderId
  }

  return false
}

export function findFolder(tree: PageTree, folderId: string): Folder | undefined {
  return tree.folders.find((folder) => folder.id === folderId)
}

export function findPage(tree: PageTree, pageId: string): Page | undefined {
  return tree.pages.find((page) => page.id === pageId)
}

export function findNode(tree: PageTree, nodeId: string): Folder | Page | undefined {
  return findFolder(tree, nodeId) ?? findPage(tree, nodeId)
}

export function addFolder(tree: PageTree, folder: Folder): PageTree {
  return { ...tree, folders: [...tree.folders, folder] }
}

export function addPage(tree: PageTree, page: Page): PageTree {
  return { ...tree, pages: [...tree.pages, page] }
}

export function updateNode(
  tree: PageTree,
  nodeId: string,
  patch: Partial<Pick<Page, 'name' | 'parentFolderId' | 'order' | 'starred'>>,
  at: number
): PageTree {
  return {
    folders: tree.folders.map((folder) =>
      folder.id === nodeId ? { ...folder, ...patch, updatedAt: at } : folder
    ),
    pages: tree.pages.map((page) =>
      page.id === nodeId ? { ...page, ...patch, updatedAt: at } : page
    )
  }
}

/**
 * 移动节点到目标文件夹，可插入到某个同级节点之前
 * 移动文件夹时禁止移动到自身或其后代之下
 */
export function moveNode(
  tree: PageTree,
  nodeId: string,
  targetFolderId: string | undefined,
  beforeNodeId?: string,
  at = Date.now()
): PageTree {
  const node = findNode(tree, nodeId)
  if (!node) return tree

  const isFolder = Boolean(findFolder(tree, nodeId))
  if (isFolder && targetFolderId && isFolderAncestor(tree, nodeId, targetFolderId)) {
    return tree
  }

  const sourceParentId = node.parentFolderId
  if (sourceParentId === targetFolderId && !beforeNodeId) {
    return tree
  }

  const sourceLevel = childrenOf(tree, sourceParentId).filter((item) => item.id !== nodeId)
  const targetLevelBase =
    sourceParentId === targetFolderId
      ? sourceLevel
      : childrenOf(tree, targetFolderId).filter((item) => item.id !== nodeId)

  const rawIndex = beforeNodeId
    ? targetLevelBase.findIndex((item) => item.id === beforeNodeId)
    : targetLevelBase.length
  const insertIndex = rawIndex < 0 ? targetLevelBase.length : rawIndex

  const targetLevel = [...targetLevelBase]
  targetLevel.splice(insertIndex, 0, node)

  const orderById = new Map<string, number>()
  const parentById = new Map<string, string | undefined>()

  targetLevel.forEach((item, index) => {
    orderById.set(item.id, index)
    parentById.set(item.id, targetFolderId)
  })
  if (sourceParentId !== targetFolderId) {
    sourceLevel.forEach((item, index) => {
      orderById.set(item.id, index)
      parentById.set(item.id, sourceParentId)
    })
  }

  const apply = <T extends TreeNodeBase>(items: T[]): T[] =>
    items.map((item) => {
      const order = orderById.get(item.id)
      if (order === undefined) return item
      return { ...item, order, parentFolderId: parentById.get(item.id), updatedAt: at }
    })

  return { folders: apply(tree.folders), pages: apply(tree.pages) }
}

/**
 * 删除文件夹
 * - promote：子节点提升到根目录（保留内容）
 * - cascade：连同子文件夹与页面一起删除
 */
export function removeFolder(
  tree: PageTree,
  folderId: string,
  mode: 'promote' | 'cascade'
): PageTree {
  if (mode === 'cascade') {
    const removedFolderIds = new Set([folderId, ...descendantFolderIds(tree, folderId)])
    return {
      folders: tree.folders.filter((folder) => !removedFolderIds.has(folder.id)),
      pages: tree.pages.filter(
        (page) => !page.parentFolderId || !removedFolderIds.has(page.parentFolderId)
      )
    }
  }

  let offset = nextOrder(tree, undefined)
  const folders = tree.folders
    .filter((folder) => folder.id !== folderId)
    .map((folder) =>
      folder.parentFolderId === folderId
        ? { ...folder, parentFolderId: undefined, order: offset++ }
        : folder
    )
  const pages = tree.pages.map((page) =>
    page.parentFolderId === folderId
      ? { ...page, parentFolderId: undefined, order: offset++ }
      : page
  )

  return { folders, pages }
}

/** 清空文件夹内容（删除其中的页面与子文件夹），保留文件夹本身 */
export function clearFolder(tree: PageTree, folderId: string): PageTree {
  const descendants = descendantFolderIds(tree, folderId)
  const emptiedFolderIds = new Set([folderId, ...descendants])

  return {
    folders: tree.folders.filter((folder) => !descendants.includes(folder.id)),
    pages: tree.pages.filter(
      (page) => !page.parentFolderId || !emptiedFolderIds.has(page.parentFolderId)
    )
  }
}

export function removePages(tree: PageTree, pageIds: readonly string[]): PageTree {
  const removed = new Set(pageIds)
  return { ...tree, pages: tree.pages.filter((page) => !removed.has(page.id)) }
}

/** 校验页面树不变量：id 唯一、父节点存在、无环、同级名称唯一 */
export function validatePageTree(tree: PageTree): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const folderIds = new Set(tree.folders.map((folder) => folder.id))

  for (const node of [...tree.folders, ...tree.pages]) {
    if (node.parentFolderId && !folderIds.has(node.parentFolderId)) {
      diagnostics.push({
        code: 'tree.orphan',
        message: `节点「${node.name}」的父文件夹不存在`,
        entityId: node.id
      })
    }
  }

  const seenIds = new Set<string>()
  for (const node of [...tree.folders, ...tree.pages]) {
    if (seenIds.has(node.id)) {
      diagnostics.push({
        code: 'tree.duplicate-id',
        message: `存在重复的节点 id：${node.id}`,
        entityId: node.id
      })
    }
    seenIds.add(node.id)
  }

  for (const folder of tree.folders) {
    const visited = new Set<string>([folder.id])
    let currentId = folder.parentFolderId
    while (currentId) {
      if (visited.has(currentId)) {
        diagnostics.push({
          code: 'tree.cycle',
          message: `文件夹层级存在循环引用：${folder.name}`,
          entityId: folder.id
        })
        break
      }
      visited.add(currentId)
      currentId = tree.folders.find((item) => item.id === currentId)?.parentFolderId
    }
  }

  const namesByParent = new Map<string, Set<string>>()
  for (const node of [...tree.folders, ...tree.pages]) {
    const parentKey = node.parentFolderId ?? '__root__'
    const bucket = namesByParent.get(parentKey) ?? new Set<string>()
    const key = nameKey(node.name)
    if (bucket.has(key)) {
      diagnostics.push({
        code: 'tree.duplicate-name',
        message: `同一层级存在同名节点：${node.name}`,
        entityId: node.id
      })
    }
    bucket.add(key)
    namesByParent.set(parentKey, bucket)
  }

  return diagnostics
}
