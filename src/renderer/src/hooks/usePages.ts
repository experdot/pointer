import { useMemo, useCallback } from 'react'
import { usePagesStore } from '../stores/pagesStore'
import * as pagesService from '../services/pagesService'

export function usePages() {
  const { pages, folders } = usePagesStore()

  // 获取根级别的页面（不在任何文件夹中）
  const rootPages = useMemo(
    () =>
      pages
        .filter((p) => !p.parentFolderId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [pages]
  )

  // 获取根级别的文件夹
  const rootFolders = useMemo(
    () =>
      folders
        .filter((f) => !f.parentFolderId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [folders]
  )

  // 获取文件夹下的页面
  const getPagesInFolder = useCallback(
    (folderId: string | undefined) =>
      pages
        .filter((p) => p.parentFolderId === folderId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [pages]
  )

  // 获取子文件夹
  const getSubFolders = useCallback(
    (parentFolderId: string | undefined) =>
      folders
        .filter((f) => f.parentFolderId === parentFolderId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [folders]
  )

  return {
    pages,
    folders,
    rootPages,
    rootFolders,
    getPagesInFolder,
    getSubFolders,
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
