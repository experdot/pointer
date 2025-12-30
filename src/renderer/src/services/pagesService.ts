import { v4 as uuidv4 } from 'uuid'
import type { ChatPage, PageFolder } from '../types/type'
import { usePagesStore } from '../stores/pagesStore'
import { useTabsStore } from '../stores/tabsStore'

// 创建新页面
export function createPage(title?: string, folderId?: string): ChatPage {
  const store = usePagesStore.getState()

  const page: ChatPage = {
    id: uuidv4(),
    title: title || '新对话',
    parentFolderId: folderId,
    createdAt: Date.now(),
    order: store.pages.length,
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

// 重新排序页面
export function reorderPages(pageIds: string[]): void {
  const store = usePagesStore.getState()
  const updates = pageIds.map((id, index) => ({ id, order: index }))
  updates.forEach(({ id, order }) => store.updatePage(id, { order }))
}

// 创建文件夹
export function createFolder(name?: string, parentFolderId?: string): PageFolder {
  const store = usePagesStore.getState()

  const folder: PageFolder = {
    id: uuidv4(),
    name: name || '新文件夹',
    parentFolderId,
    expanded: true,
    createdAt: Date.now(),
    order: store.folders.length
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
