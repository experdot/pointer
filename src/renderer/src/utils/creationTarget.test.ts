import { describe, expect, it } from 'vitest'
import type { Folder, Page } from '@renderer/types/shared'
import { resolveFolderCreationTarget, resolvePageCreationTarget } from './creationTarget'

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

describe('新建对话落位（v1 策略：固定落在目标层级最前面）', () => {
  const folders = [rootFolder]
  const pages = [rootPage, childPage]

  it('未选中时返回空参照', () => {
    expect(resolvePageCreationTarget(undefined, folders, pages)).toEqual({})
    expect(resolvePageCreationTarget(null, folders, pages)).toEqual({})
  })

  it('选中对话时放进它所在的文件夹', () => {
    expect(resolvePageCreationTarget('p2', folders, pages)).toEqual({ parentFolderId: 'f1' })
    expect(resolvePageCreationTarget('p1', folders, pages)).toEqual({ parentFolderId: undefined })
  })

  it('选中文件夹时放进该文件夹内部', () => {
    expect(resolvePageCreationTarget('f1', folders, pages)).toEqual({ parentFolderId: 'f1' })
  })

  it('选中项已不存在时回落到默认位置', () => {
    expect(resolvePageCreationTarget('missing', folders, pages)).toEqual({})
  })
})

describe('新建文件夹落位', () => {
  const folders = [rootFolder]
  const pages = [rootPage, childPage]

  it('选中对话时紧随其后（保持既有行为）', () => {
    expect(resolveFolderCreationTarget('p2', folders, pages)).toEqual({
      parentFolderId: 'f1',
      afterNodeId: 'p2'
    })
  })

  it('选中文件夹时紧随其后', () => {
    expect(resolveFolderCreationTarget('f1', folders, pages)).toEqual({
      parentFolderId: undefined,
      afterNodeId: 'f1'
    })
  })

  it('未选中时返回空参照', () => {
    expect(resolveFolderCreationTarget(undefined, folders, pages)).toEqual({})
  })
})
