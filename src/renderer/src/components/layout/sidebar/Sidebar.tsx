import React, { useState, useCallback } from 'react'
import { usePagesStore } from '../../../stores/pagesStore'
import { useTabsStore } from '../../../stores/tabsStore'
import { useUIStore } from '../../../stores/uiStore'
import ChatHistoryTree from '../sidebar_items/chat/ChatHistoryTree'
import SidebarActions from '../sidebar_items/SidebarActions'
import Settings from '../../settings/Settings'
import { GlobalSearch } from '../sidebar_items/search'
import TaskMonitor from '../sidebar_items/task/TaskMonitor'
import { Modal, App } from 'antd'
import { ActivityBarTab } from '../activitybar/ActivityBar'
import './sidebar.css'

interface SidebarProps {
  collapsed: boolean
  activeTab: ActivityBarTab
  onSearchOpen: () => void
  onSettingsOpen: () => void
}

export default function Sidebar({
  collapsed,
  activeTab,
  onSearchOpen,
  onSettingsOpen
}: SidebarProps) {
  const {
    pages,
    createFolder,
    createAndOpenChat,
    createAndOpenCrosstabChat,
    createAndOpenObjectChat,
    deleteMultiplePages
  } = usePagesStore()
  const { openTab } = useTabsStore()
  const { selectedNodeType, selectedNodeId, checkedNodeIds, setSelectedNode, clearCheckedNodes } =
    useUIStore()
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
    // TODO
  }, [checkedNodeIds, clearCheckedNodes, deleteMultiplePages])

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
              <h3>资源管理器</h3>
              <SidebarActions
                collapsed={false}
                hasCheckedItems={hasCheckedItems}
                onCreateChat={handleCreateChat}
                onCreateCrosstabChat={handleCreateCrosstabChat}
                onCreateObjectChat={handleCreateObjectChat}
                onCreateFolder={handleCreateFolder}
                onBatchDelete={handleBatchDelete}
              />
            </div>
            <div className="sidebar-content">
              {hasCheckedItems && (
                <div className="multi-select-indicator">已选中 {checkedNodeIds.length} 项</div>
              )}
              <ChatHistoryTree onChatClick={handleChatClick} />
            </div>
          </div>
        )
      case 'search':
        return (
          <div className="sidebar-search">
            <div className="sidebar-header">
              <h3>搜索</h3>
            </div>
            <div className="sidebar-content">
              <GlobalSearch visible={true} onClose={() => {}} embedded={true} />
            </div>
          </div>
        )
      case 'tasks':
        return (
          <div className="sidebar-tasks">
            <div className="sidebar-header">
              <h3>任务监控</h3>
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
