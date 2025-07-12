import React, { useState, useCallback } from 'react'
import { useAppContext } from '../store/AppContext'
import ChatHistoryTree from './sidebar/ChatHistoryTree'
import SidebarActions from './sidebar/SidebarActions'
import Settings from './Settings'
import GlobalSearch from './sidebar/GlobalSearch'
import TaskMonitor from './sidebar/TaskMonitor'
import { Modal, App } from 'antd'
import { ActivityBarTab } from './ActivityBar'

interface SidebarProps {
  collapsed: boolean
  activeTab: ActivityBarTab
  onSearchOpen: () => void
  onSettingsOpen: () => void
}

export default function Sidebar({ collapsed, activeTab, onSearchOpen, onSettingsOpen }: SidebarProps) {
  const { state, dispatch } = useAppContext()
  const { modal } = App.useApp()

  const handleCreateChat = useCallback(() => {
    // 根据当前选中的节点决定新聊天的位置
    let folderId: string | undefined = undefined

    if (state.selectedNodeType === 'folder' && state.selectedNodeId) {
      // 如果选中的是文件夹，在文件夹内创建聊天
      folderId = state.selectedNodeId
    } else if (state.selectedNodeType === 'chat' && state.selectedNodeId) {
      // 如果选中的是聊天，找到聊天所在的文件夹（如果有的话）
      const selectedChat = state.pages.find((chat) => chat.id === state.selectedNodeId)
      folderId = selectedChat?.folderId
    }

    dispatch({
      type: 'CREATE_AND_OPEN_CHAT',
      payload: { title: '新建聊天', folderId }
    })
  }, [dispatch, state.selectedNodeType, state.selectedNodeId, state.pages])

  const handleCreateCrosstabChat = useCallback(() => {
    // 根据当前选中的节点决定新交叉视图聊天的位置
    let folderId: string | undefined = undefined

    if (state.selectedNodeType === 'folder' && state.selectedNodeId) {
      // 如果选中的是文件夹，在文件夹内创建聊天
      folderId = state.selectedNodeId
    } else if (state.selectedNodeType === 'chat' && state.selectedNodeId) {
      // 如果选中的是聊天，找到聊天所在的文件夹（如果有的话）
      const selectedChat = state.pages.find((chat) => chat.id === state.selectedNodeId)
      folderId = selectedChat?.folderId
    }

    dispatch({
      type: 'CREATE_AND_OPEN_CROSSTAB_CHAT',
      payload: { title: '新建交叉视图', folderId }
    })
  }, [dispatch, state.selectedNodeType, state.selectedNodeId, state.pages])

  const handleCreateObjectChat = useCallback(() => {
    // 根据当前选中的节点决定新对象页面的位置
    let folderId: string | undefined = undefined

    if (state.selectedNodeType === 'folder' && state.selectedNodeId) {
      // 如果选中的是文件夹，在文件夹内创建对象页面
      folderId = state.selectedNodeId
    } else if (state.selectedNodeType === 'chat' && state.selectedNodeId) {
      // 如果选中的是聊天，找到聊天所在的文件夹（如果有的话）
      const selectedChat = state.pages.find((chat) => chat.id === state.selectedNodeId)
      folderId = selectedChat?.folderId
    }

    dispatch({
      type: 'CREATE_AND_OPEN_OBJECT_CHAT',
      payload: { title: '新建对象页面', folderId }
    })
  }, [dispatch, state.selectedNodeType, state.selectedNodeId, state.pages])

  const handleCreateFolder = useCallback(() => {
    dispatch({
      type: 'CREATE_FOLDER',
      payload: { name: '新建文件夹' }
    })
  }, [dispatch])

  const handleChatClick = useCallback(
    (chatId: string) => {
      dispatch({ type: 'OPEN_TAB', payload: { chatId } })
      // 同时选中该聊天节点
      dispatch({
        type: 'SET_SELECTED_NODE',
        payload: { nodeId: chatId, nodeType: 'chat' }
      })
    },
    [dispatch]
  )

  // 切换多选模式
  const handleToggleMultiSelect = useCallback(() => {
    dispatch({ type: 'TOGGLE_MULTI_SELECT_MODE' })
  }, [dispatch])

  // 批量删除选中的聊天
  const handleBatchDelete = useCallback(() => {
    // 过滤出聊天ID（排除文件夹ID）
    const chatIds = state.checkedNodeIds
      .filter((nodeId) => nodeId.startsWith('chat-'))
      .map((nodeId) => nodeId.replace('chat-', ''))

    if (chatIds.length === 0) {
      return
    }

    const chatCount = chatIds.length
    modal.confirm({
      title: '批量删除聊天',
      content: `确定要删除选中的 ${chatCount} 个聊天吗？此操作无法撤销。`,
      okText: '确定',
      cancelText: '取消',
      onOk() {
        dispatch({
          type: 'DELETE_MULTIPLE_PAGES',
          payload: { chatIds }
        })
        // 删除后退出多选模式
        dispatch({ type: 'TOGGLE_MULTI_SELECT_MODE' })
      }
    })
  }, [dispatch, modal, state.checkedNodeIds])

  // 检查是否有选中的项目
  const hasCheckedItems = state.checkedNodeIds.length > 0

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
                multiSelectMode={state.multiSelectMode}
                hasCheckedItems={hasCheckedItems}
                onCreateChat={handleCreateChat}
                onCreateCrosstabChat={handleCreateCrosstabChat}
                onCreateObjectChat={handleCreateObjectChat}
                onCreateFolder={handleCreateFolder}
                onToggleMultiSelect={handleToggleMultiSelect}
                onBatchDelete={handleBatchDelete}
              />
            </div>
            <div className="sidebar-content">
              {state.multiSelectMode && (
                <div className="multi-select-indicator">
                  多选模式 ({state.checkedNodeIds.length} 项已选)
                </div>
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
      case 'settings':
        return (
          <div className="sidebar-settings">
            <div className="sidebar-header">
              <h3>设置</h3>
            </div>
            <div className="sidebar-content">
              <Settings open={true} onClose={() => {}} embedded={true} />
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="sidebar">
      {renderContent()}
    </div>
  )
}
