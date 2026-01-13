import type { ConfigFolder, ConfigItemBase, ConfigTree } from '../types/type'

// ==================== 通用树节点接口 ====================

export interface TreeNode {
  id: string
  parentFolderId?: string
  order?: number
}

// ==================== 树结构查询 ====================

export function getAllSubFolderIds(folders: ConfigFolder[], folderId: string): string[] {
  const subFolders = folders.filter((f) => f.parentFolderId === folderId)
  return subFolders.flatMap((f) => [f.id, ...getAllSubFolderIds(folders, f.id)])
}

export function getItemsInFolder<T extends TreeNode>(
  items: T[],
  folders: ConfigFolder[],
  folderId: string | undefined
): (T | ConfigFolder)[] {
  const itemsInFolder = items.filter((item) => item.parentFolderId === folderId)
  const subFolders = folders.filter((f) => f.parentFolderId === folderId)
  return [...subFolders, ...itemsInFolder].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export function getRootItems<T extends TreeNode>(
  items: T[],
  folders: ConfigFolder[]
): (T | ConfigFolder)[] {
  const rootItems = items.filter((item) => !item.parentFolderId)
  const rootFolders = folders.filter((f) => !f.parentFolderId)
  return [...rootFolders, ...rootItems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export function getMaxOrderAtLevel<T extends TreeNode>(
  items: T[],
  parentFolderId?: string
): number {
  const itemsAtLevel = items.filter((item) => item.parentFolderId === parentFolderId)
  return itemsAtLevel.reduce((max, item) => Math.max(max, item.order ?? 0), -1)
}

// ==================== ConfigTree 操作 ====================

export function updateTreeItem<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  id: string,
  updates: Partial<T>
): ConfigTree<T> {
  return {
    ...tree,
    items: tree.items.map((item) =>
      item.id === id ? { ...item, ...updates, updatedAt: Date.now() } : item
    )
  }
}

export function updateTreeFolder<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  id: string,
  updates: Partial<ConfigFolder>
): ConfigTree<T> {
  return {
    ...tree,
    folders: tree.folders.map((f) =>
      f.id === id ? { ...f, ...updates, updatedAt: Date.now() } : f
    )
  }
}

export function removeTreeItem<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  id: string
): ConfigTree<T> {
  return {
    ...tree,
    items: tree.items.filter((item) => item.id !== id)
  }
}

export function removeTreeFolder<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  id: string
): ConfigTree<T> {
  const allFolderIds = [id, ...getAllSubFolderIds(tree.folders, id)]
  const maxOrder = getMaxOrderAtLevel(tree.items)

  let orderOffset = 0
  const updatedItems = tree.items.map((item) => {
    if (item.parentFolderId && allFolderIds.includes(item.parentFolderId)) {
      orderOffset++
      return { ...item, parentFolderId: undefined, order: maxOrder + orderOffset }
    }
    return item
  })

  return {
    items: updatedItems,
    folders: tree.folders.filter((f) => !allFolderIds.includes(f.id))
  }
}

export function clearTreeFolder<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  id: string
): ConfigTree<T> {
  const allSubFolderIds = getAllSubFolderIds(tree.folders, id)
  const allFolderIds = [id, ...allSubFolderIds]

  return {
    items: tree.items.filter(
      (item) => !item.parentFolderId || !allFolderIds.includes(item.parentFolderId)
    ),
    folders: tree.folders.filter((f) => !allSubFolderIds.includes(f.id))
  }
}

export function addTreeItem<T extends ConfigItemBase>(tree: ConfigTree<T>, item: T): ConfigTree<T> {
  return {
    ...tree,
    items: [...tree.items, item]
  }
}

export function addTreeFolder<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  folder: ConfigFolder
): ConfigTree<T> {
  return {
    ...tree,
    folders: [...tree.folders, folder]
  }
}

export function batchUpdateTreeItems<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  updates: Array<{ id: string; updates: Partial<T> }>
): ConfigTree<T> {
  return {
    ...tree,
    items: tree.items.map((item) => {
      const update = updates.find((u) => u.id === item.id)
      return update ? { ...item, ...update.updates, updatedAt: Date.now() } : item
    })
  }
}

export function batchUpdateTreeFolders<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  updates: Array<{ id: string; updates: Partial<ConfigFolder> }>
): ConfigTree<T> {
  return {
    ...tree,
    folders: tree.folders.map((f) => {
      const update = updates.find((u) => u.id === f.id)
      return update ? { ...f, ...update.updates, updatedAt: Date.now() } : f
    })
  }
}

// ==================== 拖拽排序辅助 ====================

export function calculateInsertPosition<T extends TreeNode>(
  items: T[],
  folders: ConfigFolder[],
  afterItemId?: string
): { parentFolderId?: string; order: number } {
  if (!afterItemId) {
    return { order: getMaxOrderAtLevel(items) + 1 }
  }

  const afterItem = items.find((i) => i.id === afterItemId)
  const afterFolder = folders.find((f) => f.id === afterItemId)
  const target = afterItem || afterFolder

  if (!target) {
    return { order: getMaxOrderAtLevel(items) + 1 }
  }

  const parentFolderId = target.parentFolderId
  const siblingItems = items.filter(
    (i) => i.parentFolderId === parentFolderId && i.id !== afterItemId
  )
  const siblingFolders = folders.filter(
    (f) => f.parentFolderId === parentFolderId && f.id !== afterItemId
  )

  const allSiblings = [...siblingItems, ...siblingFolders].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  )

  const targetOrder = target.order ?? 0
  const nextItem = allSiblings.find((item) => (item.order ?? 0) > targetOrder)

  const order = nextItem ? (targetOrder + (nextItem.order ?? 0)) / 2 : targetOrder + 1

  return { parentFolderId, order }
}

export function reorderItems<T extends TreeNode>(
  items: T[],
  parentFolderId?: string
): Array<{ id: string; updates: { order: number; parentFolderId?: string } }> {
  return items.map((item, index) => ({
    id: item.id,
    updates: { order: index, parentFolderId }
  }))
}
