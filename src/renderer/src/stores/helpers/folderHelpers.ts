import { v4 as uuidv4 } from 'uuid'
import { PageFolder } from '../../types/type'

// 创建新文件夹
export const createNewFolder = (name: string, parentId?: string): PageFolder => ({
  id: uuidv4(),
  name,
  expanded: true,
  createdAt: Date.now(),
  order: Date.now(),
  parentId
})

// 根据ID更新文件夹
export const updateFolderById = (
  folders: PageFolder[],
  folderId: string,
  updates: Partial<PageFolder>
): PageFolder[] =>
  folders.map((folder) => (folder.id === folderId ? { ...folder, ...updates } : folder))
