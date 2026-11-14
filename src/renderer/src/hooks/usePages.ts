/**
 * 页面树视图 Hook
 *
 * 只负责把镜像数据整理成界面需要的形状，写操作交给 pagesService 的命令。
 */

import { useCallback, useMemo } from 'react'
import type { Folder, Page } from '@renderer/types/shared'
import { compareNodes } from '@shared/domain'
import { usePagesStore } from '../stores/pagesStore'
import { useFoldersStore, type FolderView } from '../stores/foldersStore'
import * as pagesService from '../services/pagesService'

export type TreeNodeView = FolderView | Page

interface UsePagesResult {
  pages: Page[]
  folders: FolderView[]
  rootPages: Page[]
  rootFolders: FolderView[]
  rootItems: TreeNodeView[]
  getItemsInFolder: (folderId: string | undefined) => TreeNodeView[]
  moveNode: typeof pagesService.moveNode
  createPage: typeof pagesService.createPage
  updatePage: typeof pagesService.updatePage
  deletePage: typeof pagesService.deletePage
  deletePages: typeof pagesService.deletePages
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
      [
        ...folders.filter((folder) => !folder.parentFolderId),
        ...pages.filter((page) => !page.parentFolderId)
      ].sort(compareNodes),
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
      [
        ...folders.filter((folder) => folder.parentFolderId === folderId),
        ...pages.filter((page) => page.parentFolderId === folderId)
      ].sort(compareNodes),
    [folders, pages]
  )

  return {
    pages,
    folders,
    rootPages,
    rootFolders,
    rootItems,
    getItemsInFolder,
    moveNode: pagesService.moveNode,
    createPage: pagesService.createPage,
    updatePage: pagesService.updatePage,
    deletePage: pagesService.deletePage,
    deletePages: pagesService.deletePages,
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
