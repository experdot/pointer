import { useMemo, useCallback } from 'react'
import { usePagesStore } from '../stores/pagesStore'
import { useFoldersStore } from '../stores/foldersStore'
import type { ChatPage, PageFolder } from '../types/type'
import * as pagesService from '../services/pagesService'
import { generateUniqueName } from '../services/pagesService'

export function usePages(): {
  pages: ChatPage[]
  folders: PageFolder[]
  rootPages: ChatPage[]
  rootFolders: PageFolder[]
  rootItems: (ChatPage | PageFolder)[]
  getItemsInFolder: (folderId: string | undefined) => (ChatPage | PageFolder)[]
  batchUpdateItemsOrder: (items: (ChatPage | PageFolder)[], parentFolderId?: string) => void
  batchUpdateItemsOrderWithRename: (items: (ChatPage | PageFolder)[], parentFolderId?: string) => void
  checkBatchMoveConflicts: (
    items: (ChatPage | PageFolder)[],
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

  // 批量更新项目顺序（用于拖拽）- 不处理重名
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

  // 批量更新项目顺序 - 自动处理重名冲突
  const batchUpdateItemsOrderWithRename = useCallback(
    (items: (ChatPage | PageFolder)[], parentFolderId?: string) => {
      const pageUpdates: Array<{ id: string; changes: Partial<ChatPage> }> = []
      const folderUpdates: Array<{ id: string; changes: Partial<PageFolder> }> = []

      // 获取目标文件夹中现有的名称（排除正在移动的项目）
      const movingIds = new Set(items.map((item) => item.id))
      const existingPageNames = pages
        .filter((p) => p.parentFolderId === parentFolderId && !movingIds.has(p.id))
        .map((p) => p.name)
      const existingFolderNames = folders
        .filter((f) => f.parentFolderId === parentFolderId && !movingIds.has(f.id))
        .map((f) => f.name)

      // 跟踪已使用的名称，避免移动多个同名项目时重复
      const usedPageNames = new Set(existingPageNames)
      const usedFolderNames = new Set(existingFolderNames)

      items.forEach((item, index) => {
        if (item.type === 'item') {
          const isMovingToNewFolder = item.parentFolderId !== parentFolderId
          let newName = item.name

          if (isMovingToNewFolder && usedPageNames.has(item.name)) {
            newName = generateUniqueName(item.name, [...usedPageNames])
          }
          usedPageNames.add(newName)

          pageUpdates.push({
            id: item.id,
            changes: {
              order: index,
              parentFolderId,
              ...(newName !== item.name ? { name: newName } : {})
            }
          })
        } else {
          const isMovingToNewFolder = item.parentFolderId !== parentFolderId
          let newName = item.name

          if (isMovingToNewFolder && usedFolderNames.has(item.name)) {
            newName = generateUniqueName(item.name, [...usedFolderNames])
          }
          usedFolderNames.add(newName)

          folderUpdates.push({
            id: item.id,
            changes: {
              order: index,
              parentFolderId,
              ...(newName !== item.name ? { name: newName } : {})
            }
          })
        }
      })

      if (pageUpdates.length) updateManyPages(pageUpdates)
      if (folderUpdates.length) updateManyFolders(folderUpdates)
    },
    [pages, folders, updateManyPages, updateManyFolders]
  )

  // 检查批量移动是否有重名冲突
  const checkBatchMoveConflicts = useCallback(
    (
      items: (ChatPage | PageFolder)[],
      parentFolderId?: string
    ): { hasConflict: boolean; conflictNames: string[] } => {
      // 只找出实际会被移动的项目（parentFolderId 会改变的）
      const movingItems = items.filter((item) => item.parentFolderId !== parentFolderId)
      const movingIds = new Set(movingItems.map((item) => item.id))

      // 目标文件夹中现有的名称（只排除正在移动进来的项目）
      const existingPageNames = new Set(
        pages
          .filter((p) => p.parentFolderId === parentFolderId && !movingIds.has(p.id))
          .map((p) => p.name)
      )
      const existingFolderNames = new Set(
        folders
          .filter((f) => f.parentFolderId === parentFolderId && !movingIds.has(f.id))
          .map((f) => f.name)
      )

      const conflictNames: string[] = []

      for (const item of movingItems) {
        if (item.type === 'item') {
          if (existingPageNames.has(item.name)) {
            conflictNames.push(item.name)
          }
        } else {
          if (existingFolderNames.has(item.name)) {
            conflictNames.push(item.name)
          }
        }
      }

      return { hasConflict: conflictNames.length > 0, conflictNames }
    },
    [pages, folders]
  )

  return {
    pages,
    folders,
    rootPages,
    rootFolders,
    rootItems,
    getItemsInFolder,
    batchUpdateItemsOrder,
    batchUpdateItemsOrderWithRename,
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
    openPage: pagesService.openPage
  }
}
