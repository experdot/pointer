import { useMemo, useCallback } from 'react'
import { usePagesStore } from '../stores/pagesStore'
import type { ChatPage, PageFolder } from '../types/type'
import * as pagesService from '../services/pagesService'

export function usePages() {
  const { pages, folders } = usePagesStore()

  // 获取根级别的页面和文件夹，混合排序
  const rootItems = useMemo(() => {
    const rootPages = pages.filter((p) => !p.parentFolderId)
    const rootFolders = folders.filter((f) => !f.parentFolderId)
    return [...rootFolders, ...rootPages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [pages, folders])

  const rootPages = useMemo(
    () => rootItems.filter((item) => 'data' in item) as ChatPage[],
    [rootItems]
  )

  const rootFolders = useMemo(
    () => rootItems.filter((item) => !('data' in item)) as PageFolder[],
    [rootItems]
  )

  // 获取文件夹下的页面和子文件夹，混合排序
  const getItemsInFolder = useCallback(
    (folderId: string | undefined) => {
      const pagesInFolder = pages.filter((p) => p.parentFolderId === folderId)
      const subFolders = folders.filter((f) => f.parentFolderId === folderId)
      return [...subFolders, ...pagesInFolder].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    },
    [pages, folders]
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
    rootItems,
    getItemsInFolder,
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
