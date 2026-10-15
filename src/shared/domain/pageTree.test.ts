import { describe, expect, it } from 'vitest'
import type { Folder, Page, PageTree } from './page'
import {
  addFolder,
  addPage,
  childrenOf,
  clearFolder,
  descendantFolderIds,
  folderPathNames,
  isFolderAncestor,
  moveNode,
  nextOrder,
  removeFolder,
  removePages,
  validatePageTree
} from './page'

function folder(id: string, name: string, parentFolderId?: string, order = 0): Folder {
  return { id, kind: 'folder', name, parentFolderId, order, createdAt: 1 }
}

function page(id: string, name: string, parentFolderId?: string, order = 0): Page {
  return { id, kind: 'page', name, parentFolderId, order, createdAt: 1 }
}

function fixture(): PageTree {
  let tree: PageTree = { folders: [], pages: [] }
  tree = addFolder(tree, folder('f1', '工作'))
  tree = addFolder(tree, folder('f2', '归档', 'f1'))
  tree = addPage(tree, page('p1', '讨论', 'f1'))
  tree = addPage(tree, page('p2', '根页面'))
  return tree
}

describe('页面树遍历', () => {
  it('同级节点按 order 排序，文件夹在前', () => {
    const tree = fixture()
    expect(childrenOf(tree, undefined).map((node) => node.id)).toEqual(['f1', 'p2'])
    expect(childrenOf(tree, 'f1').map((node) => node.id)).toEqual(['f2', 'p1'])
  })

  it('计算层级路径与后代集合', () => {
    const tree = fixture()
    expect(folderPathNames(tree, 'f2')).toEqual(['工作', '归档'])
    expect(folderPathNames(tree, undefined)).toEqual([])
    expect(descendantFolderIds(tree, 'f1')).toEqual(['f2'])
    expect(isFolderAncestor(tree, 'f1', 'f2')).toBe(true)
    expect(isFolderAncestor(tree, 'f2', 'f1')).toBe(false)
  })

  it('nextOrder 跳过已占用序号', () => {
    const tree = fixture()
    expect(nextOrder(tree, undefined)).toBe(1)
    expect(nextOrder(tree, 'f1')).toBe(1)
  })
})

describe('页面树变更', () => {
  it('移动页面到目标文件夹并重排序号', () => {
    const tree = moveNode(fixture(), 'p2', 'f2', undefined, 100)

    expect(childrenOf(tree, undefined).map((node) => node.id)).toEqual(['f1'])
    expect(childrenOf(tree, 'f2').map((node) => node.id)).toEqual(['p2'])
    expect(tree.pages.find((item) => item.id === 'p2')?.order).toBe(0)
  })

  it('可插入到指定同级节点之前', () => {
    const tree = moveNode(fixture(), 'p2', 'f1', 'p1', 100)
    expect(childrenOf(tree, 'f1').map((node) => node.id)).toEqual(['f2', 'p2', 'p1'])
  })

  it('禁止把文件夹移动到自身后代之下', () => {
    const tree = fixture()
    expect(moveNode(tree, 'f1', 'f2')).toEqual(tree)
  })

  it('删除文件夹可提升子节点或级联删除', () => {
    const promoted = removeFolder(fixture(), 'f1', 'promote')
    expect(promoted.folders.map((item) => item.id)).toEqual(['f2'])
    expect(promoted.pages.map((item) => item.id).sort()).toEqual(['p1', 'p2'])
    expect(promoted.folders[0].parentFolderId).toBeUndefined()

    const cascaded = removeFolder(fixture(), 'f1', 'cascade')
    expect(cascaded.folders).toEqual([])
    expect(cascaded.pages.map((item) => item.id)).toEqual(['p2'])
  })

  it('清空文件夹保留文件夹本身', () => {
    const tree = clearFolder(fixture(), 'f1')
    expect(tree.folders.map((item) => item.id)).toEqual(['f1'])
    expect(tree.pages.map((item) => item.id)).toEqual(['p2'])
  })

  it('批量删除页面', () => {
    expect(removePages(fixture(), ['p1', 'p2']).pages).toEqual([])
  })
})

describe('页面树校验', () => {
  it('合法树无诊断', () => {
    expect(validatePageTree(fixture())).toEqual([])
  })

  it('捕获孤立父节点与同名节点', () => {
    let tree = fixture()
    tree = addPage(tree, page('p3', '根页面'))
    tree = addPage(tree, page('p4', '孤儿', 'ghost'))

    const codes = validatePageTree(tree).map((diagnostic) => diagnostic.code)
    expect(codes).toContain('tree.duplicate-name')
    expect(codes).toContain('tree.orphan')
  })

  it('捕获文件夹循环引用', () => {
    const tree: PageTree = {
      folders: [folder('a', 'A', 'b'), folder('b', 'B', 'a')],
      pages: []
    }
    expect(validatePageTree(tree).map((diagnostic) => diagnostic.code)).toContain('tree.cycle')
  })
})

describe('损伤数据的环保护', () => {
  it('descendantFolderIds 在循环文件夹下也能终止', () => {
    const cyclic: PageTree = {
      folders: [folder('a', 'A', 'b'), folder('b', 'B', 'a')],
      pages: []
    }
    expect([...descendantFolderIds(cyclic, 'a')].sort()).toEqual(['b'])

    const selfParent: PageTree = { folders: [folder('s', 'S', 's')], pages: [] }
    expect(descendantFolderIds(selfParent, 's')).toEqual([])
  })
})
