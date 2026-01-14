import { v4 as uuidv4 } from 'uuid'
import type { PageFolder } from '../types/type'
import type { PageRecord } from '../persistence/interfaces/userData'
import { stores } from '../stores/registry'

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

  return page.create({
    name: name || '新对话',
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

// 移动页面到文件夹
export async function movePage(pageId: string, folderId: string | undefined): Promise<void> {
  await stores.page.update(pageId, { parentFolderId: folderId })
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

  return folder.create({
    name: name || '新文件夹',
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
