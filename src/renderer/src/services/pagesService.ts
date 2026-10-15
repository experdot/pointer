/**
 * 页面与文件夹服务
 */

import type { Folder, Page } from '@shared/domain'
import { nameKey } from '@shared/domain'
import { v4 as uuidv4 } from 'uuid'
import { refreshTree } from '../runtime/bootstrap'
import { useFoldersStore } from '../stores/foldersStore'
import { useMessagesStore } from '../stores/messagesStore'
import { usePagesStore } from '../stores/pagesStore'
import { useTabsStore } from '../stores/tabsStore'

/**
 * 未指定参照项时，用"当前激活页签对应的会话"作为参照
 *
 * 与迁移前的 prepareInsertPosition 一致：没有选中项时以当前打开的会话为基准，
 * 新建的内容紧随其后；完全无参照时才落到根目录最前面（由内核处理）。
 */
function referenceFromActiveTab(): { parentFolderId?: string; afterNodeId?: string } {
  const tabsStore = useTabsStore.getState()
  const tab = tabsStore.tabs.find((item) => item.id === tabsStore.activeTabId)
  if (!tab || tab.type !== 'chat' || !tab.dataId) return {}

  const page = usePagesStore.getState().getById(tab.dataId)
  if (!page) return {}

  return { parentFolderId: page.parentFolderId, afterNodeId: page.id }
}

export async function createPage(input?: {
  name?: string
  parentFolderId?: string
  afterNodeId?: string
  starred?: boolean
}): Promise<Page> {
  const hasReference = Boolean(input?.parentFolderId || input?.afterNodeId)
  const target = hasReference ? input : { ...input, ...referenceFromActiveTab() }
  return usePagesStore.getState().create(target)
}

export async function updatePage(
  id: string,
  updates: { name?: string; starred?: boolean }
): Promise<void> {
  await usePagesStore.getState().update(id, updates)
}

export async function toggleStarPage(id: string): Promise<void> {
  const page = usePagesStore.getState().getById(id)
  if (!page) return
  await usePagesStore.getState().update(id, { starred: !page.starred })
}

export async function deletePage(id: string): Promise<void> {
  await usePagesStore.getState().delete(id)
}

export async function deletePages(ids: readonly string[]): Promise<void> {
  await usePagesStore.getState().deleteMany([...ids])
}

export async function movePage(
  id: string,
  targetFolderId: string | undefined,
  beforeNodeId?: string
): Promise<void> {
  await usePagesStore.getState().move(id, targetFolderId, beforeNodeId)
}

export async function moveFolder(
  id: string,
  targetFolderId: string | undefined,
  beforeNodeId?: string
): Promise<void> {
  await useFoldersStore.getState().move(id, targetFolderId, beforeNodeId)
}

export function checkPageNameConflict(
  name: string,
  parentFolderId: string | undefined,
  excludeId?: string
): boolean {
  const key = nameKey(name)
  return usePagesStore
    .getState()
    .findByFolderId(parentFolderId)
    .some((page) => page.id !== excludeId && nameKey(page.name) === key)
}

export function checkFolderNameConflict(
  name: string,
  parentFolderId: string | undefined,
  excludeId?: string
): boolean {
  const key = nameKey(name)
  return useFoldersStore
    .getState()
    .findByParentId(parentFolderId)
    .some((folder) => folder.id !== excludeId && nameKey(folder.name) === key)
}

export async function createFolder(input?: {
  name?: string
  parentFolderId?: string
  afterNodeId?: string
}): Promise<Folder> {
  const hasReference = Boolean(input?.parentFolderId || input?.afterNodeId)
  const target = hasReference ? input : { ...input, ...referenceFromActiveTab() }
  return useFoldersStore.getState().create(target)
}

export async function updateFolder(id: string, updates: { name?: string }): Promise<void> {
  await useFoldersStore.getState().update(id, updates)
}

/** 单个文件夹删除：与迁移前一致，级联删除内容（确认框文案也是这么写的） */
export async function deleteFolder(
  id: string,
  mode: 'promote' | 'cascade' = 'cascade'
): Promise<void> {
  await useFoldersStore.getState().delete(id, mode)
}

/** 批量删除文件夹：与迁移前一致，内容提升到根目录 */
export async function deleteFolders(
  ids: readonly string[],
  mode: 'promote' | 'cascade' = 'promote'
): Promise<void> {
  await useFoldersStore.getState().delete([...ids], mode)
}

export async function clearFolder(id: string): Promise<void> {
  await useFoldersStore.getState().clear(id)
}

export function toggleFolderExpanded(id: string): void {
  useFoldersStore.getState().toggleExpanded(id)
}

export async function openPage(pageId: string, preview = false): Promise<void> {
  let page = usePagesStore.getState().getById(pageId)
  if (!page) {
    // 页面可能刚由内核创建、tree.changed 还没到达镜像，这里主动刷新一次
    await refreshTree()
    page = usePagesStore.getState().getById(pageId)
  }
  if (!page) return

  // 迁移前行为：打开页面前预加载消息
  await useMessagesStore.getState().load(pageId)

  const tabsStore = useTabsStore.getState()
  const existingTab = tabsStore.tabs.find((tab) => tab.type === 'chat' && tab.dataId === pageId)

  if (existingTab) {
    tabsStore.openTab(existingTab, preview)
    return
  }

  tabsStore.openTab(
    {
      id: uuidv4(),
      type: 'chat',
      title: page.name,
      dataId: pageId
    },
    preview
  )
}
