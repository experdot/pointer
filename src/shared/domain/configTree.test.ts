import { describe, expect, it } from 'vitest'
import type { ConfigFolder, ConfigItemBase, ConfigTree } from './configTree'
import {
  addConfigFolder,
  addConfigItem,
  clearConfigFolder,
  configChildren,
  configDescendantFolderIds,
  configNamesAtLevel,
  configNextOrder,
  emptyConfigTree,
  removeConfigFolder,
  removeConfigItem,
  updateConfigFolder,
  updateConfigItem
} from './configTree'

function folder(id: string, name: string, parentFolderId?: string, order = 0): ConfigFolder {
  return { id, kind: 'folder', name, parentFolderId, order, createdAt: 1 }
}

function item(id: string, name: string, parentFolderId?: string, order = 0): ConfigItemBase {
  return { id, kind: 'item', name, parentFolderId, order, createdAt: 1 }
}

function fixture(): ConfigTree<ConfigItemBase> {
  let tree = emptyConfigTree<ConfigItemBase>()
  tree = addConfigFolder(tree, folder('f1', '主力'))
  tree = addConfigFolder(tree, folder('f2', '备用', 'f1'))
  tree = addConfigItem(tree, item('i1', 'GPT', 'f1'))
  tree = addConfigItem(tree, item('i2', 'Claude'))
  return tree
}

describe('配置树', () => {
  it('遍历与名称收集', () => {
    const tree = fixture()
    expect(configChildren(tree, undefined).map((node) => node.id)).toEqual(['f1', 'i2'])
    expect(configChildren(tree, 'f1').map((node) => node.id)).toEqual(['f2', 'i1'])
    expect(configNamesAtLevel(tree, 'f1')).toEqual(['备用', 'GPT'])
    expect(configDescendantFolderIds(tree, 'f1')).toEqual(['f2'])
    expect(configNextOrder(tree, undefined)).toBe(1)
  })

  it('更新与删除条目', () => {
    let tree = updateConfigItem(fixture(), 'i1', { name: 'GPT-5' }, 100)
    expect(tree.items.find((entry) => entry.id === 'i1')?.name).toBe('GPT-5')
    expect(tree.items.find((entry) => entry.id === 'i1')?.updatedAt).toBe(100)

    tree = removeConfigItem(tree, 'i1')
    expect(tree.items.map((entry) => entry.id)).toEqual(['i2'])
  })

  it('更新文件夹', () => {
    const tree = updateConfigFolder(fixture(), 'f1', { name: '常用' }, 100)
    expect(tree.folders.find((entry) => entry.id === 'f1')?.name).toBe('常用')
  })

  it('删除文件夹支持提升与级联两种模式', () => {
    const promoted = removeConfigFolder(fixture(), 'f1', 'promote')
    expect(promoted.folders.map((entry) => entry.id)).toEqual(['f2'])
    expect(promoted.folders[0].parentFolderId).toBeUndefined()
    expect(promoted.items.find((entry) => entry.id === 'i1')?.parentFolderId).toBeUndefined()

    const cascaded = removeConfigFolder(fixture(), 'f1', 'cascade')
    expect(cascaded.folders).toEqual([])
    expect(cascaded.items.map((entry) => entry.id)).toEqual(['i2'])
  })

  it('清空文件夹保留自身', () => {
    const tree = clearConfigFolder(fixture(), 'f1')
    expect(tree.folders.map((entry) => entry.id)).toEqual(['f1'])
    expect(tree.items.map((entry) => entry.id)).toEqual(['i2'])
  })
})

describe('损伤数据的环保护', () => {
  it('configDescendantFolderIds 在循环文件夹下也能终止', () => {
    const cyclic: ConfigTree<ConfigItemBase> = {
      folders: [folder('a', 'A', 'b'), folder('b', 'B', 'a')],
      items: []
    }
    expect([...configDescendantFolderIds(cyclic, 'a')].sort()).toEqual(['b'])
  })
})
