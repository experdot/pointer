/**
 * 页面树领域模型（页面与文件夹）
 *
 * 页面只承载元数据；消息与 Topic 属于 Conversation（见 chat.ts）。
 */

import type { Diagnostic, TreeMove, TreeNodeBase } from './common'
import { compareNodes, descendantFolderIds, nameKey } from './common'
import { orderKeyBetween, orderKeysBetween, validateOrderKeys } from './ordering'
import { moveOrderedNode } from './treeOrder'

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

/** 同级节点（文件夹 + 页面），按 orderKey 排序 */
export function childrenOf(tree: PageTree, parentFolderId: string | undefined): TreeNodeBase[] {
  const folders = tree.folders.filter((folder) => folder.parentFolderId === parentFolderId)
  const pages = tree.pages.filter((page) => page.parentFolderId === parentFolderId)
  return [...folders, ...pages].sort(compareNodes)
}

/** 某层级下一个可用的 orderKey 值 */
export function nextOrderKey(tree: PageTree, parentFolderId: string | undefined): string {
  return orderKeyBetween(childrenOf(tree, parentFolderId).at(-1)?.orderKey ?? null, null)
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
  patch: Partial<Pick<Page, 'name' | 'parentFolderId' | 'orderKey' | 'starred'>>,
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
  patch: Partial<Pick<Folder, 'name' | 'parentFolderId' | 'orderKey'>>,
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
  const nodes = [...tree.folders, ...tree.pages]
  const result = moveOrderedNode(nodes, move, at)
  if (!result.ok) return result
  if (result.nodes === nodes) return { ok: true, tree }
  return {
    ok: true,
    tree: {
      folders: result.nodes.filter((node): node is Folder => node.kind === 'folder'),
      pages: result.nodes.filter((node): node is Page => node.kind === 'page')
    }
  }
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

  const promoted = childrenOf(tree, folderId)
  const keys = orderKeysBetween(
    childrenOf(tree, undefined).at(-1)?.orderKey ?? null,
    null,
    promoted.length
  )
  const byId = new Map(promoted.map((node, index) => [node.id, keys[index]]))
  const folders = tree.folders
    .filter((folder) => folder.id !== folderId)
    .map((folder) =>
      folder.parentFolderId === folderId
        ? { ...folder, parentFolderId: undefined, orderKey: byId.get(folder.id)!, updatedAt: at }
        : folder
    )
  const pages = tree.pages.map((page) =>
    page.parentFolderId === folderId
      ? { ...page, parentFolderId: undefined, orderKey: byId.get(page.id)!, updatedAt: at }
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
  const diagnostics: Diagnostic[] = validateOrderKeys([...tree.folders, ...tree.pages])
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
