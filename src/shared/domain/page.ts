/**
 * 页面树领域模型（页面与文件夹）
 *
 * 页面只承载元数据；消息与 Topic 属于 Conversation（见 chat.ts）。
 */

import type { Diagnostic, TreeMove, TreeNodeBase } from './common'
import { compareNodes, descendantFolderIds, nameKey } from './common'

export { descendantFolderIds } from './common'

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

function findFolder(tree: PageTree, folderId: string): Folder | undefined {
  return tree.folders.find((folder) => folder.id === folderId)
}

function findPage(tree: PageTree, pageId: string): Page | undefined {
  return tree.pages.find((page) => page.id === pageId)
}

function findNode(tree: PageTree, nodeId: string): Folder | Page | undefined {
  return findFolder(tree, nodeId) ?? findPage(tree, nodeId)
}

export function addFolder(tree: PageTree, folder: Folder): PageTree {
  return { ...tree, folders: [...tree.folders, folder] }
}

export function addPage(tree: PageTree, page: Page): PageTree {
  return { ...tree, pages: [...tree.pages, page] }
}

/** 更新单个页面（页面字段不会落到文件夹上） */
export function updatePage(
  tree: PageTree,
  pageId: string,
  patch: Partial<Pick<Page, 'name' | 'parentFolderId' | 'order' | 'starred'>>,
  at: number
): PageTree {
  return {
    ...tree,
    pages: tree.pages.map((page) =>
      page.id === pageId ? { ...page, ...patch, updatedAt: at } : page
    )
  }
}

/** 更新单个文件夹 */
export function updateFolder(
  tree: PageTree,
  folderId: string,
  patch: Partial<Pick<Folder, 'name' | 'parentFolderId' | 'order'>>,
  at: number
): PageTree {
  return {
    ...tree,
    folders: tree.folders.map((folder) =>
      folder.id === folderId ? { ...folder, ...patch, updatedAt: at } : folder
    )
  }
}

/** 按当前树解析移动意图；失效目标不能退化为移到末尾。 */
export function moveTreeNode(
  tree: PageTree,
  move: TreeMove,
  at: number
): { ok: true; tree: PageTree } | { ok: false; error: Diagnostic } {
  const fail = (code: string, message: string): { ok: false; error: Diagnostic } => ({
    ok: false,
    error: { code, message, entityId: move.nodeId }
  })
  const node = findNode(tree, move.nodeId)
  const target = move.targetNodeId ? findNode(tree, move.targetNodeId) : undefined
  if (!node) return fail('tree.node-not-found', '移动的节点已不存在')
  if (!['before', 'after', 'inside', 'end'].includes(move.placement)) {
    return fail('tree.invalid-placement', '无效的放置位置')
  }
  const intoFolder = move.placement === 'inside' || move.placement === 'end'
  if (!target && (move.targetNodeId !== undefined || !intoFolder))
    return fail('tree.target-not-found', '目标节点已不存在')
  if (intoFolder && target && !findFolder(tree, target.id)) {
    return fail('tree.invalid-target', '只能移入文件夹')
  }
  if (node.id === target?.id && !intoFolder) return { ok: true, tree }

  const parentId = intoFolder ? target?.id : target!.parentFolderId
  if (parentId && !findFolder(tree, parentId)) {
    return fail('tree.target-not-found', '目标文件夹已不存在')
  }
  if (findFolder(tree, node.id) && parentId && isFolderAncestor(tree, node.id, parentId)) {
    return fail('tree.cycle', '不能把文件夹移入自身或其子文件夹')
  }

  const siblings = childrenOf(tree, parentId).filter((item) => item.id !== node.id)
  const index =
    move.placement === 'inside'
      ? 0
      : move.placement === 'end'
        ? siblings.length
        : siblings.findIndex((item) => item.id === target!.id) +
          (move.placement === 'after' ? 1 : 0)
  return {
    ok: true,
    tree: insertNodeBefore(tree, node, parentId, siblings[index]?.id, at)
  }
}

/** beforeNodeId 为空时明确追加到末尾；只更新实际改变的节点。 */
function insertNodeBefore(
  tree: PageTree,
  node: TreeNodeBase,
  targetFolderId: string | undefined,
  beforeNodeId: string | undefined,
  at: number
): PageTree {
  const nodeId = node.id
  const sourceParentId = node.parentFolderId
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

  let changed = false
  const apply = <T extends TreeNodeBase>(items: T[]): T[] =>
    items.map((item) => {
      const order = orderById.get(item.id)
      if (order === undefined) return item
      const parentFolderId = parentById.get(item.id)
      if (item.order === order && item.parentFolderId === parentFolderId) return item
      changed = true
      return { ...item, order, parentFolderId, updatedAt: at }
    })

  const next = { folders: apply(tree.folders), pages: apply(tree.pages) }
  return changed ? next : tree
}

/**
 * 删除文件夹
 * - promote：子节点提升到根目录（保留内容）
 * - cascade：连同子文件夹与页面一起删除
 */
export function removeFolder(
  tree: PageTree,
  folderId: string,
  mode: 'promote' | 'cascade',
  at: number
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
        ? { ...folder, parentFolderId: undefined, order: offset++, updatedAt: at }
        : folder
    )
  const pages = tree.pages.map((page) =>
    page.parentFolderId === folderId
      ? { ...page, parentFolderId: undefined, order: offset++, updatedAt: at }
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
