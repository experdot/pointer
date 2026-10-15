/**
 * 树节点转换
 *
 * 把 ConfigTree / 页面树数据转成 antd TreeSelect、Tree 需要的节点结构。
 * 导出面板与导入面板的差别只有「是否给已存在的 id 加冲突标记」，用 decorate 注入。
 */

import { FileTextOutlined, FolderOutlined, SettingOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'
import type { TreeDataNode } from 'antd'
import type { ConfigFolder, ConfigItemBase, ConfigTree, Folder, Page } from '@shared/domain'

/** TreeSelect 使用的节点结构（配置选择器） */
export interface ConfigSelectorNode {
  value: string
  title: string
  selectable?: boolean
  children?: ConfigSelectorNode[]
}

export type NodeKind = 'folder' | 'item'

/** 给节点标题追加装饰（例如「ID冲突」标记）；返回空表示不加 */
export type NodeDecorator = (node: { kind: NodeKind; id: string; name: string }) => ReactNode

function buildTitle(name: string, kind: NodeKind, id: string, decorate?: NodeDecorator): ReactNode {
  const extra = decorate?.({ kind, id, name })
  if (!extra) return name

  return (
    <span>
      {name}
      {extra}
    </span>
  )
}

/** 配置项与文件夹 → TreeSelect 节点 */
export function buildConfigSelectorTree<T extends ConfigItemBase>(
  items: readonly T[],
  folders: readonly ConfigFolder[]
): ConfigSelectorNode[] {
  const folderMap = new Map<string | undefined, ConfigSelectorNode[]>()
  folderMap.set(undefined, [])

  // 创建文件夹节点
  folders.forEach((folder) => {
    const parentId = folder.parentFolderId
    if (!folderMap.has(parentId)) {
      folderMap.set(parentId, [])
    }
    const node: ConfigSelectorNode = {
      value: `folder-${folder.id}`,
      title: folder.name,
      selectable: false,
      children: []
    }
    folderMap.get(parentId)!.push(node)
    folderMap.set(folder.id, node.children!)
  })

  // 归位配置项
  items.forEach((item) => {
    const parentId = item.parentFolderId
    if (!folderMap.has(parentId)) {
      folderMap.set(parentId, [])
    }
    folderMap.get(parentId)!.push({
      value: item.id,
      title: item.name
    })
  })

  return folderMap.get(undefined) ?? []
}

/** 页面与文件夹 → antd Tree 节点 */
export function buildPageTreeNodes(
  pages: readonly Page[],
  folders: readonly Folder[],
  decorate?: NodeDecorator
): TreeDataNode[] {
  const rootNodes: TreeDataNode[] = []
  const folderNodes = new Map<string, TreeDataNode>()

  folders.forEach((folder) => {
    folderNodes.set(folder.id, {
      key: `folder:${folder.id}`,
      title: buildTitle(folder.name, 'folder', folder.id, decorate),
      icon: <FolderOutlined />,
      children: []
    })
  })

  pages.forEach((page) => {
    const pageNode: TreeDataNode = {
      key: `page:${page.id}`,
      title: buildTitle(page.name || '未命名对话', 'item', page.id, decorate),
      icon: <FileTextOutlined />,
      isLeaf: true
    }

    const parentId = page.parentFolderId
    if (parentId && folderNodes.has(parentId)) {
      folderNodes.get(parentId)!.children!.push(pageNode)
    } else {
      rootNodes.push(pageNode)
    }
  })

  folders.forEach((folder) => {
    const node = folderNodes.get(folder.id)!
    const parentId = folder.parentFolderId
    if (parentId && folderNodes.has(parentId)) {
      folderNodes.get(parentId)!.children!.push(node)
    } else {
      rootNodes.push(node)
    }
  })

  return rootNodes
}

/** 配置树 → antd Tree 节点 */
export function buildConfigTreeNodes<T extends ConfigItemBase>(
  tree: ConfigTree<T>,
  getTitle: (item: T) => string,
  decorate?: NodeDecorator
): TreeDataNode[] {
  const rootNodes: TreeDataNode[] = []
  const folderNodes = new Map<string, TreeDataNode>()

  tree.folders.forEach((folder) => {
    folderNodes.set(folder.id, {
      key: `folder:${folder.id}`,
      title: buildTitle(folder.name, 'folder', folder.id, decorate),
      icon: <FolderOutlined />,
      children: []
    })
  })

  tree.items.forEach((item) => {
    const itemNode: TreeDataNode = {
      key: `item:${item.id}`,
      title: buildTitle(getTitle(item), 'item', item.id, decorate),
      icon: <SettingOutlined />,
      isLeaf: true
    }

    const parentId = item.parentFolderId
    if (parentId && folderNodes.has(parentId)) {
      folderNodes.get(parentId)!.children!.push(itemNode)
    } else {
      rootNodes.push(itemNode)
    }
  })

  tree.folders.forEach((folder) => {
    const node = folderNodes.get(folder.id)!
    const parentId = folder.parentFolderId
    if (parentId && folderNodes.has(parentId)) {
      folderNodes.get(parentId)!.children!.push(node)
    } else {
      rootNodes.push(node)
    }
  })

  return rootNodes
}
