/**
 * 配置树通用操作（LLM 配置、模型配置共用）
 *
 * 配置树只是「文件夹 + 条目」的两级结构，用于设置面板的归类展示。
 */

import type { TreeNodeBase } from './common'
import { compareNodes } from './common'

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

export function configNextOrder<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  parentFolderId: string | undefined
): number {
  return configChildren(tree, parentFolderId).reduce(
    (max, node) => Math.max(max, node.order + 1),
    0
  )
}

export function configDescendantFolderIds<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  folderId: string
): string[] {
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

/** 同级已占用的名称集合 */
export function configNamesAtLevel<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  parentFolderId: string | undefined
): string[] {
  return configChildren(tree, parentFolderId).map((node) => node.name)
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
  patch: Partial<T>,
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
  patch: Partial<ConfigFolder>,
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

export function batchUpdateConfigItems<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  updates: ReadonlyArray<{ id: string; changes: Partial<T> }>,
  at: number
): ConfigTree<T> {
  return updates.reduce(
    (accumulated, update) => updateConfigItem(accumulated, update.id, update.changes, at),
    tree
  )
}

export function batchUpdateConfigFolders<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  updates: ReadonlyArray<{ id: string; changes: Partial<ConfigFolder> }>,
  at: number
): ConfigTree<T> {
  return updates.reduce(
    (accumulated, update) => updateConfigFolder(accumulated, update.id, update.changes, at),
    tree
  )
}

/**
 * 删除配置文件夹
 * promote：同级上层重新排序后，条目与子文件夹提升到根
 * cascade：连同其中内容一起删除
 */
export function removeConfigFolder<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  folderId: string,
  mode: 'promote' | 'cascade'
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

  let offset = configNextOrder(tree, undefined)
  const folders = tree.folders
    .filter((folder) => folder.id !== folderId)
    .map((folder) =>
      folder.parentFolderId === folderId
        ? { ...folder, parentFolderId: undefined, order: offset++ }
        : folder
    )
  const items = tree.items.map((item) =>
    item.parentFolderId === folderId
      ? { ...item, parentFolderId: undefined, order: offset++ }
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
