import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Tree, Modal, App } from 'antd'
import type { DataNode, TreeProps } from 'antd/es/tree'
import type { DirectoryTreeProps } from 'antd/es/tree'
import { usePagesStore } from '../../../../stores/pagesStore'
import { useTabsStore } from '../../../../stores/tabsStore'
import { useUIStore } from '../../../../stores/uiStore'
import ChatHistoryTreeNode from './ChatHistoryTreeNode'
import './tree-styles.css'

// 拖拽事件类型定义
interface DropInfo {
  event: React.MouseEvent
  node: DataNode
  dragNode: DataNode
  dragNodesKeys: React.Key[]
  dropPosition: number
  dropToGap: boolean
}

interface ChatHistoryTreeProps {
  onChatClick: (chatId: string) => void
}

export default function ChatHistoryTree({ onChatClick }: ChatHistoryTreeProps) {
  const {
    pages,
    folders,
    movePage,
    moveFolder,
    deletePage,
    deleteFolder,
    deleteMultiplePages,
    updateFolder
  } = usePagesStore()
  const {
    selectedNodeId,
    selectedNodeType,
    checkedNodeIds,
    setSelectedNode,
    setCheckedNodes,
    clearCheckedNodes
  } = useUIStore()
  const { modal } = App.useApp()
  
  // 添加编辑状态管理
  const [editingNodeKey, setEditingNodeKey] = useState<string | null>(null)

  // 添加虚拟滚动高度状态
  const [virtualHeight, setVirtualHeight] = useState(800)
  const treeContainerRef = useRef<HTMLDivElement>(null)

  // 动态计算虚拟滚动高度
  useEffect(() => {
    const calculateHeight = () => {
      if (treeContainerRef.current) {
        const containerHeight = window.innerHeight - treeContainerRef.current.offsetTop - 100
        setVirtualHeight(Math.max(400, Math.min(containerHeight, 1200)))
      }
    }

    calculateHeight()
    window.addEventListener('resize', calculateHeight)
    return () => window.removeEventListener('resize', calculateHeight)
  }, [])

  // 解析节点键，获取节点类型和ID
  const parseNodeKey = useCallback(
    (key: React.Key): { type: 'folder' | 'chat'; id: string } | null => {
      const keyStr = String(key)
      if (keyStr.startsWith('folder-')) {
        return { type: 'folder', id: keyStr.replace('folder-', '') }
      } else if (keyStr.startsWith('chat-')) {
        return { type: 'chat', id: keyStr.replace('chat-', '') }
      }
      return null
    },
    []
  )

  // 计算当前选中的节点键
  const selectedKeys = useMemo(() => {
    if (selectedNodeId && selectedNodeType) {
      return [`${selectedNodeType}-${selectedNodeId}`]
    }
    return []
  }, [selectedNodeId, selectedNodeType])

  // 计算多选状态下的选中节点键
  const checkedKeys = useMemo(() => {
    return checkedNodeIds
  }, [checkedNodeIds])

  const handleNodeEdit = useCallback((nodeId: string, nodeType: 'folder' | 'chat') => {
    // Handle inline editing - for now just trigger the node's own edit state
    console.log('Edit node:', nodeId, nodeType)
  }, [])

  const handleSaveEdit = useCallback(
    (nodeId: string, nodeType: 'folder' | 'chat', newValue: string) => {
      if (nodeType === 'folder') {
        updateFolder(nodeId, { name: newValue })
      } else {
        const { updatePage } = usePagesStore.getState()
        updatePage(nodeId, { title: newValue })
      }
    },
    [updateFolder]
  )

  const handleNodeCreate = useCallback(
    (parentId: string | undefined, nodeType: 'folder' | 'chat') => {
      // Create a new node with default name and trigger edit
      if (nodeType === 'folder') {
        const { createFolder } = usePagesStore.getState()
        createFolder('新建文件夹', parentId)
      } else {
        // 使用全局的创建聊天逻辑，但指定特定的父文件夹
        const { createAndOpenChat } = usePagesStore.getState()
        createAndOpenChat('新建聊天', parentId)
      }
    },
    []
  )

  const handleDeleteFolder = useCallback(
    (folderId: string) => {
      modal.confirm({
        title: '删除文件夹',
        content: '确定要删除这个文件夹吗？文件夹中的聊天会移动到根目录。',
        okText: '确定',
        cancelText: '取消',
        onOk() {
          deleteFolder(folderId)
        }
      })
    },
    [deleteFolder, modal]
  )

  const handleDeleteChat = useCallback(
    (chatId: string) => {
      modal.confirm({
        title: '删除聊天',
        content: '确定要删除这个聊天吗？此操作无法撤销。',
        okText: '确定',
        cancelText: '取消',
        onOk() {
          deletePage(chatId)
        }
      })
    },
    [deletePage, modal]
  )

  // 处理拖拽放置事件
  const handleDrop = useCallback(
    (info: DropInfo) => {
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
        const targetFolder = folders.find(f => f.id === dropNodeInfo.id)
        
        // 如果文件夹是展开的，且有子节点，根据dropPosition确定插入位置
        // dropPosition为0表示放在文件夹内部作为第一个子节点
        // 否则作为最后一个子节点
        const folderChildren = folders.filter((f) => f.parentId === dropNodeInfo.id)
          .map(f => ({ type: 'folder' as const, id: f.id, order: f.order || 0 }))
        const folderChats = pages.filter((chat) => chat.folderId === dropNodeInfo.id && chat.type !== 'settings')
          .map(c => ({ type: 'chat' as const, id: c.id, order: c.order || 0 }))
        const allChildren = [...folderChildren, ...folderChats].sort((a, b) => a.order - b.order)
        
        let newOrder: number
        
        // 如果文件夹是展开的，且dropPosition为0，放在最前面
        // 注意：Ant Design Tree的dropPosition在拖入文件夹时通常为0
        if (targetFolder?.expanded && allChildren.length > 0) {
          // 总是放在最前面，因为拖入文件夹通常意味着作为第一个子节点
          newOrder = allChildren[0].order - 1000
        } else if (allChildren.length > 0) {
          // 如果文件夹未展开或dropPosition不为0，放在最后
          newOrder = allChildren[allChildren.length - 1].order + 1000
        } else {
          // 文件夹为空，使用默认值
          newOrder = 1000
        }

        if (dragNodeInfo.type === 'folder') {
          moveFolder(dragNodeInfo.id, newOrder, dropNodeInfo.id)
        } else if (dragNodeInfo.type === 'chat') {
          movePage(dragNodeInfo.id, dropNodeInfo.id, newOrder)
        }
        return
      }

      // 处理拖拽到gap位置的情况（排序）
      if (dropToGap) {
        // 获取拖拽和目标节点信息
        const dragItem =
          dragNodeInfo.type === 'chat'
            ? pages.find((chat) => chat.id === dragNodeInfo.id)
            : folders.find((folder) => folder.id === dragNodeInfo.id)

        const dropItem =
          dropNodeInfo.type === 'chat'
            ? pages.find((chat) => chat.id === dropNodeInfo.id)
            : folders.find((folder) => folder.id === dropNodeInfo.id)

        if (!dragItem || !dropItem) return

        // 确定目标父级ID
        let targetParentId: string | undefined
        if (dropNodeInfo.type === 'folder') {
          const dropFolder = dropItem as any
          targetParentId = dropFolder.parentId
        } else {
          const dropChat = dropItem as any
          targetParentId = dropChat.folderId
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

        // 获取目标位置的所有同级节点（包括文件夹和聊天）
        const allSiblings = [
          ...folders
            .filter((folder) => folder.parentId === targetParentId)
            .map((folder) => ({ type: 'folder' as const, id: folder.id, order: folder.order || 0 })),
          ...pages
            .filter((chat) => chat.folderId === targetParentId && chat.type !== 'settings')
            .map((chat) => ({ type: 'chat' as const, id: chat.id, order: chat.order || 0 }))
        ]
          .filter((item) => !(item.type === dragNodeInfo.type && item.id === dragNodeInfo.id)) // 排除拖拽节点自身
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
          const insertBefore = dropPosition === -1 || (dropPosition > 0 && dropPosition <= dropIndex)
          
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
          newOrder = allSiblings.length > 0 ? allSiblings[allSiblings.length - 1].order + 1000 : 1000
        }

        // 根据拖拽节点类型移动节点
        if (dragNodeInfo.type === 'chat') {
          movePage(dragNodeInfo.id, targetParentId, newOrder)
        } else if (dragNodeInfo.type === 'folder') {
          moveFolder(dragNodeInfo.id, newOrder, targetParentId)
        }
      }
    },
    [parseNodeKey, folders, pages, movePage, moveFolder]
  )

  // 创建节点映射缓存
  const nodeCache = useMemo(() => new Map<string, DataNode>(), [])

  // 递归构建文件夹树 - 优化版本
  const buildFolderTree = useCallback(
    (parentId?: string): DataNode[] => {
      const cacheKey = parentId || 'root'

      // 获取指定父级下的文件夹
      const childFolders = folders
        .filter((folder) => folder.parentId === parentId)
        .map(folder => ({
          type: 'folder' as const,
          data: folder,
          order: folder.order || 0
        }))

      // 获取指定父级下的聊天（过滤掉设置页面）
      const chats = pages
        .filter((chat) => chat.folderId === parentId && chat.type !== 'settings')
        .map(chat => ({
          type: 'chat' as const,
          data: chat,
          order: chat.order || 0
        }))

      // 合并文件夹和聊天，按order排序
      const allItems = [...childFolders, ...chats].sort((a, b) => a.order - b.order)

      // 构建树节点
      const result: DataNode[] = allItems.map(item => {
        if (item.type === 'folder') {
          const folder = item.data as typeof folders[0]
          const nodeKey = `folder-${folder.id}`

          // 检查文件夹是否有子节点
          const hasChildren = folders.some(f => f.parentId === folder.id) ||
                             pages.some(p => p.folderId === folder.id && p.type !== 'settings')

          // 只在展开时递归构建子节点
          const folderChildren = folder.expanded ? buildFolderTree(folder.id) : undefined

          const node: DataNode = {
            key: nodeKey,
            title: (
              <ChatHistoryTreeNode
                type="folder"
                data={folder}
                onEdit={() => handleNodeEdit(folder.id, 'folder')}
                onDelete={() => handleDeleteFolder(folder.id)}
                onCreate={(type) => handleNodeCreate(folder.id, type)}
                onSaveEdit={handleSaveEdit}
                isEditing={editingNodeKey === nodeKey}
                onStartEdit={() => setEditingNodeKey(nodeKey)}
                onEndEdit={() => setEditingNodeKey(null)}
              />
            ),
            checkable: false,
            children: folderChildren,
            isLeaf: !hasChildren
          }

          nodeCache.set(nodeKey, node)
          return node
        } else {
          const chat = item.data as typeof pages[0]
          const nodeKey = `chat-${chat.id}`

          const node: DataNode = {
            key: nodeKey,
            title: (
              <ChatHistoryTreeNode
                type="chat"
                data={chat}
                onEdit={() => handleNodeEdit(chat.id, 'chat')}
                onDelete={() => handleDeleteChat(chat.id)}
                onChatClick={onChatClick}
                onSaveEdit={handleSaveEdit}
                isEditing={editingNodeKey === nodeKey}
                onStartEdit={() => setEditingNodeKey(nodeKey)}
                onEndEdit={() => setEditingNodeKey(null)}
              />
            ),
            isLeaf: true
          }

          nodeCache.set(nodeKey, node)
          return node
        }
      })

      return result
    },
    [
      folders,
      pages,
      onChatClick,
      editingNodeKey,
      nodeCache,
      handleNodeEdit,
      handleDeleteFolder,
      handleDeleteChat,
      handleNodeCreate,
      handleSaveEdit
    ]
  )

  // 使用 useMemo 缓存树数据，只在关键数据变化时重新构建
  const treeData = useMemo(() => {
    // 清空缓存以确保数据一致性
    nodeCache.clear()
    return buildFolderTree()
  }, [
    // 只在数据结构发生实质性变化时重新构建
    folders.map(f => `${f.id}-${f.name}-${f.parentId}-${f.order}-${f.expanded}`).join(','),
    pages.map(p => `${p.id}-${p.title}-${p.folderId}-${p.order}`).join(','),
    editingNodeKey
  ])

  // Build tree data - 保留兼容性
  const buildTreeData = useCallback((): DataNode[] => {
    return treeData
  }, [treeData])

  const handleTreeSelect = useCallback(
    (
      selectedKeys: React.Key[],
      info: { selected: boolean; selectedNodes: any[]; node: any; event: 'select' }
    ) => {
      const key = selectedKeys[0]
      const event = info.event as any

      if (key && typeof key === 'string') {
        // 处理 ctrl+shift 多选
        if (event?.ctrlKey || event?.metaKey) {
          // Ctrl+点击：切换选中状态
          const currentChecked = checkedNodeIds.includes(key)
          const newCheckedKeys = currentChecked
            ? checkedNodeIds.filter((k) => k !== key)
            : [...checkedNodeIds, key]

          setCheckedNodes(newCheckedKeys)
        } else if (event?.shiftKey && selectedNodeId) {
          // Shift+点击：范围选择
          const treeData = buildTreeData()
          const flattenNodes = (nodes: DataNode[], result: string[] = []): string[] => {
            nodes.forEach((node) => {
              result.push(node.key as string)
              if (node.children) {
                flattenNodes(node.children, result)
              }
            })
            return result
          }

          const allKeys = flattenNodes(treeData)
          const currentSelectedKey = `${selectedNodeType}-${selectedNodeId}`
          const startIndex = allKeys.indexOf(currentSelectedKey)
          const endIndex = allKeys.indexOf(key)

          if (startIndex !== -1 && endIndex !== -1) {
            const rangeStart = Math.min(startIndex, endIndex)
            const rangeEnd = Math.max(startIndex, endIndex)
            const rangeKeys = allKeys.slice(rangeStart, rangeEnd + 1)

            setCheckedNodes(rangeKeys)
          }
        } else {
          // 普通点击：清空多选，设置单选
          clearCheckedNodes()

          if (key.startsWith('chat-')) {
            const chatId = key.replace('chat-', '')
            setSelectedNode(chatId, 'chat')
            onChatClick(chatId)
          } else if (key.startsWith('folder-')) {
            const folderId = key.replace('folder-', '')
            setSelectedNode(folderId, 'folder')
            const folder = folders.find((f) => f.id === folderId)
            if (folder) {
              updateFolder(folderId, { expanded: !folder.expanded })
            }
          }
        }
      } else if (selectedKeys.length === 0) {
        // 如果没有选中任何节点，清除选中状态
        setSelectedNode(null, null)
        clearCheckedNodes()
      }
    },
    [
      onChatClick,
      folders,
      selectedNodeId,
      selectedNodeType,
      checkedNodeIds,
      setSelectedNode,
      setCheckedNodes,
      clearCheckedNodes,
      updateFolder,
      buildTreeData
    ]
  )

  const expandedKeys = useMemo(
    () => folders.filter((f) => f.expanded).map((f) => `folder-${f.id}`),
    [folders]
  )

  return (
    <div ref={treeContainerRef} style={{ height: '100%' }}>
      <Tree
        className="chat-history-tree"
        showIcon
        blockNode
        draggable={!editingNodeKey}
        checkable={false}
        multiple
        virtual
        height={virtualHeight}
        expandedKeys={expandedKeys}
        selectedKeys={checkedNodeIds.length > 0 ? checkedKeys : selectedKeys}
        treeData={treeData}
        onSelect={handleTreeSelect}
        onDrop={handleDrop}
      allowDrop={({ dropNode, dragNode, dropPosition }) => {
        const dragNodeInfo = parseNodeKey(dragNode.key)
        const dropNodeInfo = parseNodeKey(dropNode.key)

        // 不允许拖拽到自己身上
        if (dragNode.key === dropNode.key) {
          return false
        }

        // 不允许任何节点拖拽到聊天节点内部（聊天是叶子节点，不应该有子节点）
        // dropPosition === 0 表示拖拽到节点内部作为子节点
        if (dropNodeInfo?.type === 'chat' && dropPosition === 0) {
          return false
        }

        return true
      }}
      onExpand={useCallback((expandedKeys: React.Key[]) => {
        // Update folder expanded state
        folders.forEach((folder) => {
          const isExpanded = expandedKeys.includes(`folder-${folder.id}`)
          if (folder.expanded !== isExpanded) {
            updateFolder(folder.id, { expanded: isExpanded })
          }
        })
      }, [folders, updateFolder])}
      />
    </div>
  )
}
