import { describe, expect, it } from 'vitest'
import { computeWorkspaceLayout, directoryOfRelativePath } from './layout'
import type { Folder, Page } from './page'

function folder(id: string, name: string, parentFolderId?: string, order = 0): Folder {
  return { id, kind: 'folder', name, parentFolderId, order, createdAt: 1 }
}

function page(id: string, name: string, parentFolderId?: string, order = 0): Page {
  return { id, kind: 'page', name, parentFolderId, order, createdAt: 1 }
}

describe('工作区布局', () => {
  it('文件夹层级映射为目录，页面位于所属目录', () => {
    const layout = computeWorkspaceLayout({
      folders: [folder('f1', '工作'), folder('f2', '归档', 'f1')],
      pages: [page('p1', '讨论', 'f1'), page('p2', '根页面')]
    })

    expect(layout.folderDirs.get('f1')).toBe('工作')
    expect(layout.folderDirs.get('f2')).toBe('工作/归档')
    expect(layout.pagePaths.get('p1')).toBe('工作/讨论.pointer.md')
    expect(layout.pagePaths.get('p2')).toBe('根页面.pointer.md')
  })

  it('非法字符被清洗，同名节点自动去重', () => {
    const layout = computeWorkspaceLayout({
      folders: [folder('f1', 'a/b', undefined, 0), folder('f2', 'a:b', undefined, 1)],
      pages: [page('p1', '同名', 'f1'), page('p2', '同名', 'f1')]
    })

    expect(layout.folderDirs.get('f1')).toBe('a b')
    expect(layout.folderDirs.get('f2')).toBe('a b (1)')
    expect(layout.pagePaths.get('p1')).toBe('a b/同名.pointer.md')
    expect(layout.pagePaths.get('p2')).toBe('a b/同名 (1).pointer.md')
  })

  it('排序决定目录与文件名的去重顺序', () => {
    const layout = computeWorkspaceLayout({
      folders: [],
      pages: [page('p1', '未命名', undefined, 1), page('p2', '未命名', undefined, 0)]
    })

    expect(layout.pagePaths.get('p2')).toBe('未命名.pointer.md')
    expect(layout.pagePaths.get('p1')).toBe('未命名 (1).pointer.md')
  })

  it('文件夹名与页面文件名同名冲突时共享命名空间', () => {
    const layout = computeWorkspaceLayout({
      folders: [folder('f1', 'X.POINTER.MD')],
      pages: [page('p1', 'x')]
    })

    expect(layout.folderDirs.get('f1')).toBe('X.POINTER.MD')
    expect(layout.pagePaths.get('p1')).toBe('x (1).pointer.md')
  })

  it('布局是纯函数：相同输入得到相同结果', () => {
    const input = {
      folders: [folder('f1', 'A')],
      pages: [page('p1', 'B', 'f1')]
    }
    expect(computeWorkspaceLayout(input)).toEqual(computeWorkspaceLayout(input))
  })

  it('推断相对路径所属目录', () => {
    expect(directoryOfRelativePath('a/b/c.pointer.md')).toBe('a/b')
    expect(directoryOfRelativePath('c.pointer.md')).toBe('')
  })
})
