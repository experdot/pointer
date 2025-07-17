import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Tree, Card, Typography, Button, Space, Tooltip } from 'antd'
import {
  UserOutlined,
  RobotOutlined,
  BranchesOutlined,
  MessageOutlined,
  ExpandAltOutlined,
  CompressOutlined,
  StarFilled,
  UpOutlined,
  DownOutlined
} from '@ant-design/icons'
import { ChatMessage } from '../../../types/type'
import { MessageTree } from './messageTree'
import './message-tree-sidebar.css'

const { Text } = Typography

interface MessageTreeSidebarProps {
  messages: ChatMessage[]
  currentPath?: string[]
  onNodeSelect?: (messageId: string) => void
  onPathChange?: (path: string[]) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
  width?: number
  onWidthChange?: (width: number) => void
}

interface TreeNodeData {
  key: string
  title: React.ReactNode
  icon?: React.ReactNode
  children?: TreeNodeData[]
  isLeaf?: boolean
  messageId: string
  message: ChatMessage
}

const MessageTreeSidebar: React.FC<MessageTreeSidebarProps> = ({
  messages,
  currentPath = [],
  onNodeSelect,
  onPathChange,
  collapsed = false,
  onToggleCollapse,
  width = 300,
  onWidthChange
}) => {
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // 创建消息树实例
  const messageTree = useMemo(() => {
    return new MessageTree(messages)
  }, [messages])

  // 构建树形数据结构
  const treeData = useMemo(() => {
    if (!messages || messages.length === 0) return []

    const messageMap = new Map<string, ChatMessage>()
    messages.forEach((msg) => {
      messageMap.set(msg.id, msg)
    })

    const buildTreeNode = (message: ChatMessage, depth: number = 0): TreeNodeData => {
      const isCurrentPath = currentPath.includes(message.id)
      const hasChildren = message.children && message.children.length > 0
      const isFavorited = message.isFavorited || false

      // 生成节点内容
      const nodeContent = (
        <div
          className={`tree-node-content ${isCurrentPath ? 'current-path' : ''} ${isFavorited ? 'favorited' : ''}`}
          data-role={message.role}
        >
          <div className="tree-node-header">
            <div className="tree-node-icon">
              {message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
            </div>
            <div className="tree-node-info">
              <div className="tree-node-role">
                {message.role === 'user' ? '用户' : 'AI'}
                {hasChildren && (
                  <div className="tree-node-branch-indicator">
                    <BranchesOutlined style={{ fontSize: '10px', color: '#1890ff' }} />
                    <Text type="secondary" style={{ fontSize: '10px', marginLeft: 2 }}>
                      {message.children.length}
                    </Text>
                  </div>
                )}
                {isFavorited && <StarFilled className="favorite-icon" />}
              </div>
              <div className="tree-node-time">
                {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </div>
          <div className="tree-node-preview">
            <Text type={isCurrentPath ? 'success' : 'secondary'} style={{ fontSize: '11px' }}>
              {message.content.slice(0, 50)}
              {message.content.length > 50 ? '...' : ''}
            </Text>
          </div>
        </div>
      )

      const node: TreeNodeData = {
        key: message.id,
        title: nodeContent,
        icon: message.role === 'user' ? <UserOutlined /> : <RobotOutlined />,
        messageId: message.id,
        message: message,
        children: []
      }

      // 递归构建子节点
      if (message.children && message.children.length > 0) {
        node.children = message.children
          .map((childId) => messageMap.get(childId))
          .filter(Boolean)
          .map((childMessage) => buildTreeNode(childMessage!, depth + 1))
      }

      return node
    }

    // 找到所有根节点（没有parentId的消息）
    const rootMessages = messages.filter((msg) => !msg.parentId)

    return rootMessages.map((rootMsg) => buildTreeNode(rootMsg))
  }, [messages, currentPath])

  // 当前路径变化时更新展开状态和选中状态
  useEffect(() => {
    if (currentPath.length > 0) {
      // 自动展开当前路径上的所有节点
      const pathKeys = currentPath.slice(0, -1) // 除了最后一个节点，其他都需要展开
      setExpandedKeys((prev) => {
        const newExpanded = new Set([...prev, ...pathKeys])
        return Array.from(newExpanded)
      })

      // 选中当前路径的最后一个节点
      const lastMessageId = currentPath[currentPath.length - 1]
      setSelectedKeys([lastMessageId])
    }
  }, [currentPath])

  // 处理节点选择
  const handleNodeSelect = (selectedKeys: React.Key[], info: any) => {
    if (selectedKeys.length > 0) {
      const messageId = selectedKeys[0] as string
      const message = messages.find((msg) => msg.id === messageId)

      if (message && onNodeSelect) {
        onNodeSelect(messageId)
      }

      // 构建到选中节点的路径
      if (message && onPathChange) {
        const newPath = buildPathToMessage(messageId)
        onPathChange(newPath)
      }
    }
  }

  // 构建到指定消息的路径
  const buildPathToMessage = (messageId: string): string[] => {
    const path: string[] = []
    let currentMsg = messages.find((msg) => msg.id === messageId)

    while (currentMsg) {
      path.unshift(currentMsg.id)
      if (currentMsg.parentId) {
        currentMsg = messages.find((msg) => msg.id === currentMsg!.parentId)
      } else {
        break
      }
    }

    return path
  }

  // 处理展开/折叠
  const handleExpand = (expandedKeys: React.Key[]) => {
    setExpandedKeys(expandedKeys as string[])
  }

  // 统计信息和收藏消息列表
  const stats = useMemo(() => {
    const totalMessages = messages.length
    const userMessages = messages.filter((msg) => msg.role === 'user').length
    const aiMessages = messages.filter((msg) => msg.role === 'assistant').length
    const branches = messages.filter((msg) => msg.children && msg.children.length > 1).length
    const favoritedMessages = messages
      .filter((msg) => msg.isFavorited)
      .sort((a, b) => a.timestamp - b.timestamp)

    return {
      totalMessages,
      userMessages,
      aiMessages,
      branches,
      favorited: favoritedMessages.length,
      favoritedMessages
    }
  }, [messages])

  // 当前收藏消息的索引
  const currentFavoritedIndex = useMemo(() => {
    if (stats.favoritedMessages.length === 0 || selectedKeys.length === 0) {
      return -1
    }
    const currentMessageId = selectedKeys[0]
    return stats.favoritedMessages.findIndex((msg) => msg.id === currentMessageId)
  }, [stats.favoritedMessages, selectedKeys])

  // 跳转到指定的收藏消息
  const navigateToFavorited = (direction: 'prev' | 'next') => {
    if (stats.favoritedMessages.length === 0) return

    let targetIndex: number
    if (currentFavoritedIndex === -1) {
      // 如果当前没有选中收藏消息，跳转到第一个
      targetIndex = 0
    } else {
      if (direction === 'prev') {
        targetIndex =
          currentFavoritedIndex > 0 ? currentFavoritedIndex - 1 : stats.favoritedMessages.length - 1
      } else {
        targetIndex =
          currentFavoritedIndex < stats.favoritedMessages.length - 1 ? currentFavoritedIndex + 1 : 0
      }
    }

    const targetMessage = stats.favoritedMessages[targetIndex]
    if (targetMessage && onNodeSelect) {
      onNodeSelect(targetMessage.id)
    }

    if (targetMessage && onPathChange) {
      const newPath = buildPathToMessage(targetMessage.id)
      onPathChange(newPath)
    }
  }

  // Resize 功能
  const MIN_WIDTH = 200
  const MAX_WIDTH = 600

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleResize = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !sidebarRef.current || !onWidthChange) return

      const sidebarRect = sidebarRef.current.getBoundingClientRect()
      const newWidth = e.clientX - sidebarRect.left

      // 限制宽度范围
      const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth))
      onWidthChange(clampedWidth)
    },
    [isResizing, onWidthChange]
  )

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
  }, [])

  // 添加全局鼠标事件监听
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResize)
      document.addEventListener('mouseup', handleResizeEnd)
      document.body.style.cursor = 'col-resize'
      document.body.classList.add('resizing')

      return () => {
        document.removeEventListener('mousemove', handleResize)
        document.removeEventListener('mouseup', handleResizeEnd)
        document.body.style.cursor = ''
        document.body.classList.remove('resizing')
      }
    }
  }, [isResizing, handleResize, handleResizeEnd])

  if (collapsed) {
    return (
      <div className="message-tree-sidebar message-tree-sidebar-collapsed">
        <div className="tree-sidebar-header">
          <Button
            type="text"
            icon={<ExpandAltOutlined />}
            onClick={onToggleCollapse}
            title="展开消息树"
          />
        </div>
        <div className="tree-sidebar-content-collapsed">
          <div className="tree-stats-collapsed">
            <div className="stat-item">
              <MessageOutlined />
              <Text type="secondary">{stats.totalMessages}</Text>
            </div>
            <div className="stat-item">
              <BranchesOutlined />
              <Text type="secondary">{stats.branches}</Text>
            </div>
            {stats.favorited > 0 && (
              <div className="stat-item stat-item-favorited-collapsed">
                <StarFilled />
                <Text type="secondary">{stats.favorited}</Text>
                <div className="favorited-navigation-collapsed">
                  <Button
                    type="text"
                    size="small"
                    icon={<UpOutlined />}
                    onClick={() => navigateToFavorited('prev')}
                    title="上一个收藏"
                    className="nav-btn-collapsed"
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<DownOutlined />}
                    onClick={() => navigateToFavorited('next')}
                    title="下一个收藏"
                    className="nav-btn-collapsed"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={sidebarRef}
      className="message-tree-sidebar"
      style={{ width: collapsed ? '48px' : `${width}px` }}
    >
      <div className="tree-sidebar-header">
        <div className="tree-sidebar-title">
          <BranchesOutlined />
          <Text strong>消息树</Text>
        </div>
        <Button
          type="text"
          size="small"
          icon={<CompressOutlined />}
          onClick={onToggleCollapse}
          title="收起消息树"
        />
      </div>

      <div className="tree-sidebar-stats">
        <Space size="small">
          <div className="stat-item">
            <MessageOutlined />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {stats.totalMessages}条消息
            </Text>
          </div>
          <div className="stat-item">
            <BranchesOutlined />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {stats.branches}个分支
            </Text>
          </div>
          {stats.favorited > 0 && (
            <div className="stat-item stat-item-favorited">
              <div className="favorited-info">
                <StarFilled />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {stats.favorited}个收藏
                  {currentFavoritedIndex >= 0 && (
                    <span className="favorited-position">
                      {` (${currentFavoritedIndex + 1}/${stats.favorited})`}
                    </span>
                  )}
                </Text>
              </div>
              <div className="favorited-navigation">
                <Button
                  type="text"
                  size="small"
                  icon={<UpOutlined />}
                  onClick={() => navigateToFavorited('prev')}
                  title="上一个收藏"
                  className="nav-btn"
                />
                <Button
                  type="text"
                  size="small"
                  icon={<DownOutlined />}
                  onClick={() => navigateToFavorited('next')}
                  title="下一个收藏"
                  className="nav-btn"
                />
              </div>
            </div>
          )}
        </Space>
      </div>

      <div className="tree-sidebar-content">
        {treeData.length === 0 ? (
          <div className="tree-empty">
            <Text type="secondary">暂无消息</Text>
          </div>
        ) : (
          <Tree
            treeData={treeData}
            expandedKeys={expandedKeys}
            selectedKeys={selectedKeys}
            onExpand={handleExpand}
            onSelect={handleNodeSelect}
            showIcon={false}
            showLine={true}
            defaultExpandAll={false}
            selectable={true}
            className="message-tree"
          />
        )}
      </div>

      {/* Resize Handle */}
      {!collapsed && (
        <div className="resize-handle" onMouseDown={handleResizeStart} title="拖拽调整宽度" />
      )}
    </div>
  )
}

export default MessageTreeSidebar
