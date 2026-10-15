/**
 * 工作区磁盘布局
 *
 * 布局是「文件夹元数据 + 页面元数据」的纯函数：
 * 同样的数据必然得到同样的目录与文件名，因此外部改动后重新扫描即可对齐。
 */

import { compareNodes, nameKey } from './common'
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

export function computeWorkspaceLayout({ folders, pages }: WorkspaceLayoutInput): WorkspaceLayout {
  const folderDirs = new Map<string, string>()
  const pagePaths = new Map<string, string>()

  const assign = (parentFolderId: string | undefined, parentDir: string): void => {
    // 目录名与页面文件名在同一层级共享命名空间：
    // 文件夹名可以以 .pointer.md 结尾，与页面文件完全同名，磁盘上无法共存
    const taken = new Set<string>()

    const childFolders = folders
      .filter((folder) => folder.parentFolderId === parentFolderId)
      .sort(compareNodes)
    for (const folder of childFolders) {
      const dirName = uniqueName(taken, sanitizeFileName(folder.name))
      taken.add(nameKey(dirName))
      const dir = parentDir ? `${parentDir}/${dirName}` : dirName
      folderDirs.set(folder.id, dir)
      assign(folder.id, dir)
    }

    const childPages = pages
      .filter((page) => page.parentFolderId === parentFolderId)
      .sort(compareNodes)
    for (const page of childPages) {
      const fileName = uniquePageFileName(taken, page.name)
      taken.add(nameKey(fileName))
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
