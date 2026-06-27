import React, { useState, useMemo, useCallback, memo, useRef, useEffect } from 'react'
import { Input, Empty, Tree, Dropdown, Button, Tooltip } from 'antd'
import type { TreeDataNode, TreeProps, MenuProps } from 'antd'
import {
  FolderOutlined,
  FolderOpenOutlined,
  FolderAddOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ClearOutlined,
  MoreOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import { AIGeneratePopover, type GenerateOptions } from './AIGeneratePopover'
import { useConfirmDialog } from './ConfirmDialog'
import {
  getShortcutLabel,
  getStandardDropdownProps
} from '../../utils/shortcutPresentation'
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
  clearFolder?: (id: string) => void
  toggleFolderExpanded: (id: string) => void

  // 可选配置
  onDoubleClick?: (id: string, isFolder: boolean) => void
  getItemMenuItems?: (item: TItem) => MenuProps['items']
  getFolderMenuItems?: (folder: TFolder) => MenuProps['items']
  onGenerateItemName?: (id: string, options: GenerateOptions) => Promise<void>
  onCreateItemInFolder?: (folderId: string) => void
  onCreateSubFolder?: (parentFolderId: string) => void
  createItemLabel?: string
  createFolderLabel?: string
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
  onCreateItemInFolder?: (folderId: string) => void
  createItemLabel?: string
}

