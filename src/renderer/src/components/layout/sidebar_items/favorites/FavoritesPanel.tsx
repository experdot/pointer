import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { Input, Button, Tree, Empty, Space, App, Tag } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { SearchOutlined, FolderAddOutlined } from '@ant-design/icons'
import { useFavoritesStore } from '../../../../stores/favoritesStore'
import { useTabsStore } from '../../../../stores/tabsStore'
import { useUIStore } from '../../../../stores/uiStore'
import { FavoriteItem, FavoriteFolder } from '../../../../types/type'
import FavoriteTreeNode from './FavoriteTreeNode'
import './favorites-panel.css'

const { Search } = Input

export default function FavoritesPanel() {
  const { modal } = App.useApp()

  const {
    items,
    folders,
    searchQuery,
    setSearchQuery,
    searchFavorites,
    createFolder,
    deleteFolder,
    deleteFavorite,
    toggleStarFavorite,
    toggleFolderExpanded,
    getStats,
    moveFavorite
  } = useFavoritesStore()

  const { openTab } = useTabsStore()
  const { selectedFavoriteId, selectedFavoriteType, setSelectedFavorite } = useUIStore()

  const [editingNodeKey, setEditingNodeKey] = useState<string | null>(null)

  const stats = getStats()

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchQuery(value)
  }

  // 处理打开收藏项
  const handleOpenFavorite = useCallback(
    (itemId: string) => {
      // 更新选中状态
      setSelectedFavorite(itemId, 'item')

      // 创建一个新tab页来显示收藏详情
      // 使用特殊的 favorite- 前缀来标识收藏详情页
      const favoriteTabId = `favorite-${itemId}`

      // 直接打开tab，TabsArea会识别favorite-前缀并渲染收藏详情页
      openTab(favoriteTabId)
    },
    [openTab, setSelectedFavorite]
  )

  // 处理删除收藏项
  const handleDeleteFavorite = useCallback(
    (itemId: string) => {
      const item = items.find((i) => i.id === itemId)
      if (!item) return

      modal.confirm({
        title: '确认删除',
        content: `确定要删除收藏项 "${item.title}" 吗？`,
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => {
          deleteFavorite(itemId)
        }
      })
    },
    [modal, deleteFavorite, items]
  )

  // 处理删除文件夹
  const handleDeleteFolder = useCallback(
    (folderId: string) => {
      const folder = folders.find((f) => f.id === folderId)
      if (!folder) return

      modal.confirm({
        title: '删除文件夹',
        content: `确定要删除文件夹 "${folder.name}" 吗？文件夹中的所有收藏项也将被删除。`,
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => {
          deleteFolder(folderId)
        }
      })
    },
    [modal, deleteFolder, folders]
  )

  // 处理清空文件夹
  const handleClearFolder = useCallback(
    (folderId: string) => {
      const folder = folders.find((f) => f.id === folderId)
      if (!folder) return

      modal.confirm({
        title: '清空文件夹',
        content: `确定要清空文件夹 "${folder.name}" 吗？文件夹中的所有收藏项将被删除，但文件夹本身会保留。`,
        okText: '清空',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => {
          // 删除该文件夹下的所有收藏项
          const itemsToDelete = items.filter((item) => item.folderId === folderId)
          itemsToDelete.forEach((item) => deleteFavorite(item.id))
        }
      })
    },
    [modal, folders, items, deleteFavorite]
  )

  // 处理创建子文件夹
  const handleCreateSubFolder = useCallback(
    (parentId: string) => {
      createFolder({ name: '新建文件夹', parentId })
    },
    [createFolder]
  )

  // 处理保存编辑
  const handleSaveEdit = useCallback(
    (nodeId: string, nodeType: 'folder' | 'item', newValue: string) => {
      if (nodeType === 'folder') {
        const { updateFolder } = useFavoritesStore.getState()
        updateFolder(nodeId, { name: newValue })
      } else {
        const { updateFavorite } = useFavoritesStore.getState()
        updateFavorite(nodeId, { title: newValue })
      }
    },
    []
  )

  // 处理移动文件夹（支持拖拽和菜单移动）
  const handleMoveFolder = useCallback(
    (folderId: string, targetFolderId: string | undefined, newOrder?: number) => {
      const folder = folders.find((f) => f.id === folderId)
      if (!folder) return

      // 如果没有提供 newOrder，则计算新的order值，放在目标文件夹的最后
      let finalOrder = newOrder
      if (finalOrder === undefined) {
        const siblings = folders.filter((f) => f.parentId === targetFolderId)
        finalOrder =
          siblings.length > 0 ? Math.max(...siblings.map((f) => f.order || 0)) + 1000 : 1000
      }

      // 更新文件夹的 parentId 和 order
      const { updateFolder } = useFavoritesStore.getState()
      updateFolder(folderId, {
        parentId: targetFolderId,
        order: finalOrder
      })
    },
    [folders]
  )

  // 处理移动收藏项（支持拖拽和菜单移动）
  const handleMoveFavorite = useCallback(
    (itemId: string, targetFolderId: string | undefined, newOrder?: number) => {
      const item = items.find((i) => i.id === itemId)
      if (!item) return

      // 如果没有提供 newOrder，则计算新的order值，放在目标文件夹的最后
      let finalOrder = newOrder
      if (finalOrder === undefined) {
        const siblings = items.filter((i) => i.folderId === targetFolderId)
        finalOrder =
          siblings.length > 0 ? Math.max(...siblings.map((i) => i.order || 0)) + 1000 : 1000
      }

      moveFavorite(itemId, targetFolderId, finalOrder)
    },
    [items, moveFavorite]
  )

  // 构建树形数据结构
  const treeData = useMemo(() => {
    const filteredItems = searchQuery ? searchFavorites(searchQuery) : items

    // 构建文件夹树
    const buildFolderTree = (parentId?: string): DataNode[] => {
      const childFolders = folders
        .filter((f) => f.parentId === parentId)
        .sort((a, b) => (a.order || 0) - (b.order || 0))

      const result: DataNode[] = []

      // 添加文件夹节点
      childFolders.forEach((folder) => {
        const folderItems = filteredItems.filter((item) => item.folderId === folder.id)
        const nodeKey = `folder-${folder.id}`

        // 只在展开时递归构建子节点
        const children = folder.expanded
          ? [
              ...buildFolderTree(folder.id),
              ...folderItems
                .sort((a, b) => {
                  return (b.order || 0) - (a.order || 0)
                })
                .map((item) => buildItemNode(item))
            ]
          : undefined

        // 检查文件夹是否有子节点
        const hasChildren = folders.some((f) => f.parentId === folder.id) || folderItems.length > 0

        result.push({
          key: nodeKey,
          title: (
            <FavoriteTreeNode
              type="folder"
              data={folder}
              itemCount={folderItems.length}
              onDelete={() => handleDeleteFolder(folder.id)}
              onClear={() => handleClearFolder(folder.id)}
              onCreate={() => handleCreateSubFolder(folder.id)}
              onSaveEdit={handleSaveEdit}
              isEditing={editingNodeKey === nodeKey}
              onStartEdit={() => setEditingNodeKey(nodeKey)}
              onEndEdit={() => setEditingNodeKey(null)}
              onMoveTo={(targetFolderId) => handleMoveFolder(folder.id, targetFolderId)}
              allFolders={folders}
            />
          ),
          checkable: false,
          children: children,
          isLeaf: !hasChildren
        })
      })

      return result
    }

    // 构建收藏项节点
    const buildItemNode = (item: FavoriteItem): DataNode => {
      const nodeKey = `item-${item.id}`

      return {
        key: nodeKey,
        title: (
          <FavoriteTreeNode
            type="item"
            data={item}
            onDelete={() => handleDeleteFavorite(item.id)}
            onItemClick={handleOpenFavorite}
            onSaveEdit={handleSaveEdit}
            isEditing={editingNodeKey === nodeKey}
            onStartEdit={() => setEditingNodeKey(nodeKey)}
            onEndEdit={() => setEditingNodeKey(null)}
            onToggleStar={toggleStarFavorite}
            onMoveTo={(targetFolderId) => handleMoveFavorite(item.id, targetFolderId)}
            allFolders={folders}
          />
        ),
        isLeaf: true
      }
    }

    // 根级别的项目和文件夹
    const rootFolders = buildFolderTree()
    const rootItems = filteredItems
      .filter((item) => !item.folderId)
      .sort((a, b) => {
        return (b.order || 0) - (a.order || 0)
      })
      .map((item) => buildItemNode(item))

    return [...rootFolders, ...rootItems]
  }, [
    items,
    folders,
    searchQuery,
    editingNodeKey,
    handleDeleteFolder,
    handleClearFolder,
    handleCreateSubFolder,
    handleDeleteFavorite,
    handleOpenFavorite,
    handleSaveEdit,
    toggleStarFavorite,
    handleMoveFolder,
    handleMoveFavorite
  ])

  // 处理创建文件夹
  const handleCreateFolder = () => {
    createFolder({ name: '新建文件夹' })
  }

  // 处理树节点选择
  const handleSelect = useCallback(
    (keys: React.Key[], info: any) => {
      const key = keys[0] as string
      if (!key) return

      if (key.startsWith('item-')) {
        const itemId = key.substring(5)
        handleOpenFavorite(itemId)
      } else if (key.startsWith('folder-')) {
        const folderId = key.substring(7)
        setSelectedFavorite(folderId, 'folder')
        toggleFolderExpanded(folderId)
      }
    },
    [handleOpenFavorite, toggleFolderExpanded, setSelectedFavorite]
  )

  // 计算选中的节点keys
  const selectedKeys = useMemo(() => {
    if (selectedFavoriteId && selectedFavoriteType) {
      return [`${selectedFavoriteType}-${selectedFavoriteId}`]
    }
    return []
  }, [selectedFavoriteId, selectedFavoriteType])

  // 计算展开的文件夹keys
  const expandedKeys = useMemo(
    () => folders.filter((f) => f.expanded).map((f) => `folder-${f.id}`),
    [folders]
  )

  // 处理树节点展开/折叠
  const handleExpand = useCallback(
    (expandedKeys: React.Key[]) => {
      // 更新文件夹展开状态
      folders.forEach((folder) => {
        const isExpanded = expandedKeys.includes(`folder-${folder.id}`)
        if (folder.expanded !== isExpanded) {
          const { updateFolder } = useFavoritesStore.getState()
          updateFolder(folder.id, { expanded: isExpanded })
        }
      })
    },
    [folders]
  )

  // 解析节点键，获取节点类型和ID
  const parseNodeKey = useCallback(
    (key: React.Key): { type: 'folder' | 'item'; id: string } | null => {
      const keyStr = String(key)
      if (keyStr.startsWith('folder-')) {
        return { type: 'folder', id: keyStr.replace('folder-', '') }
      } else if (keyStr.startsWith('item-')) {
        return { type: 'item', id: keyStr.replace('item-', '') }
      }
      return null
    },
    []
  )

  // 处理拖拽放置事件
  const handleDrop = useCallback(
    (info: any) => {
      const dragNodeInfo = parseNodeKey(info.dragNode.key)
      const dropNodeInfo = parseNodeKey(info.node.key)

      if (!dragNodeInfo || !dropNodeInfo) return

      const { dropPosition, dropToGap } = info

      // 如果拖拽到文件夹内部（非gap位置）
      if (!dropToGap && dropNodeInfo.type === 'folder') {
        // 检查是否会形成循环引用（文件夹不能拖入自己的子文件夹中）
        if (dragNodeInfo.type === 'folder') {
          const wouldCreateCycle = (targetFolderId: string, sourceFolderId: string): boolean => {
            let current = folders.find((f) => f.id === targetFolderId)
            while (current) {
              if (current.id === sourceFolderId) return true
              current = folders.find((f) => f.id === current?.parentId)
            }
            return false
          }

          if (wouldCreateCycle(dropNodeInfo.id, dragNodeInfo.id)) {
            console.warn('Cannot move folder: would create a cycle')
            return
          }
        }

        // 获取目标文件夹
        const targetFolder = folders.find((f) => f.id === dropNodeInfo.id)

        // 获取目标文件夹的所有子节点
        const folderChildren = folders
          .filter((f) => f.parentId === dropNodeInfo.id)
          .map((f) => ({ type: 'folder' as const, id: f.id, order: f.order || 0 }))
        const folderItems = items
          .filter((item) => item.folderId === dropNodeInfo.id)
          .map((c) => ({ type: 'item' as const, id: c.id, order: c.order || 0 }))
        const allChildren = [...folderChildren, ...folderItems].sort((a, b) => a.order - b.order)

        let newOrder: number

        // 如果文件夹是展开的，放在最前面；否则放在最后
        if (targetFolder?.expanded && allChildren.length > 0) {
          newOrder = allChildren[0].order - 1000
        } else if (allChildren.length > 0) {
          newOrder = allChildren[allChildren.length - 1].order + 1000
        } else {
          newOrder = 1000
        }

        if (dragNodeInfo.type === 'folder') {
          handleMoveFolder(dragNodeInfo.id, dropNodeInfo.id, newOrder)
        } else if (dragNodeInfo.type === 'item') {
          handleMoveFavorite(dragNodeInfo.id, dropNodeInfo.id, newOrder)
        }
        return
      }

      // 处理拖拽到gap位置的情况（排序）
      if (dropToGap) {
        // 获取拖拽和目标节点信息
        const dragItem =
          dragNodeInfo.type === 'item'
            ? items.find((item) => item.id === dragNodeInfo.id)
            : folders.find((folder) => folder.id === dragNodeInfo.id)

        const dropItem =
          dropNodeInfo.type === 'item'
            ? items.find((item) => item.id === dropNodeInfo.id)
            : folders.find((folder) => folder.id === dropNodeInfo.id)

        if (!dragItem || !dropItem) return

        // 确定目标父级ID
        let targetParentId: string | undefined
        if (dropNodeInfo.type === 'folder') {
          const dropFolder = dropItem as any
          targetParentId = dropFolder.parentId
        } else {
          const dropFavorite = dropItem as any
          targetParentId = dropFavorite.folderId
        }

        // 防止文件夹拖入自己的子文件夹
        if (dragNodeInfo.type === 'folder' && targetParentId) {
          const wouldCreateCycle = (targetId: string, sourceId: string): boolean => {
            let current = folders.find((f) => f.id === targetId)
            while (current) {
              if (current.id === sourceId) return true
              current = folders.find((f) => f.id === current?.parentId)
            }
            return false
          }

          if (wouldCreateCycle(targetParentId, dragNodeInfo.id)) {
            return
          }
        }

        // 获取目标位置的所有同级节点（包括文件夹和收藏项）
        const allSiblings = [
          ...folders
            .filter((folder) => folder.parentId === targetParentId)
            .map((folder) => ({
              type: 'folder' as const,
              id: folder.id,
              order: folder.order || 0
            })),
          ...items
            .filter((item) => item.folderId === targetParentId)
            .map((item) => ({ type: 'item' as const, id: item.id, order: item.order || 0 }))
        ]
          .filter((item) => !(item.type === dragNodeInfo.type && item.id === dragNodeInfo.id))
          .sort((a, b) => a.order - b.order)

        // 找到目标节点在同级节点中的位置
        const dropIndex = allSiblings.findIndex(
          (item) => item.type === dropNodeInfo.type && item.id === dropNodeInfo.id
        )

        // 计算新的order值
        let newOrder: number = Date.now()

        if (dropIndex >= 0) {
          // Ant Design Tree的dropPosition含义：
          // - 相对于目标节点的位置索引
          // - dropPosition === -1: 拖到目标节点上方
          // - dropPosition === 1: 拖到目标节点下方
          // - dropPosition > 1: 拖到更后面的位置

          // 判断是插入到目标节点的前面还是后面
          const insertBefore =
            dropPosition === -1 || (dropPosition > 0 && dropPosition <= dropIndex)

          if (insertBefore) {
            // 插入到目标节点前面
            if (dropIndex === 0) {
              // 插入到第一个位置
              newOrder = allSiblings[0].order - 1000
            } else {
              // 插入到中间，取前一个节点和目标节点order的平均值
              const prevOrder = allSiblings[dropIndex - 1].order
              const currentOrder = allSiblings[dropIndex].order
              newOrder = (prevOrder + currentOrder) / 2
            }
          } else {
            // 插入到目标节点后面
            if (dropIndex === allSiblings.length - 1) {
              // 插入到最后一个位置
              newOrder = allSiblings[dropIndex].order + 1000
            } else {
              // 插入到中间，取目标节点和下一个节点order的平均值
              const currentOrder = allSiblings[dropIndex].order
              const nextOrder = allSiblings[dropIndex + 1].order
              newOrder = (currentOrder + nextOrder) / 2
            }
          }
        } else {
          // 如果找不到目标节点，添加到末尾
          newOrder =
            allSiblings.length > 0 ? allSiblings[allSiblings.length - 1].order + 1000 : 1000
        }

        // 根据拖拽节点类型移动节点
        if (dragNodeInfo.type === 'item') {
          handleMoveFavorite(dragNodeInfo.id, targetParentId, newOrder)
        } else if (dragNodeInfo.type === 'folder') {
          handleMoveFolder(dragNodeInfo.id, targetParentId, newOrder)
        }
      }
    },
    [parseNodeKey, folders, items, handleMoveFavorite, handleMoveFolder]
  )

  return (
    <div className="favorites-panel">
      {/* 头部：搜索和操作 */}
      <div className="favorites-header">
        <Search
          placeholder="搜索收藏"
          allowClear
          onChange={(e) => handleSearch(e.target.value)}
          prefix={<SearchOutlined />}
          className="favorites-search"
        />
        <Space className="favorites-actions">
          <Button
            type="text"
            size="small"
            icon={<FolderAddOutlined />}
            onClick={handleCreateFolder}
            title="新建文件夹"
          />
        </Space>
      </div>

      {/* 统计信息 */}
      <div className="favorites-stats">
        <Space size="small">
          <Tag>总计: {stats.totalCount}</Tag>
          <Tag>页面: {stats.pageCount}</Tag>
          <Tag>消息: {stats.messageCount}</Tag>
          <Tag>片段: {stats.textFragmentCount}</Tag>
        </Space>
      </div>

      {/* 收藏树 */}
      <div className="favorites-tree-container">
        {treeData.length === 0 ? (
          <Empty
            description="暂无收藏"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 40 }}
          />
        ) : (
          <Tree
            className="favorites-tree"
            showIcon={false}
            blockNode
            draggable={!editingNodeKey}
            checkable={false}
            expandedKeys={expandedKeys}
            selectedKeys={selectedKeys}
            treeData={treeData}
            onSelect={handleSelect}
            onExpand={handleExpand}
            onDrop={handleDrop}
            allowDrop={({ dropNode, dragNode, dropPosition }) => {
              const dragNodeInfo = parseNodeKey(dragNode.key)
              const dropNodeInfo = parseNodeKey(dropNode.key)

              // 不允许拖拽到自己身上
              if (dragNode.key === dropNode.key) {
                return false
              }

              // 不允许任何节点拖拽到收藏项节点内部（收藏项是叶子节点，不应该有子节点）
              // dropPosition === 0 表示拖拽到节点内部作为子节点
              if (dropNodeInfo?.type === 'item' && dropPosition === 0) {
                return false
              }

              return true
            }}
          />
        )}
      </div>
    </div>
  )
}
