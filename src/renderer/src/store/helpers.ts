import { v4 as uuidv4 } from 'uuid'
import { Chat, ChatFolder } from '../types'
import { SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from './constants'

// Chat helpers
export const createNewChat = (title: string, folderId?: string): Chat => ({
  id: uuidv4(),
  title,
  messages: [],
  folderId,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  order: Date.now() // 使用创建时间作为默认排序
})

export const updateChatById = (chats: Chat[], chatId: string, updates: Partial<Chat>): Chat[] =>
  chats.map((chat) => (chat.id === chatId ? { ...chat, ...updates, updatedAt: Date.now() } : chat))

// Folder helpers
export const createNewFolder = (name: string, parentId?: string): ChatFolder => ({
  id: uuidv4(),
  name,
  expanded: true,
  createdAt: Date.now(),
  order: Date.now(), // 使用创建时间作为默认排序
  parentId
})

export const updateFolderById = (
  folders: ChatFolder[],
  folderId: string,
  updates: Partial<ChatFolder>
): ChatFolder[] =>
  folders.map((folder) => (folder.id === folderId ? { ...folder, ...updates } : folder))

// Generic helpers
export const removeFromArray = <T extends { id: string }>(array: T[], id: string): T[] =>
  array.filter((item) => item.id !== id)

export const constrainSidebarWidth = (width: number): number =>
  Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, width))