// 使用泛型的 memo 组件
const TreeNodeTitleInner = <TItem extends ItemLike, TFolder extends FolderLike>({
  id,
  title,
  isHighlighted,
  treeNode,
  onDoubleClick,
  getContextMenuItems,
  onCreateItemInFolder,
  createItemLabel
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
    <Dropdown
      {...getStandardDropdownProps({ items: menuItems })}
      trigger={['contextMenu']}
      onOpenChange={handleOpenChange}
    >
      <span
        className="tree-view-title"
        onDoubleClick={() => onDoubleClick?.(id, treeNode.isFolder)}
      >
        <span className={`tree-view-title-text ${isHighlighted ? 'is-highlighted' : ''}`}>
          {title}
        </span>
        {treeNode.isFolder && onCreateItemInFolder && (
          <Tooltip title={createItemLabel || '新建项目'}>
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              className="tree-view-title-add"
              onClick={(e) => {
                e.stopPropagation()
                onCreateItemInFolder(id)
              }}
            />
          </Tooltip>
        )}
        <Dropdown
          {...getStandardDropdownProps({ items: menuItems })}
          trigger={['click']}
          onOpenChange={handleOpenChange}
        >
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

// ==================== 编辑输入框组件 ====================

interface TreeViewEditInputProps {
  id: string
  editingValue: string
  setEditingValue: (value: string) => void
  isFolder: boolean
  onSaveAndExit: () => void
  onCancelAndExit: () => void
  onGenerateItemName?: (id: string, options: GenerateOptions) => Promise<void>
}

function TreeViewEditInput({
  id,
  editingValue,
  setEditingValue,
  isFolder,
  onSaveAndExit,
  onCancelAndExit,
  onGenerateItemName
}: TreeViewEditInputProps): React.JSX.Element {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const exitModeRef = useRef<'idle' | 'save' | 'cancel'>('idle')

  const handleSaveAndExit = useCallback(() => {
    if (exitModeRef.current !== 'idle') {
      return
    }

    exitModeRef.current = 'save'
    onSaveAndExit()
  }, [onSaveAndExit])

  const handleCancelAndExit = useCallback(() => {
    if (exitModeRef.current !== 'idle') {
      return
    }

    exitModeRef.current = 'cancel'
    onCancelAndExit()
  }, [onCancelAndExit])

  const handleGenerate = async (options: GenerateOptions): Promise<void> => {
    if (onGenerateItemName) {
      await onGenerateItemName(id, options)
      handleCancelAndExit()
    }
  }

  useEffect(() => {
    const handlePointerDownOutside = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof HTMLElement)) {
        return
      }

      if (containerRef.current?.contains(target)) {
        return
      }

      if (
        target.closest('.rename-input__ai-btn') ||
        target.closest('.ai-generate-popover__content')
      ) {
        return
      }

      if (!popoverOpen) {
        handleSaveAndExit()
      }
    }

    document.addEventListener('pointerdown', handlePointerDownOutside, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside, true)
    }
  }, [handleSaveAndExit, popoverOpen])

  return (
    <div ref={containerRef} onClick={(e) => e.stopPropagation()}>
      <Input
        size="small"
        value={editingValue}
        onChange={(e) => setEditingValue(e.target.value)}
        onBlur={(e) => {
          // 如果点击的是 AI 按钮或 Popover 内容，不触发 blur 保存
          if (
            e.relatedTarget?.closest('.rename-input__ai-btn') ||
            e.relatedTarget?.closest('.ai-generate-popover__content')
          )
            return
          if (!popoverOpen) {
            handleSaveAndExit()
          }
        }}
        onPressEnter={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleSaveAndExit()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            handleCancelAndExit()
          }
        }}
        autoFocus
        suffix={
          !isFolder && onGenerateItemName ? (
            <AIGeneratePopover
              open={popoverOpen}
              onOpenChange={(open) => {
                setPopoverOpen(open)
                if (!open) {
                  handleCancelAndExit()
                }
              }}
              mode="session-title"
              onGenerate={handleGenerate}
              placement="bottomRight"
            >
              <Tooltip title="AI 生成">
                <ThunderboltOutlined
                  className="rename-input__ai-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPopoverOpen(true)
                  }}
                />
              </Tooltip>
            </AIGeneratePopover>
          ) : undefined
        }
      />
    </div>
  )
}

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
  clearFolder,
  toggleFolderExpanded,
  onDoubleClick,
  getItemMenuItems,
  getFolderMenuItems,
  onGenerateItemName,
  onCreateItemInFolder,
  onCreateSubFolder,
  createItemLabel,
  createFolderLabel,
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
  const [activeTreeKey, setActiveTreeKey] = useState<string | null>(selectedId)

  // 虚拟滚动：监听容器高度变化
  const containerRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<React.ComponentRef<typeof Tree>>(null)
  const lastSelectedIdRef = useRef<string | null>(null)
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

  useEffect(() => {
    if (selectedId) {
      setActiveTreeKey(selectedId)
    }
  }, [selectedId])

  // 展开父级文件夹并滚动到选中的节点
  useEffect(() => {
    // 只有当选中的节点真正改变时才执行
    if (selectedId && selectedId !== lastSelectedIdRef.current) {
      lastSelectedIdRef.current = selectedId

      // 检查是否是 item（非文件夹）
      const item = items.find((p) => p.id === selectedId)
      if (item && item.parentFolderId) {
        const foldersToExpand: string[] = []
        let currentFolderId: string | undefined = item.parentFolderId

        // 收集所有需要展开的父级文件夹
        while (currentFolderId) {
          foldersToExpand.push(currentFolderId)
          const folder = folders.find((f) => f.id === currentFolderId)
          currentFolderId = folder?.parentFolderId
        }

        // 展开所有父级文件夹
        foldersToExpand.forEach((folderId) => {
          const folder = folders.find((f) => f.id === folderId)
          if (folder && !folder.expanded) {
            toggleFolderExpanded(folderId)
          }
        })
      }

      // 使用虚拟化Tree的scrollTo API滚动到选中的节点
      setTimeout(() => {
        if (treeRef.current && treeRef.current.scrollTo) {
          treeRef.current.scrollTo({ key: selectedId, align: 'auto' })
        }
      }, 300) // 延迟确保文件夹展开完成
    }
  }, [selectedId, items, folders, toggleFolderExpanded])

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

  const handleStartRename = useCallback((id: string, currentName: string): void => {
    setEditingId(id)
    setEditingValue(currentName)
    setActiveTreeKey(id)
  }, [])

  const handleFinishRename = useCallback(
    (isFolder: boolean): void => {
      if (editingId && editingValue.trim()) {
        if (isFolder) {
          updateFolder(editingId, editingValue.trim())
        } else {
          updateItem(editingId, editingValue.trim())
        }
      }
      setEditingId(null)
      setEditingValue('')
    },
    [editingId, editingValue, updateFolder, updateItem]
  )

  const handleCancelRename = useCallback((): void => {
    setEditingId(null)
    setEditingValue('')
  }, [])

  const startRenameByKey = useCallback(
    (key: string | null): void => {
      if (!key) {
        return
      }

      const folder = folders.find((candidate) => candidate.id === key)
      if (folder) {
        handleStartRename(folder.id, getFolderName(folder))
        return
      }

      const item = items.find((candidate) => candidate.id === key)
      if (item) {
        handleStartRename(item.id, getItemName(item))
      }
    },
    [folders, items, getFolderName, getItemName, handleStartRename]
  )

  const focusTreeKeyboardTarget = useCallback((): void => {
    const keyboardTarget = containerRef.current?.querySelector<HTMLInputElement>(
      'input[aria-label="for screen reader"]'
    )
    keyboardTarget?.focus()
  }, [])

  const handleDeleteItem = useCallback(
    (item: TItem): void => {
      showDeleteConfirm({
        title: `删除 "${getItemName(item)}"`,
        onOk: () => {
          if (activeTreeKey === item.id) {
            setActiveTreeKey(null)
          }

          deleteItem(item.id)
          if (selectedId === item.id) onSelect(null)
        }
      })
    },
    [activeTreeKey, deleteItem, getItemName, onSelect, selectedId, showDeleteConfirm]
  )

  const handleDeleteFolder = useCallback(
    (folder: TFolder): void => {
      showDeleteConfirm({
        title: `删除文件夹 "${getFolderName(folder)}"`,
        content: '将同时删除文件夹内的所有项目',
        onOk: () => {
          if (activeTreeKey === folder.id) {
            setActiveTreeKey(null)
          }

          deleteFolder(folder.id)
          if (selectedId === folder.id) onSelect(null)
        }
      })
    },
    [activeTreeKey, deleteFolder, getFolderName, onSelect, selectedId, showDeleteConfirm]
  )

  const deleteByKey = useCallback(
    (key: string | null): void => {
      if (!key) {
        return
      }

      const folder = folders.find((candidate) => candidate.id === key)
      if (folder) {
        handleDeleteFolder(folder)
        return
      }

      const item = items.find((candidate) => candidate.id === key)
      if (item) {
        handleDeleteItem(item)
      }
    },
    [folders, handleDeleteFolder, handleDeleteItem, items]
  )

  const handleClearFolder = (folder: TFolder): void => {
    showDeleteConfirm({
      title: `清空文件夹 "${getFolderName(folder)}"`,
      content: '将删除文件夹内的所有项目，但保留文件夹',
      onOk: () => {
        clearFolder?.(folder.id)
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
    setActiveTreeKey(key)
    onSelect(key)
    if (nodeData.isFolder) toggleFolderExpanded(key)
    setTimeout(() => {
      focusTreeKeyboardTarget()
    }, 0)
  }

  const handleTreeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (editingId || checkable) {
        return
      }

      const targetKey = activeTreeKey ?? selectedId
      if (!targetKey) {
        return
      }

      if (event.key === 'F2') {
        event.preventDefault()
        event.stopPropagation()
        startRenameByKey(targetKey)
        return
      }

      if (event.key === 'Delete') {
        event.preventDefault()
        event.stopPropagation()
        deleteByKey(targetKey)
      }
    },
    [activeTreeKey, checkable, deleteByKey, editingId, selectedId, startRenameByKey]
  )

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
        ...(onCreateItemInFolder
          ? [
              {
                key: 'createItem',
                label: createItemLabel || '新建项目',
                icon: <PlusOutlined />,
                onClick: ({ domEvent }) => {
                  domEvent.stopPropagation()
                  onCreateItemInFolder(folder.id)
                }
              }
            ]
          : []),
        ...(onCreateSubFolder
          ? [
              {
                key: 'createFolder',
                label: createFolderLabel || '新建文件夹',
                icon: <FolderAddOutlined />,
                onClick: ({ domEvent }) => {
                  domEvent.stopPropagation()
                  onCreateSubFolder(folder.id)
                }
              }
            ]
          : []),
        ...(onCreateItemInFolder || onCreateSubFolder ? [{ type: 'divider' as const }] : []),
        {
          key: 'rename',
          label: '重命名',
          icon: <EditOutlined />,
          extra: getShortcutLabel('treeRename'),
          onClick: ({ domEvent }) => {
            domEvent.stopPropagation()
            startRenameByKey(folder.id)
          }
        },
        ...customItems,
        { type: 'divider' },
        ...(clearFolder
          ? [
              {
                key: 'clear',
                label: '清空文件夹',
                icon: <ClearOutlined />,
                danger: true,
                onClick: ({ domEvent }) => {
                  domEvent.stopPropagation()
                  handleClearFolder(folder)
                }
              }
            ]
          : []),
        {
          key: 'delete',
          label: '删除',
          icon: <DeleteOutlined />,
          extra: getShortcutLabel('treeDelete'),
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
          extra: getShortcutLabel('treeRename'),
          onClick: ({ domEvent }) => {
            domEvent.stopPropagation()
            startRenameByKey(item.id)
          }
        },
        ...customItems,
        { type: 'divider' },
        {
          key: 'delete',
          label: '删除',
          icon: <DeleteOutlined />,
          extra: getShortcutLabel('treeDelete'),
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
    [
      getItemMenuItems,
      getFolderMenuItems,
      getItemName,
      getFolderName,
      clearFolder,
      onCreateItemInFolder,
      onCreateSubFolder,
      createItemLabel,
      createFolderLabel
    ]
  )

  const titleRender = (node: TreeDataNode): React.ReactNode => {
    const treeNode = node as TreeNodeData<TItem, TFolder>
    const id = node.key as string
    const title = node.title as string
    const isHighlighted = id === highlightId

    if (editingId === id) {
      return (
        <TreeViewEditInput
          id={id}
          editingValue={editingValue}
          setEditingValue={setEditingValue}
          isFolder={treeNode.isFolder}
          onSaveAndExit={() => handleFinishRename(treeNode.isFolder)}
          onCancelAndExit={handleCancelRename}
          onGenerateItemName={onGenerateItemName}
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
        onCreateItemInFolder={onCreateItemInFolder}
        createItemLabel={createItemLabel}
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
          ref={treeRef}
          treeData={treeData}
          selectedKeys={selectedId ? [selectedId] : []}
          expandedKeys={expandedKeys}
          onActiveChange={(key) => setActiveTreeKey(key === null ? null : String(key))}
          onKeyDown={handleTreeKeyDown}
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
