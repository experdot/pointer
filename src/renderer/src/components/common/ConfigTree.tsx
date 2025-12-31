import React, { useState, useMemo } from 'react'
import { Input, Empty, Tree, Dropdown, Button } from 'antd'
import type { TreeDataNode, TreeProps, MenuProps } from 'antd'
import {
  PlusOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  CopyOutlined
} from '@ant-design/icons'
import { useConfirmDialog } from './ConfirmDialog'
import type { ConfigFolder, ConfigItemBase } from '../../types/type'
import './ConfigTree.css'

interface TreeNodeData<T> extends TreeDataNode {
  isFolder: boolean
  data: T | ConfigFolder
}

export interface ConfigTreeProps<T extends ConfigItemBase> {
  items: T[]
  folders: ConfigFolder[]
  expandedKeys: string[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  itemIcon: React.ReactNode
  itemNameKey: keyof T
  isItem: (item: T | ConfigFolder) => item is T
  getItemsInFolder: (folderId: string | undefined) => (T | ConfigFolder)[]
  batchUpdateItemsOrder: (items: (T | ConfigFolder)[], parentFolderId?: string) => void
  createItem: () => T
  updateItem: (id: string, updates: Partial<T>) => void
  deleteItem: (id: string) => void
  copyItem?: (item: T) => T
  createFolder: (name?: string) => ConfigFolder
  updateFolder: (id: string, updates: Partial<ConfigFolder>) => void
  deleteFolder: (id: string) => void
  toggleFolderExpanded: (id: string) => void
  defaultItemId?: string
  emptyText?: string
  addItemText?: string
}

export function ConfigTree<T extends ConfigItemBase>({
  items,
  folders,
  expandedKeys,
  selectedId,
  onSelect,
  itemIcon,
  itemNameKey,
  isItem,
  getItemsInFolder,
  batchUpdateItemsOrder,
  createItem,
  updateItem,
  deleteItem,
  copyItem,
  createFolder,
  updateFolder,
  deleteFolder,
  toggleFolderExpanded,
  defaultItemId,
  emptyText = '暂无配置',
  addItemText = '添加配置'
}: ConfigTreeProps<T>): React.JSX.Element {
  const { showDeleteConfirm } = useConfirmDialog()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')

  const rootItems = useMemo(() => {
    const rootItemsList = items.filter((item) => !item.parentFolderId)
    const rootFolders = folders.filter((f) => !f.parentFolderId)
    return [...rootFolders, ...rootItemsList].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [items, folders])

  const treeData = useMemo(() => {
    const buildFolderNode = (folder: ConfigFolder): TreeNodeData<T> => {
      const itemsInFolder = getItemsInFolder(folder.id)
      return {
        key: folder.id,
        title: folder.name,
        isFolder: true,
        data: folder,
        icon: folder.expanded ? <FolderOpenOutlined /> : <FolderOutlined />,
        children: itemsInFolder.map((item) =>
          isItem(item) ? buildItemNode(item) : buildFolderNode(item as ConfigFolder)
        )
      }
    }

    const buildItemNode = (item: T): TreeNodeData<T> => ({
      key: item.id,
      title: item[itemNameKey] as string,
      isFolder: false,
      data: item,
      icon: itemIcon,
      isLeaf: true
    })

    return rootItems.map((item) =>
      isItem(item) ? buildItemNode(item) : buildFolderNode(item as ConfigFolder)
    )
  }, [folders, items, rootItems, getItemsInFolder, isItem, itemIcon, itemNameKey])

  const handleStartRename = (id: string, currentName: string): void => {
    setEditingId(id)
    setEditingValue(currentName)
  }

  const handleFinishRename = (isFolder: boolean): void => {
    if (editingId && editingValue.trim()) {
      if (isFolder) {
        updateFolder(editingId, { name: editingValue.trim() })
      } else {
        updateItem(editingId, { [itemNameKey]: editingValue.trim() } as Partial<T>)
      }
    }
    setEditingId(null)
    setEditingValue('')
  }

  const handleDeleteItem = (item: T): void => {
    showDeleteConfirm({
      title: `删除 "${item[itemNameKey]}"`,
      onOk: () => {
        deleteItem(item.id)
        if (selectedId === item.id) onSelect(null)
      }
    })
  }

  const handleDeleteFolder = (folder: ConfigFolder): void => {
    showDeleteConfirm({
      title: `删除文件夹 "${folder.name}"`,
      content: '文件夹内的配置将移动到根目录',
      onOk: () => {
        deleteFolder(folder.id)
        if (selectedId === folder.id) onSelect(null)
      }
    })
  }

  const handleExpand: TreeProps['onExpand'] = (keys) => {
    const newExpanded = keys.filter((k) => !expandedKeys.includes(k as string))
    const newCollapsed = expandedKeys.filter((k) => !keys.includes(k))
    newExpanded.forEach((id) => toggleFolderExpanded(id as string))
    newCollapsed.forEach((id) => toggleFolderExpanded(id as string))
  }

  const getItemsAtLevel = (parentFolderId?: string, excludeId?: string): (T | ConfigFolder)[] => {
    return [
      ...items.filter((p) => p.parentFolderId === parentFolderId && p.id !== excludeId),
      ...folders.filter((f) => f.parentFolderId === parentFolderId && f.id !== excludeId)
    ].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }

  const handleDrop: TreeProps['onDrop'] = (info) => {
    const dragKey = info.dragNode.key as string
    const dropKey = info.node.key as string
    const dropNodeData = info.node as unknown as TreeNodeData<T>

    const draggedItem = items.find((p) => p.id === dragKey) || folders.find((f) => f.id === dragKey)
    if (!draggedItem) return

    if (dropNodeData?.isFolder && !info.dropToGap) {
      const itemsInFolder = getItemsAtLevel(dropKey, dragKey)
      batchUpdateItemsOrder([draggedItem, ...itemsInFolder], dropKey)
    } else if (info.dropToGap) {
      const targetItem = items.find((p) => p.id === dropKey) || folders.find((f) => f.id === dropKey)
      const targetParentFolderId = targetItem?.parentFolderId
      const sameLevelItems = getItemsAtLevel(targetParentFolderId, dragKey)
      const targetIndex = sameLevelItems.findIndex((item) => item.id === dropKey)
      const dropPos = info.dropPosition
      const targetPos = Number(info.node.pos.split('-').pop())
      const insertIndex = dropPos > targetPos ? targetIndex + 1 : targetIndex
      sameLevelItems.splice(insertIndex, 0, draggedItem)
      batchUpdateItemsOrder(sameLevelItems, targetParentFolderId)
    }
  }

  const handleAllowDrop: TreeProps['allowDrop'] = ({ dropNode, dropPosition }) => {
    const dropNodeData = dropNode as TreeNodeData<T>
    if (dropNodeData && !dropNodeData.isFolder) return dropPosition !== 0
    return true
  }

  const handleSelect: TreeProps['onSelect'] = (_selectedKeys, info) => {
    const nodeData = info.node as unknown as TreeNodeData<T>
    const key = info.node.key as string
    onSelect(key)
    if (nodeData.isFolder) toggleFolderExpanded(key)
  }

  const getContextMenuItems = (node: TreeNodeData<T>): MenuProps['items'] => {
    if (node.isFolder) {
      const folder = node.data as ConfigFolder
      return [
        {
          key: 'rename',
          label: '重命名',
          icon: <EditOutlined />,
          onClick: ({ domEvent }) => {
            domEvent.stopPropagation()
            handleStartRename(folder.id, folder.name)
          }
        },
        { type: 'divider' },
        {
          key: 'delete',
          label: '删除',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: ({ domEvent }) => {
            domEvent.stopPropagation()
            handleDeleteFolder(folder)
          }
        }
      ]
    } else {
      const item = node.data as T
      const menuItems: MenuProps['items'] = [
        {
          key: 'rename',
          label: '重命名',
          icon: <EditOutlined />,
          onClick: ({ domEvent }) => {
            domEvent.stopPropagation()
            handleStartRename(item.id, item[itemNameKey] as string)
          }
        }
      ]

      if (copyItem) {
        menuItems.push({
          key: 'copy',
          label: '复制',
          icon: <CopyOutlined />,
          onClick: ({ domEvent }) => {
            domEvent.stopPropagation()
            const newItem = copyItem(item)
            onSelect(newItem.id)
          }
        })
      }

      menuItems.push(
        { type: 'divider' },
        {
          key: 'delete',
          label: '删除',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: ({ domEvent }) => {
            domEvent.stopPropagation()
            handleDeleteItem(item)
          }
        }
      )

      return menuItems
    }
  }

  const titleRender = (node: TreeDataNode): React.ReactNode => {
    const treeNode = node as TreeNodeData<T>
    const id = node.key as string
    const title = node.title as string
    const isDefault = !treeNode.isFolder && id === defaultItemId

    if (editingId === id) {
      return (
        <Input
          size="small"
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={() => handleFinishRename(treeNode.isFolder)}
          onPressEnter={() => handleFinishRename(treeNode.isFolder)}
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      )
    }

    return (
      <Dropdown menu={{ items: getContextMenuItems(treeNode) }} trigger={['contextMenu']}>
        <span className="config-tree-title">
          <span className={`config-tree-title-text ${isDefault ? 'is-default' : ''}`}>{title}</span>
          <Dropdown menu={{ items: getContextMenuItems(treeNode) }} trigger={['click']}>
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              className="config-tree-title-more"
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        </span>
      </Dropdown>
    )
  }

  const handleCreate = (): void => {
    const item = createItem()
    onSelect(item.id)
  }

  const handleCreateFolder = (): void => {
    const folder = createFolder('新文件夹')
    onSelect(folder.id)
  }

  const isEmpty = rootItems.length === 0

  return (
    <div className="config-tree">
      <div className="config-tree-toolbar">
        <Button color="default" variant="filled" icon={<PlusOutlined />} onClick={handleCreate}>
          {addItemText}
        </Button>
        <Button type="text" icon={<FolderOutlined />} onClick={handleCreateFolder} />
      </div>
      <div className="config-tree-content">
        {isEmpty ? (
          <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Tree
            treeData={treeData}
            selectedKeys={selectedId ? [selectedId] : []}
            expandedKeys={expandedKeys}
            onSelect={handleSelect}
            onExpand={handleExpand}
            draggable
            allowDrop={handleAllowDrop}
            onDrop={handleDrop}
            showIcon
            titleRender={titleRender}
            blockNode
          />
        )}
      </div>
    </div>
  )
}
