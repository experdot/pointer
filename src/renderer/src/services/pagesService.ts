import { v4 as uuidv4 } from 'uuid'
import type { PageFolder } from '../types/type'
import type { PageRecord } from '../persistence/interfaces/userData'
import { stores } from '../stores/registry'

/**
 * Generate a unique name by adding number suffix if needed
 * e.g., "新对话" -> "新对话 (1)" -> "新对话 (2)"
 */
export function generateUniqueName(baseName: string, existingNames: string[]): string {
  // Check if base name is available
  if (!existingNames.includes(baseName)) {
    return baseName
  }

  // Find all names matching pattern "baseName" or "baseName (n)"
  const pattern = new RegExp(`^${escapeRegExp(baseName)}(?: \\((\\d+)\\))?$`)
  let maxNumber = 0

  for (const name of existingNames) {
    const match = name.match(pattern)
    if (match) {
      const num = match[1] ? parseInt(match[1], 10) : 0
      if (num > maxNumber) {
        maxNumber = num
      }
    }
  }

  return `${baseName} (${maxNumber + 1})`
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 计算新项目的插入位置和 order，并更新同级项目的 order
async function prepareInsertPosition(afterItemId?: string): Promise<{
  parentFolderId: string | undefined
  order: number
}> {
  const { page, folder, tab } = stores

  // 查找参考项目
  let referenceItem: PageRecord | PageFolder | null = null
  if (afterItemId) {
    referenceItem = page.getById(afterItemId) || folder.getById(afterItemId) || null
  }
  if (!referenceItem) {
    const activeTab = tab.tabs.find((t) => t.id === tab.activeTabId)
    referenceItem = activeTab?.dataId ? page.getById(activeTab.dataId) || null : null
  }

  let parentFolderId: string | undefined
  let newOrder: number

  if (referenceItem) {
    parentFolderId = referenceItem.parentFolderId
    newOrder = (referenceItem.order ?? 0) + 1
  } else {
    parentFolderId = undefined
    newOrder = 0
  }

  // 批量更新同级中 order >= newOrder 的项目
  const pagesToUpdate = page.pages.filter(
    (p) => p.parentFolderId === parentFolderId && (p.order ?? 0) >= newOrder
  )
  const foldersToUpdate = folder.folders.filter(
    (f) => f.parentFolderId === parentFolderId && (f.order ?? 0) >= newOrder
  )

  // 使用批量更新，避免 N 次 DB 写入和渲染
  if (pagesToUpdate.length > 0) {
    await page.updateMany(
      pagesToUpdate.map((p) => ({ id: p.id, changes: { order: (p.order ?? 0) + 1 } }))
    )
  }
  if (foldersToUpdate.length > 0) {
    await folder.updateMany(
      foldersToUpdate.map((f) => ({ id: f.id, changes: { order: (f.order ?? 0) + 1 } }))
    )
  }

  return { parentFolderId, order: newOrder }
}

// 创建新页面
export async function createPage(
  name?: string,
  afterItemId?: string,
  inFolderId?: string
): Promise<PageRecord> {
  const { page, folder } = stores

  let parentFolderId: string | undefined
  let order: number

  if (inFolderId) {
    // 直接在指定文件夹中创建
    parentFolderId = inFolderId
    const itemsInFolder = [...page.findByFolderId(inFolderId), ...folder.findByParentId(inFolderId)]
    order = itemsInFolder.length > 0 ? Math.max(...itemsInFolder.map((i) => i.order ?? 0)) + 1 : 0
  } else {
    const position = await prepareInsertPosition(afterItemId)
    parentFolderId = position.parentFolderId
    order = position.order
  }

  // Generate unique name among sibling pages
  const baseName = name || '新对话'
  const siblingPages = page.findByFolderId(parentFolderId)
  const existingNames = siblingPages.map((p) => p.name)
  const uniqueName = generateUniqueName(baseName, existingNames)

  return page.create({
    name: uniqueName,
    parentFolderId,
    order
  })
}

// 更新页面
export async function updatePage(id: string, updates: Partial<PageRecord>): Promise<void> {
  await stores.page.update(id, updates)

  // 同步更新标签页标题
  if (updates.name) {
    const { tab } = stores
    const existingTab = tab.tabs.find((t) => t.dataId === id)
    if (existingTab) {
      tab.updateTabTitle(existingTab.id, updates.name)
    }
  }
}

// 删除页面
export async function deletePage(id: string): Promise<void> {
  const { page, message, tab } = stores

  await page.delete(id)
  message.evict(id)

  // 关闭对应的标签页
  const existingTab = tab.tabs.find((t) => t.dataId === id)
  if (existingTab) {
    tab.closeTab(existingTab.id)
  }
}

// 批量删除页面
export async function deletePages(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  const { page, message, tab } = stores

  // 清除消息缓存
  for (const id of ids) {
    message.evict(id)
  }

  // 关闭对应的标签页
  const tabsToClose = tab.tabs.filter((t) => t.dataId && ids.includes(t.dataId))
  for (const existingTab of tabsToClose) {
    tab.closeTab(existingTab.id)
  }

  // 批量删除页面
  await page.deleteMany(ids)
}

// 检查页面在目标文件夹是否重名
export function checkPageNameConflict(
  pageId: string,
  targetFolderId: string | undefined
): string | null {
  const { page } = stores
  const movingPage = page.getById(pageId)
  if (!movingPage) return null

  const siblingPages = page.findByFolderId(targetFolderId)
  const conflict = siblingPages.find((p) => p.id !== pageId && p.name === movingPage.name)
  return conflict ? movingPage.name : null
}

// 检查文件夹在目标文件夹是否重名
export function checkFolderNameConflict(
  folderId: string,
  targetFolderId: string | undefined
): string | null {
  const { folder } = stores
  const movingFolder = folder.getById(folderId)
  if (!movingFolder) return null

  const siblingFolders = folder.findByParentId(targetFolderId)
  const conflict = siblingFolders.find((f) => f.id !== folderId && f.name === movingFolder.name)
  return conflict ? movingFolder.name : null
}

// 移动页面到文件夹（带重名检查）
export async function movePage(
  pageId: string,
  folderId: string | undefined,
  autoRename = false
): Promise<void> {
  const { page } = stores
  const movingPage = page.getById(pageId)
  if (!movingPage) return

  let newName = movingPage.name
  if (autoRename) {
    const siblingPages = page.findByFolderId(folderId)
    const existingNames = siblingPages.filter((p) => p.id !== pageId).map((p) => p.name)
    newName = generateUniqueName(movingPage.name, existingNames)
  }

  await page.update(pageId, { parentFolderId: folderId, name: newName })
}

// 移动文件夹到目标文件夹（带重名检查）
export async function moveFolder(
  folderId: string,
  targetFolderId: string | undefined,
  autoRename = false
): Promise<void> {
  const { folder } = stores
  const movingFolder = folder.getById(folderId)
  if (!movingFolder) return

  let newName = movingFolder.name
  if (autoRename) {
    const siblingFolders = folder.findByParentId(targetFolderId)
    const existingNames = siblingFolders.filter((f) => f.id !== folderId).map((f) => f.name)
    newName = generateUniqueName(movingFolder.name, existingNames)
  }

  await folder.update(folderId, { parentFolderId: targetFolderId, name: newName })
}

// 创建文件夹
export async function createFolder(
  name?: string,
  afterItemId?: string,
  inFolderId?: string
): Promise<PageFolder> {
  const { page, folder } = stores

  let parentFolderId: string | undefined
  let order: number

  if (inFolderId) {
    // 直接在指定文件夹中创建
    parentFolderId = inFolderId
    const itemsInFolder = [...page.findByFolderId(inFolderId), ...folder.findByParentId(inFolderId)]
    order = itemsInFolder.length > 0 ? Math.max(...itemsInFolder.map((i) => i.order ?? 0)) + 1 : 0
  } else {
    const position = await prepareInsertPosition(afterItemId)
    parentFolderId = position.parentFolderId
    order = position.order
  }

  // Generate unique name among sibling folders
  const baseName = name || '新文件夹'
  const siblingFolders = folder.findByParentId(parentFolderId)
  const existingNames = siblingFolders.map((f) => f.name)
  const uniqueName = generateUniqueName(baseName, existingNames)

  return folder.create({
    name: uniqueName,
    parentFolderId,
    order,
    expanded: true
  })
}

// 更新文件夹
export async function updateFolder(id: string, updates: Partial<PageFolder>): Promise<void> {
  await stores.folder.update(id, updates)
}

// 递归获取所有子文件夹 ID
function getAllSubFolderIds(folderId: string, folders: PageFolder[]): string[] {
  const subFolders = folders.filter((f) => f.parentFolderId === folderId)
  return subFolders.flatMap((f) => [f.id, ...getAllSubFolderIds(f.id, folders)])
}

// 删除文件夹及其全部子项（包括嵌套的页面和子文件夹）
export async function deleteFolder(id: string): Promise<void> {
  const { page, folder, message, tab } = stores

  const allFolderIds = [id, ...getAllSubFolderIds(id, folder.folders)]

  // 删除所有子页面
  const pagesToDelete = page.pages.filter(
    (p) => p.parentFolderId && allFolderIds.includes(p.parentFolderId)
  )
  const pageIds = pagesToDelete.map((p) => p.id)

  // 清除消息缓存
  for (const pageId of pageIds) {
    message.evict(pageId)
  }

  // 关闭对应的标签页
  const tabsToClose = tab.tabs.filter((t) => t.dataId && pageIds.includes(t.dataId))
  for (const existingTab of tabsToClose) {
    tab.closeTab(existingTab.id)
  }

  // 批量删除页面
  if (pageIds.length > 0) {
    await page.deleteMany(pageIds)
  }

  // 删除所有文件夹（包括子文件夹）
  await folder.deleteMany(allFolderIds)
}

// 清空文件夹（删除子项但保留文件夹本身）
export async function clearFolder(id: string): Promise<void> {
  const { page, folder, message, tab } = stores

  // 获取所有子文件夹 ID
  const subFolderIds = getAllSubFolderIds(id, folder.folders)
  const allFolderIds = [id, ...subFolderIds]

  // 删除所有子页面
  const pagesToDelete = page.pages.filter(
    (p) => p.parentFolderId && allFolderIds.includes(p.parentFolderId)
  )
  const pageIds = pagesToDelete.map((p) => p.id)

  // 清除消息缓存
  for (const pageId of pageIds) {
    message.evict(pageId)
  }

  // 关闭对应的标签页
  const tabsToClose = tab.tabs.filter((t) => t.dataId && pageIds.includes(t.dataId))
  for (const existingTab of tabsToClose) {
    tab.closeTab(existingTab.id)
  }

  // 批量删除页面
  if (pageIds.length > 0) {
    await page.deleteMany(pageIds)
  }

  // 删除所有子文件夹（不删除当前文件夹）
  if (subFolderIds.length > 0) {
    await folder.deleteMany(subFolderIds)
  }
}

// 批量删除文件夹
export async function deleteFolders(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  const { page, folder } = stores

  // 收集所有要删除的文件夹 ID（包括子文件夹）
  const allFolderIds = new Set<string>()
  for (const id of ids) {
    allFolderIds.add(id)
    for (const subId of getAllSubFolderIds(id, folder.folders)) {
      allFolderIds.add(subId)
    }
  }

  // 获取根目录现有页面的最大 order
  const rootPages = page.pages.filter((p) => !p.parentFolderId)
  const maxOrder = rootPages.reduce((max, p) => Math.max(max, p.order ?? 0), -1)

  // 批量移动页面到根目录
  const pagesToMove = page.pages.filter(
    (p) => p.parentFolderId && allFolderIds.has(p.parentFolderId)
  )
  if (pagesToMove.length > 0) {
    await page.updateMany(
      pagesToMove.map((p, index) => ({
        id: p.id,
        changes: { parentFolderId: undefined, order: maxOrder + index + 1 }
      }))
    )
  }

  // 批量删除所有文件夹
  await folder.deleteMany([...allFolderIds])
}

// 切换文件夹展开状态
export async function toggleFolderExpanded(id: string): Promise<void> {
  await stores.folder.toggleExpanded(id)
}

// 打开页面（在标签页中）
export async function openPage(pageId: string, preview = false): Promise<void> {
  const { page, message, tab } = stores
  const existingPage = page.getById(pageId)
  if (!existingPage) return

  // 预加载消息
  await message.load(pageId)

  const existingTab = tab.tabs.find((t) => t.dataId === pageId)

  if (existingTab) {
    tab.openTab(existingTab, preview)
  } else {
    tab.openTab(
      {
        id: uuidv4(),
        type: 'chat',
        title: existingPage.name,
        dataId: pageId
      },
      preview
    )
  }
}

// 获取文件夹下的页面
export function getPagesInFolder(folderId: string | undefined): PageRecord[] {
  return stores.page.findByFolderId(folderId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

// 获取子文件夹
export function getSubFolders(parentFolderId: string | undefined): PageFolder[] {
  return stores.folder
    .findByParentId(parentFolderId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}
