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
  movePage: typeof pagesService.movePage
  createFolder: typeof pagesService.createFolder
  updateFolder: typeof pagesService.updateFolder
  deleteFolder: typeof pagesService.deleteFolder
  toggleFolderExpanded: typeof pagesService.toggleFolderExpanded
  openPage: typeof pagesService.openPage
} {
  const { pages, batchUpdatePages } = usePagesStore()
  const { folders, batchUpdateFolders } = useFoldersStore()

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
      if (item.type === 'page') pagesArr.push(item)
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
      const pageUpdates: Array<{ id: string; updates: Partial<ChatPage> }> = []
      const folderUpdates: Array<{ id: string; updates: Partial<PageFolder> }> = []

      items.forEach((item, index) => {
        if (item.type === 'page') {
          pageUpdates.push({ id: item.id, updates: { order: index, parentFolderId } })
        } else {
          folderUpdates.push({ id: item.id, updates: { order: index, parentFolderId } })
        }
      })

      if (pageUpdates.length) batchUpdatePages(pageUpdates)
      if (folderUpdates.length) batchUpdateFolders(folderUpdates)
    },
    [batchUpdatePages, batchUpdateFolders]
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
    movePage: pagesService.movePage,
    createFolder: pagesService.createFolder,
    updateFolder: pagesService.updateFolder,
    deleteFolder: pagesService.deleteFolder,
    toggleFolderExpanded: pagesService.toggleFolderExpanded,
    openPage: pagesService.openPage
  }
}
