import { useMemo, useCallback } from 'react'
import { usePagesStore } from '../stores/pagesStore'
import { useFoldersStore } from '../stores/foldersStore'
import type { ChatPage, PageFolder } from '../types/type'
import * as pagesService from '../services/pagesService'

export function usePages(): {
  pages: ChatPage[]
  folders: PageFolder[]
  rootPages: ChatPage[]
  rootFolders: PageFolder[]
  rootItems: (ChatPage | PageFolder)[]
  getItemsInFolder: (folderId: string | undefined) => (ChatPage | PageFolder)[]
  batchUpdateItemsOrder: (items: (ChatPage | PageFolder)[], parentFolderId?: string) => void
  createPage: typeof pagesService.createPage
  updatePage: typeof pagesService.updatePage
  deletePage: typeof pagesService.deletePage
  deletePages: typeof pagesService.deletePages
  movePage: typeof pagesService.movePage
  createFolder: typeof pagesService.createFolder
  updateFolder: typeof pagesService.updateFolder
  deleteFolder: typeof pagesService.deleteFolder
  deleteFolders: typeof pagesService.deleteFolders
  clearFolder: typeof pagesService.clearFolder
  toggleFolderExpanded: typeof pagesService.toggleFolderExpanded
  openPage: typeof pagesService.openPage
} {
  // 使用选择器只订阅需要的状态，避免不必要的重渲染
  const pages = usePagesStore((state) => state.pages)
  const updateManyPages = usePagesStore((state) => state.updateMany)
  const folders = useFoldersStore((state) => state.folders)
  const updateManyFolders = useFoldersStore((state) => state.updateMany)

  // 获取根级别的页面和文件夹，混合排序
  const rootItems = useMemo(() => {
    const rootPages = pages.filter((p) => !p.parentFolderId)
    const rootFolders = folders.filter((f) => !f.parentFolderId)
    return [...rootFolders, ...rootPages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [pages, folders])

  // 直接从 rootItems 分离，避免重复过滤
  const { rootPages, rootFolders } = useMemo(() => {
    const pagesArr: ChatPage[] = []
    const foldersArr: PageFolder[] = []
    for (const item of rootItems) {
      if (item.type === 'item') pagesArr.push(item)
      else foldersArr.push(item)
    }
    return { rootPages: pagesArr, rootFolders: foldersArr }
  }, [rootItems])

  // 获取文件夹下的页面和子文件夹，混合排序
  const getItemsInFolder = useCallback(
    (folderId: string | undefined) => {
      const pagesInFolder = pages.filter((p) => p.parentFolderId === folderId)
      const subFolders = folders.filter((f) => f.parentFolderId === folderId)
      return [...subFolders, ...pagesInFolder].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    },
    [pages, folders]
  )

  // 批量更新项目顺序（用于拖拽）
  const batchUpdateItemsOrder = useCallback(
    (items: (ChatPage | PageFolder)[], parentFolderId?: string) => {
      const pageUpdates: Array<{ id: string; changes: Partial<ChatPage> }> = []
      const folderUpdates: Array<{ id: string; changes: Partial<PageFolder> }> = []

      items.forEach((item, index) => {
        if (item.type === 'item') {
          pageUpdates.push({ id: item.id, changes: { order: index, parentFolderId } })
        } else {
          folderUpdates.push({ id: item.id, changes: { order: index, parentFolderId } })
        }
      })

      if (pageUpdates.length) updateManyPages(pageUpdates)
      if (folderUpdates.length) updateManyFolders(folderUpdates)
    },
    [updateManyPages, updateManyFolders]
  )

  return {
    pages,
    folders,
    rootPages,
    rootFolders,
    rootItems,
    getItemsInFolder,
    batchUpdateItemsOrder,
    createPage: pagesService.createPage,
    updatePage: pagesService.updatePage,
    deletePage: pagesService.deletePage,
    deletePages: pagesService.deletePages,
    movePage: pagesService.movePage,
    createFolder: pagesService.createFolder,
    updateFolder: pagesService.updateFolder,
    deleteFolder: pagesService.deleteFolder,
    deleteFolders: pagesService.deleteFolders,
    clearFolder: pagesService.clearFolder,
    toggleFolderExpanded: pagesService.toggleFolderExpanded,
    openPage: pagesService.openPage
  }
}
