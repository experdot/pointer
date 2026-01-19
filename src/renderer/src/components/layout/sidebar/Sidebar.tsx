import React, { useState, useCallback } from 'react'
import { usePagesStore } from '../../../stores/pagesStore'
import { useTabsStore } from '../../../stores/tabsStore'
import { useUIStore } from '../../../stores/uiStore'
import { useSearchStore } from '../../../stores/searchStore'
import ChatHistoryTree from '../sidebar_items/chat/ChatHistoryTree'
import SidebarActions from '../sidebar_items/SidebarActions'
import Settings from '../../settings/Settings'
import { GlobalSearch } from '../sidebar_items/search'
import TaskMonitor from '../sidebar_items/task/TaskMonitor'
import FavoritesPanel from '../sidebar_items/favorites/FavoritesPanel'
import { Modal, App } from 'antd'
import { ActivityBarTab } from '../activitybar/ActivityBar'
import './sidebar.css'

interface SidebarProps {
  collapsed: boolean
  activeTab: ActivityBarTab
  onSearchOpen: () => void
  onSettingsOpen: () => void
  onFindInFolder?: (folderId: string, folderName: string) => void
}

export default function Sidebar({
  collapsed,
  activeTab,
  onSearchOpen,
  onSettingsOpen,
  onFindInFolder
}: SidebarProps) {
  const {
    pages,
    folders,
    createFolder,
    createAndOpenChat,
    createAndOpenCrosstabChat,
    createAndOpenObjectChat,
    deleteMultiplePages
  } = usePagesStore()
  const { openTab } = useTabsStore()
  const {
    selectedNodeType,
    selectedNodeId,
    checkedNodeIds,
    isMultiSelectMode,
    setSelectedNode,
    clearCheckedNodes,
    enterMultiSelectMode,
    exitMultiSelectMode
  } = useUIStore()
  const { filterFolderId } = useSearchStore()
  const { modal } = App.useApp()

  const handleCreateChat = useCallback(() => {
    // 根据当前选中的节点决定新聊天的位置
    let folderId: string | undefined = undefined

    if (selectedNodeType === 'folder' && selectedNodeId) {
      // 如果选中的是文件夹，在文件夹内创建聊天
      folderId = selectedNodeId
    } else if (selectedNodeType === 'chat' && selectedNodeId) {
      // 如果选中的是聊天，找到聊天所在的文件夹（如果有的话）
      const selectedChat = pages.find((chat) => chat.id === selectedNodeId)
      folderId = selectedChat?.folderId
    }

    createAndOpenChat('新建聊天', folderId)
  }, [selectedNodeType, selectedNodeId, pages, createAndOpenChat])

  const handleCreateCrosstabChat = useCallback(() => {
    // 根据当前选中的节点决定新交叉视图聊天的位置
    let folderId: string | undefined = undefined

    if (selectedNodeType === 'folder' && selectedNodeId) {
      // 如果选中的是文件夹，在文件夹内创建聊天
      folderId = selectedNodeId
    } else if (selectedNodeType === 'chat' && selectedNodeId) {
      // 如果选中的是聊天，找到聊天所在的文件夹（如果有的话）
      const selectedChat = pages.find((chat) => chat.id === selectedNodeId)
      folderId = selectedChat?.folderId
    }

    createAndOpenCrosstabChat('新建交叉视图', folderId)
  }, [selectedNodeType, selectedNodeId, pages, createAndOpenCrosstabChat])

  const handleCreateObjectChat = useCallback(() => {
    // 根据当前选中的节点决定新对象页面的位置
    let folderId: string | undefined = undefined

    if (selectedNodeType === 'folder' && selectedNodeId) {
      // 如果选中的是文件夹，在文件夹内创建对象页面
      folderId = selectedNodeId
    } else if (selectedNodeType === 'chat' && selectedNodeId) {
      // 如果选中的是聊天，找到聊天所在的文件夹（如果有的话）
      const selectedChat = pages.find((chat) => chat.id === selectedNodeId)
      folderId = selectedChat?.folderId
    }

    createAndOpenObjectChat('新建对象页面', folderId)
  }, [selectedNodeType, selectedNodeId, pages, createAndOpenObjectChat])

  const handleCreateFolder = useCallback(() => {
    createFolder('新建文件夹')
  }, [createFolder])

  const handleChatClick = useCallback(
    (chatId: string) => {
      openTab(chatId)
      // 同时选中该聊天节点
      setSelectedNode(chatId, 'chat')
    },
    [openTab, setSelectedNode]
  )

  // 批量删除选中的聊天
  const handleBatchDelete = useCallback(() => {
    if (checkedNodeIds.length === 0) return

    // 解析选中的节点，分离聊天和文件夹
    const chatIds: string[] = []
    const folderIds: string[] = []

    checkedNodeIds.forEach((nodeKey) => {
      if (nodeKey.startsWith('chat-')) {
        chatIds.push(nodeKey.replace('chat-', ''))
      } else if (nodeKey.startsWith('folder-')) {
        folderIds.push(nodeKey.replace('folder-', ''))
      }
    })

    const totalCount = chatIds.length + folderIds.length
    const description =
      folderIds.length > 0
        ? `确定要删除选中的 ${totalCount} 项吗？包含 ${chatIds.length} 个聊天和 ${folderIds.length} 个文件夹。文件夹中的所有内容也将被删除。此操作无法撤销。`
        : `确定要删除选中的 ${chatIds.length} 个聊天吗？此操作无法撤销。`

    modal.confirm({
      title: '批量删除',
      content: description,
      okText: '确定删除',
      cancelText: '取消',
      okType: 'danger',
      onOk() {
        const { deleteFolder, deletePage } = usePagesStore.getState()

        // 递归删除文件夹及其内容
        const deleteRecursive = (folderId: string) => {
          const currentState = usePagesStore.getState()
          // 删除该文件夹下的所有聊天
          const chatsToDelete = currentState.pages.filter(
            (p) => p.folderId === folderId && p.type !== 'settings'
          )
          chatsToDelete.forEach((chat) => deletePage(chat.id))

          // 递归删除子文件夹
          const subFolders = currentState.folders.filter((f) => f.parentId === folderId)
          subFolders.forEach((subFolder) => {
            deleteRecursive(subFolder.id)
            deleteFolder(subFolder.id)
          })
        }

        // 先删除文件夹（包含递归删除内容）
        folderIds.forEach((folderId) => {
          deleteRecursive(folderId)
          deleteFolder(folderId)
        })

        // 再删除独立的聊天
        if (chatIds.length > 0) {
          deleteMultiplePages(chatIds)
        }

        // 清空选中状态并退出多选模式
        exitMultiSelectMode()
      }
    })
  }, [checkedNodeIds, deleteMultiplePages, exitMultiSelectMode, modal])

  // 检查是否有选中的项目
  const hasCheckedItems = checkedNodeIds.length > 0

  if (collapsed) {
    return null // 当折叠时不显示内容
  }

  // 根据activeTab渲染不同的内容
  const renderContent = () => {
    switch (activeTab) {
      case 'explore':
        return (
          <div className="sidebar-explore">
            <div className="sidebar-header">
              <h4>资源管理器</h4>
              <SidebarActions
                collapsed={false}
                hasCheckedItems={hasCheckedItems}
                isMultiSelectMode={isMultiSelectMode}
                onCreateChat={handleCreateChat}
                onCreateCrosstabChat={handleCreateCrosstabChat}
                onCreateObjectChat={handleCreateObjectChat}
                onCreateFolder={handleCreateFolder}
                onBatchDelete={handleBatchDelete}
                onEnterMultiSelectMode={enterMultiSelectMode}
                onExitMultiSelectMode={exitMultiSelectMode}
              />
            </div>
            <div className="sidebar-content">
              {isMultiSelectMode && (
                <div className="multi-select-indicator">
                  {hasCheckedItems ? `已选中 ${checkedNodeIds.length} 项` : '请勾选要操作的项目'}
                </div>
              )}
              <ChatHistoryTree onChatClick={handleChatClick} onFindInFolder={onFindInFolder} />
            </div>
          </div>
        )
      case 'search':
        const filterFolder = filterFolderId ? folders.find((f) => f.id === filterFolderId) : null
        return (
          <div className="sidebar-search">
            <div className="sidebar-header">
              <h4>搜索</h4>
            </div>
            <div className="sidebar-content">
              <GlobalSearch
                visible={true}
                onClose={() => {}}
                embedded={true}
                filterFolderId={filterFolderId}
                filterFolderName={filterFolder?.name || ''}
              />
            </div>
          </div>
        )
      case 'favorites':
        return (
          <div className="sidebar-favorites">
            <div className="sidebar-header">
              <h4>收藏夹</h4>
            </div>
            <div className="sidebar-content">
              <FavoritesPanel />
            </div>
          </div>
        )
      case 'tasks':
        return (
          <div className="sidebar-tasks">
            <div className="sidebar-header">
              <h4>任务监控</h4>
            </div>
            <div className="sidebar-content">
              <TaskMonitor />
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return <div className="sidebar">{renderContent()}</div>
}
