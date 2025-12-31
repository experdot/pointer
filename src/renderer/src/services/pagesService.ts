import { v4 as uuidv4 } from 'uuid'
import type { ChatPage, PageFolder } from '../types/type'
import { usePagesStore } from '../stores/pagesStore'
import { useTabsStore } from '../stores/tabsStore'

// 计算新项目的插入位置和 order，并更新同级项目的 order
// afterItemId: 可选，指定插入到哪个项目后面（优先级高于 activeTab）
function prepareInsertPosition(afterItemId?: string): {
  parentFolderId: string | undefined
  order: number
} {
  const store = usePagesStore.getState()
  const tabsStore = useTabsStore.getState()

  // 查找参考项目（优先使用传入的 afterItemId）
  let referenceItem: ChatPage | PageFolder | null = null
  if (afterItemId) {
    referenceItem =
      store.pages.find((p) => p.id === afterItemId) ||
      store.folders.find((f) => f.id === afterItemId) ||
      null
  }
  if (!referenceItem) {
    const activeTab = tabsStore.tabs.find((t) => t.id === tabsStore.activeTabId)
    referenceItem = activeTab?.pageId
      ? store.pages.find((p) => p.id === activeTab.pageId) || null
      : null
  }

  let parentFolderId: string | undefined
  let newOrder: number

  if (referenceItem) {
    // 插入到参考项目的下方（同一层级）
    parentFolderId = referenceItem.parentFolderId
    newOrder = (referenceItem.order ?? 0) + 1
  } else {
    // 插入到根目录最前面
    parentFolderId = undefined
    newOrder = 0
  }

  // 批量更新同级中 order >= newOrder 的项目
  const pageUpdates = store.pages
    .filter((p) => p.parentFolderId === parentFolderId && (p.order ?? 0) >= newOrder)
    .map((p) => ({ id: p.id, updates: { order: (p.order ?? 0) + 1 } }))
  const folderUpdates = store.folders
    .filter((f) => f.parentFolderId === parentFolderId && (f.order ?? 0) >= newOrder)
    .map((f) => ({ id: f.id, updates: { order: (f.order ?? 0) + 1 } }))

  if (pageUpdates.length) store.batchUpdatePages(pageUpdates)
  if (folderUpdates.length) store.batchUpdateFolders(folderUpdates)

  return { parentFolderId, order: newOrder }
}

// 创建新页面（插入到指定项目下方，或当前选中页面下方，或根目录最前面）
export function createPage(title?: string, afterItemId?: string): ChatPage {
  const store = usePagesStore.getState()
  const { parentFolderId, order } = prepareInsertPosition(afterItemId)

  const page: ChatPage = {
    type: 'page',
    id: uuidv4(),
    title: title || '新对话',
    parentFolderId,
    createdAt: Date.now(),
    order,
    data: {
      messages: []
    }
  }

  store.addPage(page)
  return page
}

// 更新页面
export function updatePage(id: string, updates: Partial<ChatPage>): void {
  usePagesStore.getState().updatePage(id, updates)

  // 同步更新标签页标题
  if (updates.title) {
    const tabsStore = useTabsStore.getState()
    const tab = tabsStore.tabs.find((t) => t.pageId === id)
    if (tab) {
      tabsStore.updateTabTitle(tab.id, updates.title)
    }
  }
}

// 删除页面
export function deletePage(id: string): void {
  usePagesStore.getState().removePage(id)

  // 关闭对应的标签页
  const tabsStore = useTabsStore.getState()
  const tab = tabsStore.tabs.find((t) => t.pageId === id)
  if (tab) {
    tabsStore.closeTab(tab.id)
  }
}

// 移动页面到文件夹
export function movePage(pageId: string, folderId: string | undefined): void {
  usePagesStore.getState().updatePage(pageId, { parentFolderId: folderId })
}

// 创建文件夹（插入到指定项目下方，或当前选中页面下方，或根目录最前面）
export function createFolder(name?: string, afterItemId?: string): PageFolder {
  const store = usePagesStore.getState()
  const { parentFolderId, order } = prepareInsertPosition(afterItemId)

  const folder: PageFolder = {
    type: 'folder',
    id: uuidv4(),
    name: name || '新文件夹',
    parentFolderId,
    expanded: true,
    createdAt: Date.now(),
    order
  }

  store.addFolder(folder)
  return folder
}

// 更新文件夹
export function updateFolder(id: string, updates: Partial<PageFolder>): void {
  usePagesStore.getState().updateFolder(id, updates)
}

// 删除文件夹
export function deleteFolder(id: string): void {
  usePagesStore.getState().removeFolder(id)
}

// 切换文件夹展开状态
export function toggleFolderExpanded(id: string): void {
  const store = usePagesStore.getState()
  const folder = store.folders.find((f) => f.id === id)
  if (folder) {
    store.updateFolder(id, { expanded: !folder.expanded })
  }
}

// 打开页面（在标签页中）
export function openPage(pageId: string): void {
  const store = usePagesStore.getState()
  const page = store.pages.find((p) => p.id === pageId)
  if (!page) return

  const tabsStore = useTabsStore.getState()
  tabsStore.openTab({
    id: `chat-${pageId}`,
    type: 'chat',
    title: page.title,
    pageId: pageId
  })
}

// 获取文件夹下的页面
export function getPagesInFolder(folderId: string | undefined): ChatPage[] {
  const store = usePagesStore.getState()
  return store.pages
    .filter((p) => p.parentFolderId === folderId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

// 获取子文件夹
export function getSubFolders(parentFolderId: string | undefined): PageFolder[] {
  const store = usePagesStore.getState()
  return store.folders
    .filter((f) => f.parentFolderId === parentFolderId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}
