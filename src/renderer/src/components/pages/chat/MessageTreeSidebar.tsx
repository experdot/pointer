import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Typography, Button, Space, Tooltip } from 'antd'
import {
  UserOutlined,
  RobotOutlined,
  BranchesOutlined,
  MessageOutlined,
  ExpandAltOutlined,
  CompressOutlined,
  StarFilled,
  UpOutlined,
  DownOutlined,
  RightOutlined,
  DownOutlined as CollapseIcon
} from '@ant-design/icons'
import { ChatMessage } from '../../../types/type'
import { MessageTree } from './messageTree'
import RelativeTime from '../../common/RelativeTime'
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

interface PathNodeData {
  messageId: string
  message: ChatMessage
  depth: number
  siblings?: ChatMessage[]
  showSiblings?: boolean
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
  const [selectedMessageId, setSelectedMessageId] = useState<string>('')
  const [expandedSiblings, setExpandedSiblings] = useState<Set<string>>(new Set())
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // 创建消息树实例
  const messageTree = useMemo(() => {
    return new MessageTree(messages)
  }, [messages])

  // 构建显示路径的节点数据
  const pathNodes = useMemo(() => {
    if (!messages || messages.length === 0) return []

    const messageMap = new Map<string, ChatMessage>()
    messages.forEach((msg) => {
      messageMap.set(msg.id, msg)
    })

    // 如果没有选中节点，使用当前路径的最后一个节点，否则使用选中节点
    let targetMessageId = selectedMessageId
    if (!targetMessageId && currentPath.length > 0) {
      targetMessageId = currentPath[currentPath.length - 1]
    }

    if (!targetMessageId) return []

    // 构建从根节点到目标节点的完整路径
    const buildFullPath = (messageId: string): string[] => {
      const path: string[] = []
      let currentMsg = messageMap.get(messageId)

      while (currentMsg) {
        path.unshift(currentMsg.id)
        if (currentMsg.parentId) {
          currentMsg = messageMap.get(currentMsg.parentId)
        } else {
          break
        }
      }

      return path
    }

    const fullPath = buildFullPath(targetMessageId)
    const nodes: PathNodeData[] = []

    fullPath.forEach((messageId, index) => {
      const message = messageMap.get(messageId)
      if (!message) return

      // 获取兄弟节点
      let siblings: ChatMessage[] = []
      if (message.parentId) {
        const parent = messageMap.get(message.parentId)
        if (parent && parent.children) {
          siblings = parent.children
            .map((id) => messageMap.get(id))
            .filter(Boolean)
            .filter((sibling) => sibling!.id !== messageId) as ChatMessage[]
        }
      } else {
        // 根节点的兄弟节点是其他根节点
        siblings = messages.filter((msg) => !msg.parentId && msg.id !== messageId)
      }

      nodes.push({
        messageId,
        message,
        depth: index,
        siblings: siblings.length > 0 ? siblings : undefined,
        showSiblings: expandedSiblings.has(messageId)
      })
    })

    return nodes
  }, [messages, selectedMessageId, currentPath, expandedSiblings])

  // 当前路径变化时更新选中状态
  useEffect(() => {
    if (currentPath.length > 0) {
      const lastMessageId = currentPath[currentPath.length - 1]
      setSelectedMessageId(lastMessageId)
    }
  }, [currentPath])

  // 处理节点选择
  const handleNodeSelect = (messageId: string) => {
    const message = messages.find((msg) => msg.id === messageId)

    // 立即更新选中状态
    setSelectedMessageId(messageId)

    if (message && onNodeSelect) {
      onNodeSelect(messageId)
    }

    // 构建到选中节点的路径
    if (message && onPathChange) {
      const newPath = buildPathToMessage(messageId)
      onPathChange(newPath)
    }
  }

