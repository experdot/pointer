import React, { useState, useMemo, useCallback, memo, useRef, useEffect } from 'react'
import { Input, Empty, Tree, Dropdown, Button } from 'antd'
import type { TreeDataNode, TreeProps, MenuProps } from 'antd'
import {
  FolderOutlined,
  FolderOpenOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined
} from '@ant-design/icons'
import { useConfirmDialog } from './ConfirmDialog'
import './TreeView.css'

// ==================== 类型定义 ====================

interface TreeNodeData<TItem, TFolder> extends TreeDataNode {
  isFolder: boolean
  data: TItem | TFolder
}

interface FolderLike {
  id: string
  name: string
  parentFolderId?: string
  expanded?: boolean
  order?: number
}

interface ItemLike {
  id: string
  parentFolderId?: string
  order?: number
}

export interface TreeViewProps<TItem extends ItemLike, TFolder extends FolderLike> {
  items: TItem[]
  folders: TFolder[]
  selectedId: string | null
  onSelect: (id: string | null) => void

  // 渲染配置
  itemIcon: React.ReactNode
  getItemName: (item: TItem) => string
  getFolderName?: (folder: TFolder) => string
  isItem: (item: TItem | TFolder) => item is TItem

  // 操作回调
  batchUpdateItemsOrder: (items: (TItem | TFolder)[], parentFolderId?: string) => void
  updateItem: (id: string, name: string) => void
  deleteItem: (id: string) => void
  updateFolder: (id: string, name: string) => void
  deleteFolder: (id: string) => void
  toggleFolderExpanded: (id: string) => void

  // 可选配置
  onDoubleClick?: (id: string, isFolder: boolean) => void
  getItemMenuItems?: (item: TItem) => MenuProps['items']
  getFolderMenuItems?: (folder: TFolder) => MenuProps['items']
  highlightId?: string
  emptyText?: string
  className?: string

  // 多选模式
  checkable?: boolean
  checkedKeys?: string[]
  onCheck?: (keys: string[]) => void
}

// ==================== 辅助函数 ====================

function getItemsInFolder<TItem extends ItemLike, TFolder extends FolderLike>(
  items: TItem[],
  folders: TFolder[],
  folderId: string | undefined
): (TItem | TFolder)[] {
  const itemsInFolder = items.filter((item) => item.parentFolderId === folderId)
  const subFolders = folders.filter((f) => f.parentFolderId === folderId)
  return [...subFolders, ...itemsInFolder].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

function getRootItems<TItem extends ItemLike, TFolder extends FolderLike>(
  items: TItem[],
  folders: TFolder[]
): (TItem | TFolder)[] {
  const rootItems = items.filter((item) => !item.parentFolderId)
  const rootFolders = folders.filter((f) => !f.parentFolderId)
  return [...rootFolders, ...rootItems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

// ==================== 节点标题组件（使用 memo 优化） ====================

interface TreeNodeTitleProps<TItem extends ItemLike, TFolder extends FolderLike> {
  id: string
  title: string
  isHighlighted: boolean
  treeNode: TreeNodeData<TItem, TFolder>
  onDoubleClick?: (id: string, isFolder: boolean) => void
  getContextMenuItems: (node: TreeNodeData<TItem, TFolder>) => MenuProps['items']
}

// 使用泛型的 memo 组件
const TreeNodeTitleInner = <TItem extends ItemLike, TFolder extends FolderLike>({
  id,
  title,
  isHighlighted,
  treeNode,
  onDoubleClick,
  getContextMenuItems
}: TreeNodeTitleProps<TItem, TFolder>): React.JSX.Element => {
  // 延迟计算菜单项 - 只在 Dropdown 展开时才计算
  const [menuItems, setMenuItems] = useState<MenuProps['items']>(undefined)

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open && !menuItems) {
        setMenuItems(getContextMenuItems(treeNode))
      }
    },
    [getContextMenuItems, treeNode, menuItems]
  )

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']} onOpenChange={handleOpenChange}>
      <span
        className="tree-view-title"
        onDoubleClick={() => onDoubleClick?.(id, treeNode.isFolder)}
      >
        <span className={`tree-view-title-text ${isHighlighted ? 'is-highlighted' : ''}`}>
          {title}
        </span>
        <Dropdown menu={{ items: menuItems }} trigger={['click']} onOpenChange={handleOpenChange}>
          <Button
            type="text"
            size="small"
            icon={<MoreOutlined />}
            className="tree-view-title-more"
            onClick={(e) => e.stopPropagation()}
          />
        </Dropdown>
      </span>
    </Dropdown>
  )
}

