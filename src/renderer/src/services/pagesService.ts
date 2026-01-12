import { v4 as uuidv4 } from 'uuid'
import type { PageFolder } from '../types/type'
import type { PageRecord } from '../utils/database'
import { usePagesStore } from '../stores/pagesStore'
import { useFoldersStore } from '../stores/foldersStore'
import { useMessagesStore } from '../stores/messagesStore'
import { useTabsStore } from '../stores/tabsStore'

// 计算新项目的插入位置和 order，并更新同级项目的 order
async function prepareInsertPosition(afterItemId?: string): Promise<{
  parentFolderId: string | undefined
  order: number
}> {
  const pagesStore = usePagesStore.getState()
  const foldersStore = useFoldersStore.getState()
  const tabsStore = useTabsStore.getState()

  // 查找参考项目
  let referenceItem: PageRecord | PageFolder | null = null
  if (afterItemId) {
    referenceItem =
      pagesStore.pages.find((p) => p.id === afterItemId) ||
      foldersStore.folders.find((f) => f.id === afterItemId) ||
      null
  }
  if (!referenceItem) {
    const activeTab = tabsStore.tabs.find((t) => t.id === tabsStore.activeTabId)
    referenceItem = activeTab?.dataId
      ? pagesStore.pages.find((p) => p.id === activeTab.dataId) || null
      : null
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
  const pagesToUpdate = pagesStore.pages.filter(
    (p) => p.parentFolderId === parentFolderId && (p.order ?? 0) >= newOrder
  )
  const foldersToUpdate = foldersStore.folders.filter(
    (f) => f.parentFolderId === parentFolderId && (f.order ?? 0) >= newOrder
  )

  // 使用批量更新，避免 N 次 DB 写入和渲染
  if (pagesToUpdate.length > 0) {
    await pagesStore.batchUpdatePages(
      pagesToUpdate.map((p) => ({ id: p.id, updates: { order: (p.order ?? 0) + 1 } }))
    )
  }
  if (foldersToUpdate.length > 0) {
    await foldersStore.batchUpdateFolders(
      foldersToUpdate.map((f) => ({ id: f.id, updates: { order: (f.order ?? 0) + 1 } }))
    )
  }

  return { parentFolderId, order: newOrder }
}

// 创建新页面
export async function createPage(name?: string, afterItemId?: string): Promise<PageRecord> {
  const { parentFolderId, order } = await prepareInsertPosition(afterItemId)

  const page: PageRecord = {
    type: 'item',
    id: uuidv4(),
    name: name || '新对话',
    parentFolderId,
    createdAt: Date.now(),
    order
  }

  await usePagesStore.getState().addPage(page)
  return page
}

// 更新页面
export async function updatePage(id: string, updates: Partial<PageRecord>): Promise<void> {
  await usePagesStore.getState().updatePage(id, updates)

  // 同步更新标签页标题
  if (updates.name) {
    const tabsStore = useTabsStore.getState()
    const tab = tabsStore.tabs.find((t) => t.dataId === id)
    if (tab) {
      tabsStore.updateTabTitle(tab.id, updates.name)
    }
  }
}

// 删除页面
export async function deletePage(id: string): Promise<void> {
  await usePagesStore.getState().removePage(id)
  useMessagesStore.getState().clearCache(id)

  // 关闭对应的标签页
  const tabsStore = useTabsStore.getState()
  const tab = tabsStore.tabs.find((t) => t.dataId === id)
  if (tab) {
    tabsStore.closeTab(tab.id)
  }
}

// 批量删除页面
export async function deletePages(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  const messagesStore = useMessagesStore.getState()
  const tabsStore = useTabsStore.getState()

  // 清除消息缓存
  for (const id of ids) {
    messagesStore.clearCache(id)
  }

  // 关闭对应的标签页
  const tabsToClose = tabsStore.tabs.filter((t) => t.dataId && ids.includes(t.dataId))
  for (const tab of tabsToClose) {
    tabsStore.closeTab(tab.id)
  }

  // 批量删除页面
  await usePagesStore.getState().removePages(ids)
}

// 移动页面到文件夹
export async function movePage(pageId: string, folderId: string | undefined): Promise<void> {
  await usePagesStore.getState().updatePage(pageId, { parentFolderId: folderId })
}

// 创建文件夹
export async function createFolder(name?: string, afterItemId?: string): Promise<PageFolder> {
  const { parentFolderId, order } = await prepareInsertPosition(afterItemId)

  const folder: PageFolder = {
    type: 'folder',
    id: uuidv4(),
    name: name || '新文件夹',
    parentFolderId,
    expanded: true,
    createdAt: Date.now(),
    order
  }

  await useFoldersStore.getState().addFolder(folder)
  return folder
}

// 更新文件夹
export async function updateFolder(id: string, updates: Partial<PageFolder>): Promise<void> {
  await useFoldersStore.getState().updateFolder(id, updates)
}

// 递归获取所有子文件夹 ID
function getAllSubFolderIds(folderId: string, folders: PageFolder[]): string[] {
  const subFolders = folders.filter((f) => f.parentFolderId === folderId)
  return subFolders.flatMap((f) => [f.id, ...getAllSubFolderIds(f.id, folders)])
}

// 删除文件夹
export async function deleteFolder(id: string): Promise<void> {
  const foldersStore = useFoldersStore.getState()
  const pagesStore = usePagesStore.getState()

  const allFolderIds = [id, ...getAllSubFolderIds(id, foldersStore.folders)]

  // 获取根目录现有页面的最大 order
  const rootPages = pagesStore.pages.filter((p) => !p.parentFolderId)
  const maxOrder = rootPages.reduce((max, p) => Math.max(max, p.order ?? 0), -1)

  // 移动页面到根目录
  let orderOffset = 0
  const pagesToMove = pagesStore.pages.filter(
    (p) => p.parentFolderId && allFolderIds.includes(p.parentFolderId)
  )
  for (const p of pagesToMove) {
    orderOffset++
    await pagesStore.updatePage(p.id, { parentFolderId: undefined, order: maxOrder + orderOffset })
  }

  // 删除所有子文件夹
  for (const folderId of allFolderIds) {
    await foldersStore.removeFolder(folderId)
  }
}

// 批量删除文件夹
export async function deleteFolders(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  const foldersStore = useFoldersStore.getState()
  const pagesStore = usePagesStore.getState()

  // 收集所有要删除的文件夹 ID（包括子文件夹）
  const allFolderIds = new Set<string>()
  for (const id of ids) {
    allFolderIds.add(id)
    for (const subId of getAllSubFolderIds(id, foldersStore.folders)) {
      allFolderIds.add(subId)
    }
  }

  // 获取根目录现有页面的最大 order
  const rootPages = pagesStore.pages.filter((p) => !p.parentFolderId)
  const maxOrder = rootPages.reduce((max, p) => Math.max(max, p.order ?? 0), -1)

  // 批量移动页面到根目录
  const pagesToMove = pagesStore.pages.filter(
    (p) => p.parentFolderId && allFolderIds.has(p.parentFolderId)
  )
  if (pagesToMove.length > 0) {
    await pagesStore.batchUpdatePages(
      pagesToMove.map((p, index) => ({
        id: p.id,
        updates: { parentFolderId: undefined, order: maxOrder + index + 1 }
      }))
    )
  }

  // 批量删除所有文件夹
  await foldersStore.removeFolders([...allFolderIds])
}

// 切换文件夹展开状态
export async function toggleFolderExpanded(id: string): Promise<void> {
  const store = useFoldersStore.getState()
  const folder = store.folders.find((f) => f.id === id)
  if (folder) {
    await store.updateFolder(id, { expanded: !folder.expanded })
  }
}

// 打开页面（在标签页中）
export async function openPage(pageId: string, preview = false): Promise<void> {
  const store = usePagesStore.getState()
  const page = store.pages.find((p) => p.id === pageId)
  if (!page) return

  // 预加载消息
  await useMessagesStore.getState().load(pageId)

  const tabsStore = useTabsStore.getState()
  const existingTab = tabsStore.tabs.find((t) => t.dataId === pageId)

  if (existingTab) {
    tabsStore.openTab(existingTab, preview)
  } else {
    tabsStore.openTab(
      {
        id: uuidv4(),
        type: 'chat',
        title: page.name,
        dataId: pageId
      },
      preview
    )
  }
}

// 获取文件夹下的页面
export function getPagesInFolder(folderId: string | undefined): PageRecord[] {
  const store = usePagesStore.getState()
  return store.pages
    .filter((p) => p.parentFolderId === folderId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

// 获取子文件夹
export function getSubFolders(parentFolderId: string | undefined): PageFolder[] {
  const store = useFoldersStore.getState()
  return store.folders
    .filter((f) => f.parentFolderId === parentFolderId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}