  // 构建包含后续路径的完整路径
  const buildPathToMessage = (messageId: string): string[] => {
    const messageMap = new Map<string, ChatMessage>()
    messages.forEach((msg) => {
      messageMap.set(msg.id, msg)
    })

    // 先构建从根节点到选中节点的路径
    const pathToSelected: string[] = []
    let currentMsg = messageMap.get(messageId)
    while (currentMsg) {
      pathToSelected.unshift(currentMsg.id)
      if (currentMsg.parentId) {
        currentMsg = messageMap.get(currentMsg.parentId)
      } else {
        break
      }
    }

    // 如果选中的节点在当前路径中，需要保持到叶子节点的完整路径
    if (currentPath.includes(messageId)) {
      // 找到选中节点在当前路径中的位置
      const selectedIndex = currentPath.findIndex((id) => id === messageId)
      if (selectedIndex !== -1) {
        // 从根节点到选中节点的路径 + 选中节点之后的原路径
        const beforeSelected = pathToSelected
        const afterSelected = currentPath.slice(selectedIndex + 1)
        return [...beforeSelected, ...afterSelected]
      }
    }

    // 如果不在当前路径中，或者是叶子节点，则需要延续到第一个子节点的路径
    let extendedPath = [...pathToSelected]
    let lastNode = messageMap.get(messageId)

    // 如果该节点有子节点，默认选择第一个子节点并延续路径
    while (lastNode && lastNode.children && lastNode.children.length > 0) {
      const firstChild = messageMap.get(lastNode.children[0])
      if (firstChild) {
        extendedPath.push(firstChild.id)
        lastNode = firstChild
      } else {
        break
      }
    }

    return extendedPath
  }

  // 处理兄弟节点的展开/收起
  const toggleSiblings = (messageId: string) => {
    setExpandedSiblings((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
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
    if (stats.favoritedMessages.length === 0 || !selectedMessageId) {
      return -1
    }
    return stats.favoritedMessages.findIndex((msg) => msg.id === selectedMessageId)
  }, [stats.favoritedMessages, selectedMessageId])

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
        {pathNodes.length === 0 ? (
          <div className="tree-empty">
            <Text type="secondary">暂无消息</Text>
          </div>
        ) : (
          <div className="message-path-list">
            {pathNodes.map((node, index) => (
              <div key={node.messageId} className="path-node-container">
                {/* 主节点 */}
                <div
                  className={`path-node ${
                    selectedMessageId === node.messageId ? 'selected' : ''
                  } ${node.message.isFavorited ? 'favorited' : ''}`}
                  onClick={() => handleNodeSelect(node.messageId)}
                  data-role={node.message.role}
                >
                  <div className="path-node-header">
                    <div className="path-node-icon">
                      {node.message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                    </div>
                    <div className="path-node-info">
                      <div className="path-node-role">
                        {node.message.role === 'user' ? '用户' : 'AI'}
                        {node.message.isFavorited && <StarFilled className="favorite-icon" />}
                      </div>
                      <div className="path-node-time">
                        <RelativeTime timestamp={node.message.timestamp} />
                      </div>
                    </div>
                    {/* 兄弟分支按钮 */}
                    {node.siblings && node.siblings.length > 0 && (
                      <Button
                        type="text"
                        size="small"
                        className="siblings-toggle"
                        icon={node.showSiblings ? <CollapseIcon /> : <RightOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSiblings(node.messageId)
                        }}
                        title={`${node.showSiblings ? '收起' : '展开'}兄弟分支 (${node.siblings.length})`}
                      />
                    )}
                  </div>
                  <div className="path-node-preview">
                    <Text
                      type={selectedMessageId === node.messageId ? 'success' : 'secondary'}
                      style={{ fontSize: '11px' }}
                    >
                      {node.message.content.slice(0, 50)}
                      {node.message.content.length > 50 ? '...' : ''}
                    </Text>
                  </div>
                </div>

                {/* 兄弟节点列表 */}
                {node.showSiblings && node.siblings && (
                  <div
                    className="siblings-list"
                    style={{ paddingLeft: `${(node.depth + 1) * 12 + 16}px` }}
                  >
                    {node.siblings.map((sibling) => (
                      <div
                        key={sibling.id}
                        className={`sibling-node ${
                          selectedMessageId === sibling.id ? 'selected' : ''
                        } ${sibling.isFavorited ? 'favorited' : ''}`}
                        onClick={() => handleNodeSelect(sibling.id)}
                        data-role={sibling.role}
                      >
                        <div className="sibling-node-header">
                          <div className="sibling-node-icon">
                            {sibling.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                          </div>
                          <div className="sibling-node-info">
                            <div className="sibling-node-role">
                              {sibling.role === 'user' ? '用户' : 'AI'}
                              {sibling.isFavorited && <StarFilled className="favorite-icon" />}
                            </div>
                            <div className="sibling-node-time">
                              <RelativeTime timestamp={sibling.timestamp} />
                            </div>
                          </div>
                        </div>
                        <div className="sibling-node-preview">
                          <Text
                            type={selectedMessageId === sibling.id ? 'success' : 'secondary'}
                            style={{ fontSize: '11px' }}
                          >
                            {sibling.content.slice(0, 50)}
                            {sibling.content.length > 50 ? '...' : ''}
                          </Text>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
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