// memo 包装，只有 props 变化时才重新渲染
const TreeNodeTitle = memo(TreeNodeTitleInner) as typeof TreeNodeTitleInner

// ==================== 组件实现 ====================

export function TreeView<TItem extends ItemLike, TFolder extends FolderLike>({
  items,
  folders,
  selectedId,
  onSelect,
  itemIcon,
  getItemName,
  getFolderName = (f) => f.name,
  isItem,
  batchUpdateItemsOrder,
  updateItem,
  deleteItem,
  updateFolder,
  deleteFolder,
  toggleFolderExpanded,
  onDoubleClick,
  getItemMenuItems,
  getFolderMenuItems,
  highlightId,
  emptyText = '暂无数据',
  className = '',
  checkable = false,
  checkedKeys = [],
  onCheck
}: TreeViewProps<TItem, TFolder>): React.JSX.Element {
  const { showDeleteConfirm } = useConfirmDialog()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')

  // 虚拟滚动：监听容器高度变化
  const containerRef = useRef<HTMLDivElement>(null)
  const [treeHeight, setTreeHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateHeight = (): void => {
      const height = container.clientHeight
      setTreeHeight(height > 0 ? height : undefined)
    }

    // 初始化高度
    updateHeight()

    // 监听容器大小变化
    const resizeObserver = new ResizeObserver(updateHeight)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  const expandedKeys = useMemo(() => folders.filter((f) => f.expanded).map((f) => f.id), [folders])

  const rootItems = useMemo(() => getRootItems(items, folders), [items, folders])

  const treeData = useMemo(() => {
    const buildFolderNode = (folder: TFolder): TreeNodeData<TItem, TFolder> => {
      const children = getItemsInFolder(items, folders, folder.id)
      return {
        key: folder.id,
        title: getFolderName(folder),
        isFolder: true,
        data: folder,
        icon: folder.expanded ? <FolderOpenOutlined /> : <FolderOutlined />,
        children: children.map((child) =>
          isItem(child) ? buildItemNode(child) : buildFolderNode(child as TFolder)
        )
      }
    }

    const buildItemNode = (item: TItem): TreeNodeData<TItem, TFolder> => ({
      key: item.id,
      title: getItemName(item),
      isFolder: false,
      data: item,
      icon: itemIcon,
      isLeaf: true
    })

    return rootItems.map((item) =>
      isItem(item) ? buildItemNode(item) : buildFolderNode(item as TFolder)
    )
  }, [folders, items, rootItems, isItem, itemIcon, getItemName, getFolderName])

  // ==================== 事件处理 ====================

  const handleStartRename = (id: string, currentName: string): void => {
    setEditingId(id)
    setEditingValue(currentName)
  }

  const handleFinishRename = (isFolder: boolean): void => {
    if (editingId && editingValue.trim()) {
      if (isFolder) {
        updateFolder(editingId, editingValue.trim())
      } else {
        updateItem(editingId, editingValue.trim())
      }
    }
    setEditingId(null)
    setEditingValue('')
  }

  const handleDeleteItem = (item: TItem): void => {
    showDeleteConfirm({
      title: `删除 "${getItemName(item)}"`,
      onOk: () => {
        deleteItem(item.id)
        if (selectedId === item.id) onSelect(null)
      }
    })
  }

  const handleDeleteFolder = (folder: TFolder): void => {
    showDeleteConfirm({
      title: `删除文件夹 "${getFolderName(folder)}"`,
      content: '文件夹内的项目将移动到根目录',
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

  const handleSelect: TreeProps['onSelect'] = (_selectedKeys, info) => {
    const nodeData = info.node as unknown as TreeNodeData<TItem, TFolder>
    const key = info.node.key as string
    onSelect(key)
    if (nodeData.isFolder) toggleFolderExpanded(key)
  }

  // ==================== 拖拽处理 ====================

  const getItemsAtLevel = (parentFolderId?: string, excludeId?: string): (TItem | TFolder)[] => {
    return [
      ...items.filter((p) => p.parentFolderId === parentFolderId && p.id !== excludeId),
      ...folders.filter((f) => f.parentFolderId === parentFolderId && f.id !== excludeId)
    ].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }

  const handleDrop: TreeProps['onDrop'] = (info) => {
    const dragKey = info.dragNode.key as string
    const dropKey = info.node.key as string
    const dropNodeData = info.node as unknown as TreeNodeData<TItem, TFolder>

    const draggedItem = items.find((p) => p.id === dragKey) || folders.find((f) => f.id === dragKey)
    if (!draggedItem) return

    if (dropNodeData?.isFolder && !info.dropToGap) {
      const itemsInFolder = getItemsAtLevel(dropKey, dragKey)
      batchUpdateItemsOrder([draggedItem, ...itemsInFolder], dropKey)
    } else if (info.dropToGap) {
      const targetItem =
        items.find((p) => p.id === dropKey) || folders.find((f) => f.id === dropKey)
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
    const dropNodeData = dropNode as TreeNodeData<TItem, TFolder>
    if (dropNodeData && !dropNodeData.isFolder) return dropPosition !== 0
    return true
  }

  // ==================== 右键菜单 ====================

  const getContextMenuItems = (node: TreeNodeData<TItem, TFolder>): MenuProps['items'] => {
    if (node.isFolder) {
      const folder = node.data as TFolder
      const customItems = getFolderMenuItems?.(folder) || []
      return [
        {
          key: 'rename',
          label: '重命名',
          icon: <EditOutlined />,
          onClick: ({ domEvent }) => {
            domEvent.stopPropagation()
            handleStartRename(folder.id, getFolderName(folder))
          }
        },
        ...customItems,
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
      const item = node.data as TItem
      const customItems = getItemMenuItems?.(item) || []
      return [
        {
          key: 'rename',
          label: '重命名',
          icon: <EditOutlined />,
          onClick: ({ domEvent }) => {
            domEvent.stopPropagation()
            handleStartRename(item.id, getItemName(item))
          }
        },
        ...customItems,
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
      ]
    }
  }

  // ==================== 标题渲染 ====================

  // 使用 useCallback 缓存 getContextMenuItems，避免每次渲染时创建新函数
  const memoizedGetContextMenuItems = useCallback(
    (node: TreeNodeData<TItem, TFolder>) => getContextMenuItems(node),
    // 只依赖外部传入的 props，不依赖内部函数
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getItemMenuItems, getFolderMenuItems, getItemName, getFolderName]
  )

  const titleRender = (node: TreeDataNode): React.ReactNode => {
    const treeNode = node as TreeNodeData<TItem, TFolder>
    const id = node.key as string
    const title = node.title as string
    const isHighlighted = id === highlightId

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
      <TreeNodeTitle
        id={id}
        title={title}
        isHighlighted={isHighlighted}
        treeNode={treeNode}
        onDoubleClick={onDoubleClick}
        getContextMenuItems={memoizedGetContextMenuItems}
      />
    )
  }

  const isEmpty = rootItems.length === 0

  return (
    <div ref={containerRef} className={`tree-view-content ${className}`}>
      {isEmpty ? (
        <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Tree
          treeData={treeData}
          selectedKeys={selectedId ? [selectedId] : []}
          expandedKeys={expandedKeys}
          onSelect={handleSelect}
          onExpand={handleExpand}
          draggable={!checkable}
          allowDrop={handleAllowDrop}
          onDrop={handleDrop}
          showIcon
          titleRender={titleRender}
          blockNode
          checkable={checkable}
          checkedKeys={checkedKeys}
          onCheck={(keys) => onCheck?.(keys as string[])}
          height={treeHeight}
          virtual={treeHeight !== undefined}
        />
      )}
    </div>
  )
}
