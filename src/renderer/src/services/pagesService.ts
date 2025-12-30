import { v4 as uuidv4 } from 'uuid'
import type { ChatPage, PageFolder } from '../types/type'
import { usePagesStore } from '../stores/pagesStore'
import { useTabsStore } from '../stores/tabsStore'

// 创建新页面（插入到当前选中页面下方，或根目录最前面）
export function createPage(title?: string): ChatPage {
  const store = usePagesStore.getState()
  const tabsStore = useTabsStore.getState()

  // 获取当前选中的页面
  const activeTab = tabsStore.tabs.find((t) => t.id === tabsStore.activeTabId)
  const selectedPage = activeTab?.pageId
    ? store.pages.find((p) => p.id === activeTab.pageId)
    : null

  let parentFolderId: string | undefined
  let newOrder: number

  if (selectedPage) {
    // 插入到选中页面的下方（同一层级）
    parentFolderId = selectedPage.parentFolderId
    newOrder = (selectedPage.order ?? 0) + 1

    // 更新同级中 order >= newOrder 的项目
    store.pages
      .filter((p) => p.parentFolderId === parentFolderId && (p.order ?? 0) >= newOrder)
      .forEach((p) => store.updatePage(p.id, { order: (p.order ?? 0) + 1 }))
    store.folders
      .filter((f) => f.parentFolderId === parentFolderId && (f.order ?? 0) >= newOrder)
      .forEach((f) => store.updateFolder(f.id, { order: (f.order ?? 0) + 1 }))
  } else {
    // 插入到根目录最前面
    parentFolderId = undefined
    newOrder = 0

    // 更新根目录所有项目的 order + 1
    store.pages
      .filter((p) => !p.parentFolderId)
      .forEach((p) => store.updatePage(p.id, { order: (p.order ?? 0) + 1 }))
    store.folders
      .filter((f) => !f.parentFolderId)
      .forEach((f) => store.updateFolder(f.id, { order: (f.order ?? 0) + 1 }))
  }

  const page: ChatPage = {
    type: 'page',
    id: uuidv4(),
    title: title || '新对话',
    parentFolderId,
    createdAt: Date.now(),
    order: newOrder,
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

// 创建文件夹
export function createFolder(name?: string, parentFolderId?: string): PageFolder {
  const store = usePagesStore.getState()

  // 计算同级的最大 order（包括文件夹和页面）
  const foldersInSameLevel = store.folders.filter((f) => f.parentFolderId === parentFolderId)
  const pagesInSameLevel = store.pages.filter((p) => p.parentFolderId === parentFolderId)
  const maxFolderOrder = foldersInSameLevel.reduce((max, f) => Math.max(max, f.order ?? 0), -1)
  const maxPageOrder = pagesInSameLevel.reduce((max, p) => Math.max(max, p.order ?? 0), -1)
  const maxOrder = Math.max(maxFolderOrder, maxPageOrder)

  const folder: PageFolder = {
    type: 'folder',
    id: uuidv4(),
    name: name || '新文件夹',
    parentFolderId,
    expanded: true,
    createdAt: Date.now(),
    order: maxOrder + 1
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
