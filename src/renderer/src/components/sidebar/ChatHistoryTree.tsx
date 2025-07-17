import React, { useState, useCallback, useMemo } from 'react'
import { Tree, Modal, App } from 'antd'
import type { DataNode, TreeProps } from 'antd/es/tree'
import { usePagesStore } from '../../stores/pagesStore'
import { useTabsStore } from '../../stores/tabsStore'
import { useUIStore } from '../../stores/uiStore'
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

          // 获取目标文件夹下的最大order值（包括文件夹和聊天）
          const folderChildren = folders.filter((f) => f.parentId === dropNodeInfo.id)
          const folderChats = pages.filter((chat) => chat.folderId === dropNodeInfo.id)
          const allOrders = [
            ...folderChildren.map((f) => f.order || 0),
            ...folderChats.map((c) => c.order || 0)
          ]
          const maxOrder = allOrders.length > 0 ? Math.max(...allOrders) : 0

          moveFolder(dragNodeInfo.id, maxOrder + 1000, dropNodeInfo.id)
        } else if (dragNodeInfo.type === 'chat') {
          // 将聊天移动到文件夹内，获取该文件夹下聊天的最大order值
          const folderChats = pages.filter((chat) => chat.folderId === dropNodeInfo.id)
          const maxOrder =
            folderChats.length > 0 ? Math.max(...folderChats.map((chat) => chat.order || 0)) : 0

          movePage(dragNodeInfo.id, dropNodeInfo.id, maxOrder + 1000)
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

        // 计算新的order值
        let newOrder: number = Date.now()

        // 根据节点类型计算order
        if (dragNodeInfo.type === 'chat') {
          const siblings = pages
            .filter((chat) => chat.folderId === targetParentId && chat.id !== dragNodeInfo.id)
            .sort((a, b) => (a.order || 0) - (b.order || 0))

          const dropIndex = siblings.findIndex((item) => item.id === dropNodeInfo.id)
          if (dropIndex >= 0) {
            if (dropPosition <= dropIndex) {
              // 拖拽到前面
              newOrder =
                dropIndex === 0
                  ? (siblings[0]?.order || 0) - 1000
                  : ((siblings[dropIndex - 1]?.order || 0) + (siblings[dropIndex]?.order || 0)) / 2
            } else {
              // 拖拽到后面
              newOrder =
                dropIndex === siblings.length - 1
                  ? (siblings[dropIndex]?.order || 0) + 1000
                  : ((siblings[dropIndex]?.order || 0) + (siblings[dropIndex + 1]?.order || 0)) / 2
            }
          }

          movePage(dragNodeInfo.id, targetParentId, newOrder)
        } else if (dragNodeInfo.type === 'folder') {
          const siblings = folders
            .filter((folder) => folder.parentId === targetParentId && folder.id !== dragNodeInfo.id)
            .sort((a, b) => (a.order || 0) - (b.order || 0))

          const dropIndex = siblings.findIndex((item) => item.id === dropNodeInfo.id)
          if (dropIndex >= 0) {
            if (dropPosition <= dropIndex) {
              // 拖拽到前面
              newOrder =
                dropIndex === 0
                  ? (siblings[0]?.order || 0) - 1000
                  : ((siblings[dropIndex - 1]?.order || 0) + (siblings[dropIndex]?.order || 0)) / 2
            } else {
              // 拖拽到后面
              newOrder =
                dropIndex === siblings.length - 1
                  ? (siblings[dropIndex]?.order || 0) + 1000
                  : ((siblings[dropIndex]?.order || 0) + (siblings[dropIndex + 1]?.order || 0)) / 2
            }
          }

          moveFolder(dragNodeInfo.id, newOrder, targetParentId)
        }
      }
    },
    [parseNodeKey, folders, pages, movePage, moveFolder]
  )

  // 递归构建文件夹树
  const buildFolderTree = useCallback(
    (parentId?: string): DataNode[] => {
      const result: DataNode[] = []

      // 获取指定父级下的文件夹
      const childFolders = folders
        .filter((folder) => folder.parentId === parentId)
        .sort((a, b) => (a.order || 0) - (b.order || 0))

      // 获取指定父级下的聊天
      const chats = pages
        .filter((chat) => chat.folderId === parentId)
        .sort((a, b) => (a.order || 0) - (b.order || 0))

      // 添加文件夹
      childFolders.forEach((folder) => {
        const folderChildren = buildFolderTree(folder.id)

        result.push({
          key: `folder-${folder.id}`,
          title: (
            <ChatHistoryTreeNode
              type="folder"
              data={folder}
              onEdit={() => handleNodeEdit(folder.id, 'folder')}
              onDelete={() => handleDeleteFolder(folder.id)}
              onCreate={(type) => handleNodeCreate(folder.id, type)}
              onSaveEdit={handleSaveEdit}
            />
          ),
          checkable: false,
          children: folderChildren
        })
      })

      // 添加聊天
      chats.forEach((chat) => {
        result.push({
          key: `chat-${chat.id}`,
          title: (
            <ChatHistoryTreeNode
              type="chat"
              data={chat}
              onEdit={() => handleNodeEdit(chat.id, 'chat')}
              onDelete={() => handleDeleteChat(chat.id)}
              onChatClick={onChatClick}
              onSaveEdit={handleSaveEdit}
            />
          ),
          isLeaf: true
        })
      })

      return result
    },
    [
      folders,
      pages,
      handleNodeEdit,
      handleDeleteFolder,
      handleDeleteChat,
      handleNodeCreate,
      handleSaveEdit,
      onChatClick
    ]
  )

  // Build tree data
  const buildTreeData = useCallback((): DataNode[] => {
    return buildFolderTree() // 从根级别开始构建
  }, [buildFolderTree])

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

  const expandedKeys = folders.filter((f) => f.expanded).map((f) => `folder-${f.id}`)

  return (
    <Tree
      className="chat-history-tree"
      showIcon
      blockNode
      draggable
      checkable={false}
      multiple
      expandedKeys={expandedKeys}
      selectedKeys={checkedNodeIds.length > 0 ? checkedKeys : selectedKeys}
      treeData={buildTreeData()}
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
      onExpand={(expandedKeys) => {
        // Update folder expanded state
        folders.forEach((folder) => {
          const isExpanded = expandedKeys.includes(`folder-${folder.id}`)
          if (folder.expanded !== isExpanded) {
            updateFolder(folder.id, { expanded: isExpanded })
          }
        })
      }}
    />
  )
}
