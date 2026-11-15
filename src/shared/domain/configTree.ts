/**
 * 配置树通用操作（LLM 配置、模型配置共用）
 *
 * 配置树只是「文件夹 + 条目」的两级结构，用于设置面板的归类展示。
 */

import type { Diagnostic, TreeMove, TreeNodeBase } from './common'
import { compareNodes, descendantFolderIds } from './common'
import { orderKeyBetween, orderKeysBetween } from './ordering'
import { moveOrderedNode } from './treeOrder'

export interface ConfigItemBase extends TreeNodeBase {
  kind: 'item'
}

export interface ConfigFolder extends TreeNodeBase {
  kind: 'folder'
  /** 设置面板中的展开状态（账户级界面状态） */
  expanded?: boolean
}

export interface ConfigTree<T extends ConfigItemBase> {
  items: T[]
  folders: ConfigFolder[]
}

export function emptyConfigTree<T extends ConfigItemBase>(): ConfigTree<T> {
  return { items: [], folders: [] }
}

export function configChildren<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  parentFolderId: string | undefined
): (T | ConfigFolder)[] {
  const folders = tree.folders.filter((folder) => folder.parentFolderId === parentFolderId)
  const items = tree.items.filter((item) => item.parentFolderId === parentFolderId)
  return [...folders, ...items].sort(compareNodes)
}

export function configNextOrderKey<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  parentFolderId: string | undefined
): string {
  return orderKeyBetween(configChildren(tree, parentFolderId).at(-1)?.orderKey ?? null, null)
}

export interface ConfigInsertPosition {
  parentFolderId?: string
  afterNodeId?: string
}

/** 在修改重放时按最新配置树解析位置，不能保存过期的排序键。 */
export function configInsertPosition<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  position: ConfigInsertPosition
): { parentFolderId?: string; orderKey: string } {
  const reference = position.afterNodeId
    ? [...tree.folders, ...tree.items].find((node) => node.id === position.afterNodeId)
    : undefined
  if (position.afterNodeId && !reference) throw new Error('配置插入参照项已不存在')
  const parentFolderId = position.parentFolderId ?? reference?.parentFolderId
  if (parentFolderId && !tree.folders.some((folder) => folder.id === parentFolderId))
    throw new Error('配置目标文件夹已不存在')
  const siblings = configChildren(tree, parentFolderId)
  if (!reference || position.parentFolderId !== undefined)
    return { parentFolderId, orderKey: orderKeyBetween(siblings.at(-1)?.orderKey ?? null, null) }
  const index = siblings.findIndex((node) => node.id === reference.id)
  return {
    parentFolderId,
    orderKey: orderKeyBetween(reference.orderKey, siblings[index + 1]?.orderKey ?? null)
  }
}

export function moveConfigNode<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  move: TreeMove,
  at: number
): { ok: true; tree: ConfigTree<T> } | { ok: false; error: Diagnostic } {
  const nodes: (T | ConfigFolder)[] = [...tree.folders, ...tree.items]
  const result = moveOrderedNode(nodes, move, at)
  if (!result.ok) return result
  if (result.nodes === nodes) return { ok: true, tree }
  return {
    ok: true,
    tree: {
      folders: result.nodes.filter((node): node is ConfigFolder => node.kind === 'folder'),
      items: result.nodes.filter((node): node is T => node.kind === 'item')
    }
  }
}

export function configDescendantFolderIds<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  folderId: string
): string[] {
  return descendantFolderIds(tree, folderId)
}

export function addConfigItem<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  item: T
): ConfigTree<T> {
  return { ...tree, items: [...tree.items, item] }
}

export function addConfigFolder<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  folder: ConfigFolder
): ConfigTree<T> {
  return { ...tree, folders: [...tree.folders, folder] }
}

export function updateConfigItem<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  itemId: string,
  patch: Partial<Omit<T, 'id' | 'createdAt' | 'kind' | 'updatedAt'>>,
  at: number
): ConfigTree<T> {
  return {
    ...tree,
    items: tree.items.map((item) =>
      item.id === itemId ? { ...item, ...patch, updatedAt: at } : item
    )
  }
}

export function updateConfigFolder<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  folderId: string,
  patch: Partial<Omit<ConfigFolder, 'id' | 'createdAt' | 'kind' | 'updatedAt'>>,
  at: number
): ConfigTree<T> {
  return {
    ...tree,
    folders: tree.folders.map((folder) =>
      folder.id === folderId ? { ...folder, ...patch, updatedAt: at } : folder
    )
  }
}

export function removeConfigItem<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  itemId: string
): ConfigTree<T> {
  return { ...tree, items: tree.items.filter((item) => item.id !== itemId) }
}

/**
 * 删除配置文件夹
 * promote：条目与子文件夹按原次序提升到根末尾，只给提升的节点分配键
 * cascade：连同其中内容一起删除
 */
export function removeConfigFolder<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  folderId: string,
  mode: 'promote' | 'cascade',
  at: number
): ConfigTree<T> {
  if (mode === 'cascade') {
    const removedFolderIds = new Set([folderId, ...configDescendantFolderIds(tree, folderId)])
    return {
      folders: tree.folders.filter((folder) => !removedFolderIds.has(folder.id)),
      items: tree.items.filter(
        (item) => !item.parentFolderId || !removedFolderIds.has(item.parentFolderId)
      )
    }
  }

  const promoted = configChildren(tree, folderId)
  const keys = orderKeysBetween(
    configChildren(tree, undefined).at(-1)?.orderKey ?? null,
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
  const items = tree.items.map((item) =>
    item.parentFolderId === folderId
      ? { ...item, parentFolderId: undefined, orderKey: byId.get(item.id)!, updatedAt: at }
      : item
  )

  return { folders, items }
}

/** 清空文件夹内容，保留文件夹本身 */
export function clearConfigFolder<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  folderId: string
): ConfigTree<T> {
  const descendants = configDescendantFolderIds(tree, folderId)
  const emptiedFolderIds = new Set([folderId, ...descendants])

  return {
    folders: tree.folders.filter((folder) => !descendants.includes(folder.id)),
    items: tree.items.filter(
      (item) => !item.parentFolderId || !emptiedFolderIds.has(item.parentFolderId)
    )
  }
}
