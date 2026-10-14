import { describe, expect, it } from 'vitest'
import type { Folder, Page } from '@renderer/types/shared'
import { resolveCreationTarget } from './creationTarget'

const rootPage: Page = { id: 'p1', kind: 'page', name: '根对话', order: 0, createdAt: 1 }
const rootFolder: Folder = { id: 'f1', kind: 'folder', name: '分组', order: 1, createdAt: 1 }
const childPage: Page = {
  id: 'p2',
  kind: 'page',
  name: '子对话',
  parentFolderId: 'f1',
  order: 0,
  createdAt: 2
}

describe('新建节点落位', () => {
  const folders = [rootFolder]
  const pages = [rootPage, childPage]

  it('未选中时落在根目录末尾', () => {
    expect(resolveCreationTarget(undefined, folders, pages)).toEqual({})
    expect(resolveCreationTarget(null, folders, pages)).toEqual({})
  })

  it('选中对话时与它同级并紧随其后', () => {
    expect(resolveCreationTarget('p2', folders, pages)).toEqual({
      parentFolderId: 'f1',
      afterNodeId: 'p2'
    })
    expect(resolveCreationTarget('p1', folders, pages)).toEqual({
      parentFolderId: undefined,
      afterNodeId: 'p1'
    })
  })

  it('选中文件夹时与它同级而不是成为它的子节点', () => {
    expect(resolveCreationTarget('f1', folders, pages)).toEqual({
      parentFolderId: undefined,
      afterNodeId: 'f1'
    })
  })

  it('选中项已不存在时回落到根目录', () => {
    expect(resolveCreationTarget('missing', folders, pages)).toEqual({})
  })
})
