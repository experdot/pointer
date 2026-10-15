/**
 * 页面树视图 Hook
 *
 * 只负责把镜像数据整理成界面需要的形状，写操作交给 pagesService 的命令。
 */

import { useCallback, useMemo } from 'react'
import type { Folder, Page } from '@renderer/types/shared'
import { usePagesStore } from '../stores/pagesStore'
import { useFoldersStore, type FolderView } from '../stores/foldersStore'
import * as pagesService from '../services/pagesService'

export type TreeNodeView = FolderView | Page

function sortNodes(nodes: TreeNodeView[]): TreeNodeView[] {
  return [...nodes].sort(
    (a, b) => a.order - b.order || a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1)
  )
}

interface UsePagesResult {
  pages: Page[]
  folders: FolderView[]
  rootPages: Page[]
  rootFolders: FolderView[]
  rootItems: TreeNodeView[]
  getItemsInFolder: (folderId: string | undefined) => TreeNodeView[]
  batchUpdateItemsOrder: (items: TreeNodeView[], parentFolderId?: string) => Promise<void>
  batchUpdateItemsOrderWithRename: (items: TreeNodeView[], parentFolderId?: string) => Promise<void>
  checkBatchMoveConflicts: (
    items: TreeNodeView[],
    parentFolderId?: string
  ) => { hasConflict: boolean; conflictNames: string[] }
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
  toggleStarPage: typeof pagesService.toggleStarPage
}

export function usePages(): UsePagesResult {
  const pages = usePagesStore((state) => state.pages)
  const folders = useFoldersStore((state) => state.folders)

  const rootItems = useMemo(
    () =>
      sortNodes([
        ...folders.filter((folder) => !folder.parentFolderId),
        ...pages.filter((page) => !page.parentFolderId)
      ]),
    [folders, pages]
  )

  const { rootPages, rootFolders } = useMemo(() => {
    const pageList: Page[] = []
    const folderList: FolderView[] = []
    for (const item of rootItems) {
      if (item.kind === 'page') pageList.push(item)
      else folderList.push(item)
    }
    return { rootPages: pageList, rootFolders: folderList }
  }, [rootItems])

  const getItemsInFolder = useCallback(
    (folderId: string | undefined) =>
      sortNodes([
        ...folders.filter((folder) => folder.parentFolderId === folderId),
        ...pages.filter((page) => page.parentFolderId === folderId)
      ]),
    [folders, pages]
  )

  /** 依次追加到目标文件夹，调用顺序即最终顺序；重名由内核自动处理 */
  const batchUpdateItemsOrder = useCallback(
    async (items: TreeNodeView[], parentFolderId?: string) => {
      for (const item of items) {
        if (item.kind === 'page') {
          await pagesService.movePage(item.id, parentFolderId)
        } else {
          await pagesService.moveFolder(item.id, parentFolderId)
        }
      }
    },
    []
  )

  const checkBatchMoveConflicts = useCallback((items: TreeNodeView[], parentFolderId?: string) => {
    const conflictNames: string[] = []

    for (const item of items) {
      if (item.parentFolderId === parentFolderId) continue
      const conflict =
        item.kind === 'page'
          ? pagesService.checkPageNameConflict(item.name, parentFolderId, item.id)
          : pagesService.checkFolderNameConflict(item.name, parentFolderId, item.id)
      if (conflict) conflictNames.push(item.name)
    }

    return { hasConflict: conflictNames.length > 0, conflictNames }
  }, [])

  return {
    pages,
    folders,
    rootPages,
    rootFolders,
    rootItems,
    getItemsInFolder,
    batchUpdateItemsOrder,
    batchUpdateItemsOrderWithRename: batchUpdateItemsOrder,
    checkBatchMoveConflicts,
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
    openPage: pagesService.openPage,
    toggleStarPage: pagesService.toggleStarPage
  }
}

export type { Folder, Page }
