/**
 * 工作区磁盘布局
 *
 * 布局是「文件夹元数据 + 页面元数据」的纯函数：
 * 同样的数据必然得到同样的目录与文件名，因此外部改动后重新扫描即可对齐。
 */

import { nameKey } from './common'
import { sanitizeFileName, uniquePageFileName, uniqueName } from './naming'
import type { Folder, Page } from './page'

interface WorkspaceLayoutInput {
  folders: readonly Folder[]
  pages: readonly Page[]
}

interface WorkspaceLayout {
  /** 文件夹 id 到相对目录路径（根目录为 ''） */
  folderDirs: Map<string, string>
  /** 页面 id 到相对文件路径（使用 / 分隔） */
  pagePaths: Map<string, string>
}

function sortNodes<T extends { order: number; createdAt: number; id: string }>(nodes: T[]): T[] {
  return [...nodes].sort(
    (a, b) => a.order - b.order || a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1)
  )
}

export function computeWorkspaceLayout({ folders, pages }: WorkspaceLayoutInput): WorkspaceLayout {
  const folderDirs = new Map<string, string>()
  const pagePaths = new Map<string, string>()

  const assign = (parentFolderId: string | undefined, parentDir: string): void => {
    // 目录名与页面文件名互不冲突（页面带扩展名），分别去重
    const takenDirs = new Set<string>()
    const takenFiles = new Set<string>()

    const childFolders = sortNodes(
      folders.filter((folder) => folder.parentFolderId === parentFolderId)
    )
    for (const folder of childFolders) {
      const dirName = uniqueName(takenDirs, sanitizeFileName(folder.name))
      takenDirs.add(nameKey(dirName))
      const dir = parentDir ? `${parentDir}/${dirName}` : dirName
      folderDirs.set(folder.id, dir)
      assign(folder.id, dir)
    }

    const childPages = sortNodes(pages.filter((page) => page.parentFolderId === parentFolderId))
    for (const page of childPages) {
      const fileName = uniquePageFileName(takenFiles, page.name)
      takenFiles.add(nameKey(fileName))
      pagePaths.set(page.id, parentDir ? `${parentDir}/${fileName}` : fileName)
    }
  }

  assign(undefined, '')
  return { folderDirs, pagePaths }
}

/** 从相对文件路径推断所属目录（根目录为 ''） */
export function directoryOfRelativePath(relativePath: string): string {
  const index = relativePath.lastIndexOf('/')
  return index === -1 ? '' : relativePath.slice(0, index)
}
