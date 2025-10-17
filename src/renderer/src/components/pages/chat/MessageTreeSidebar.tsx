import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Typography, Button, Space, Tooltip } from 'antd'
import {
  UserOutlined,
  RobotOutlined,
  BranchesOutlined,
  MessageOutlined,
  ExpandAltOutlined,
  CompressOutlined,
  BookOutlined,
  BookFilled,
  UpOutlined,
  DownOutlined,
  RightOutlined,
  DownOutlined as CollapseIcon,
  VerticalAlignTopOutlined,
  VerticalAlignBottomOutlined,
  LeftOutlined,
  RightOutlined as NextIcon
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
  scrollTriggeredMessageId?: string | null // 由滚动触发的消息选中
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
  onWidthChange,
  scrollTriggeredMessageId
}) => {
  // 本地导航索引，用于在当前路径中导航，独立于实际路径
  const [localNavigationIndex, setLocalNavigationIndex] = useState<number>(-1)
  const [expandedSiblings, setExpandedSiblings] = useState<Set<string>>(new Set())
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const prevScrollTriggeredMessageIdRef = useRef<string | null>(null)

  // 创建消息树实例
  const messageTree = useMemo(() => {
    return new MessageTree(messages)
  }, [messages])

  // 构建显示路径的节点数据 - 始终基于 currentPath
  const pathNodes = useMemo(() => {
    if (!messages || messages.length === 0) return []
    if (currentPath.length === 0) return []

    const messageMap = new Map<string, ChatMessage>()
    messages.forEach((msg) => {
      messageMap.set(msg.id, msg)
    })

    const nodes: PathNodeData[] = []

    currentPath.forEach((messageId, index) => {
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
  }, [messages, currentPath, expandedSiblings])

  // 计算当前选中的消息ID（基于导航索引）
  const selectedMessageId = useMemo(() => {
    console.log('[MessageTreeSidebar] Computing selectedMessageId:', {
      localNavigationIndex,
      pathNodesLength: pathNodes.length
    })
    if (localNavigationIndex >= 0 && localNavigationIndex < pathNodes.length) {
      const msgId = pathNodes[localNavigationIndex].messageId
      console.log('[MessageTreeSidebar] Selected from localNavigationIndex:', msgId)
      return msgId
    }
    // 默认选中最后一条消息
    if (pathNodes.length > 0) {
      const msgId = pathNodes[pathNodes.length - 1].messageId
      console.log('[MessageTreeSidebar] Selected last message:', msgId)
      return msgId
    }
    console.log('[MessageTreeSidebar] No message selected')
    return ''
  }, [localNavigationIndex, pathNodes])

  // 记录上次的路径，用于判断路径是否真正变化了
  const prevPathRef = useRef<string[]>([])

  // 处理由滚动触发的消息选中（外部控制）
  useEffect(() => {
    if (!scrollTriggeredMessageId) return
    if (scrollTriggeredMessageId === prevScrollTriggeredMessageIdRef.current) return

    console.log('[MessageTreeSidebar] Scroll triggered message:', scrollTriggeredMessageId)

    // 检查该消息是否在当前路径中
    const indexInPath = currentPath.indexOf(scrollTriggeredMessageId)
    if (indexInPath !== -1) {
      console.log('[MessageTreeSidebar] Setting navigation index from scroll:', indexInPath)
      setLocalNavigationIndex(indexInPath)
    }

    prevScrollTriggeredMessageIdRef.current = scrollTriggeredMessageId
  }, [scrollTriggeredMessageId, currentPath])

  // 当路径变化时，检查是否需要重置导航索引
  useEffect(() => {
    const pathChanged = JSON.stringify(prevPathRef.current) !== JSON.stringify(currentPath)

    if (pathChanged && currentPath.length > 0) {
      // 如果当前有导航索引，检查选中的消息是否还在新路径中
      if (localNavigationIndex >= 0 && localNavigationIndex < pathNodes.length) {
        const currentSelectedId = pathNodes[localNavigationIndex]?.messageId
        const stillInPath = currentPath.includes(currentSelectedId)

        if (stillInPath) {
          // 如果选中的消息还在新路径中，更新索引位置但不重置
          const newIndex = currentPath.indexOf(currentSelectedId)
          console.log('[MessageTreeSidebar] Path changed but message still in path, updating index to:', newIndex)
          setLocalNavigationIndex(newIndex)
          prevPathRef.current = currentPath
          return
        }
      }

      // 否则重置到默认位置
      console.log('[MessageTreeSidebar] Path changed, resetting navigation index')
      setLocalNavigationIndex(-1) // -1 表示使用默认（最后一条）
      prevPathRef.current = currentPath
    }
  }, [currentPath, localNavigationIndex, pathNodes])

  // 处理节点选择（点击节点切换分支）
  const handleNodeSelect = (messageId: string) => {
    const message = messages.find((msg) => msg.id === messageId)

    if (message && onNodeSelect) {
      onNodeSelect(messageId)
    }

    // 构建到选中节点的路径
    if (message && onPathChange) {
      const newPath = buildPathToMessage(messageId)
      // 设置导航索引到点击的消息在新路径中的位置
      const indexInNewPath = newPath.indexOf(messageId)
      if (indexInNewPath !== -1) {
        console.log('[MessageTreeSidebar] Setting navigation index to clicked message:', indexInNewPath)
        setLocalNavigationIndex(indexInNewPath)
      } else {
        // 如果找不到（不应该发生），重置到默认
        setLocalNavigationIndex(-1)
      }
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

  // 统计信息和书签消息列表
  const stats = useMemo(() => {
    const totalMessages = messages.length
    const userMessages = messages.filter((msg) => msg.role === 'user').length
    const aiMessages = messages.filter((msg) => msg.role === 'assistant').length
    const branches = messages.filter((msg) => msg.children && msg.children.length > 1).length
    const bookmarkedMessages = messages
      .filter((msg) => msg.isBookmarked)
      .sort((a, b) => a.timestamp - b.timestamp)

    return {
      totalMessages,
      userMessages,
      aiMessages,
      branches,
      bookmarked: bookmarkedMessages.length,
      bookmarkedMessages
    }
  }, [messages])

  // 当前书签消息的索引
  const currentBookmarkedIndex = useMemo(() => {
    if (stats.bookmarkedMessages.length === 0 || !selectedMessageId) {
      return -1
    }
    return stats.bookmarkedMessages.findIndex((msg) => msg.id === selectedMessageId)
  }, [stats.bookmarkedMessages, selectedMessageId])

  // 跳转到指定的书签消息
  const navigateToBookmarked = (direction: 'prev' | 'next') => {
    if (stats.bookmarkedMessages.length === 0) return

    let targetIndex: number
    if (currentBookmarkedIndex === -1) {
      // 如果当前没有选中书签消息，跳转到第一个
      targetIndex = 0
    } else {
      if (direction === 'prev') {
        targetIndex =
          currentBookmarkedIndex > 0 ? currentBookmarkedIndex - 1 : stats.bookmarkedMessages.length - 1
      } else {
        targetIndex =
          currentBookmarkedIndex < stats.bookmarkedMessages.length - 1 ? currentBookmarkedIndex + 1 : 0
      }
    }

    const targetMessage = stats.bookmarkedMessages[targetIndex]
    if (targetMessage && onNodeSelect) {
      onNodeSelect(targetMessage.id)
    }

    if (targetMessage && onPathChange) {
      const newPath = buildPathToMessage(targetMessage.id)
      onPathChange(newPath)
    }
  }

  // 导航到第一条/最后一条消息
  const navigateToFirstOrLast = (position: 'first' | 'last') => {
    if (pathNodes.length === 0) return

    let targetIndex: number
    if (position === 'first') {
      targetIndex = 0
    } else {
      targetIndex = pathNodes.length - 1
    }

    const targetMessageId = pathNodes[targetIndex].messageId

    console.log('[MessageTreeSidebar] navigateToFirstOrLast:', position, 'targetIndex:', targetIndex)

    // 更新本地导航索引
    setLocalNavigationIndex(targetIndex)

    if (onNodeSelect) {
      onNodeSelect(targetMessageId)
    }

    if (onPathChange) {
      const newPath = buildPathToMessage(targetMessageId)
      onPathChange(newPath)
    }
  }

  // 导航到上一条/下一条消息（仅在当前路径中移动，不改变路径）
  const navigateToPrevOrNext = (direction: 'prev' | 'next') => {
    console.log('[MessageTreeSidebar] navigateToPrevOrNext called:', direction)
    if (pathNodes.length === 0) return

    // 获取当前索引
    let currentIndex = localNavigationIndex
    if (currentIndex === -1) {
      // 如果还没有设置索引，使用最后一条消息
      currentIndex = pathNodes.length - 1
    }

    console.log('[MessageTreeSidebar] Current index:', currentIndex, 'Total nodes:', pathNodes.length)

    // 计算目标索引
    let targetIndex: number
    if (direction === 'prev') {
      targetIndex = currentIndex - 1
      if (targetIndex < 0) {
        console.log('[MessageTreeSidebar] Already at first message')
        return // 已经在第一个
      }
    } else {
      targetIndex = currentIndex + 1
      if (targetIndex >= pathNodes.length) {
        console.log('[MessageTreeSidebar] Already at last message')
        return // 已经在最后一个
      }
    }

    console.log('[MessageTreeSidebar] Target index:', targetIndex)

    // 更新导航索引
    setLocalNavigationIndex(targetIndex)

    // 通知父组件滚动到目标消息（仅用于滚动，不改变路径）
    // 注意：这里调用 onNodeSelect 会触发父组件的路径重建
    // 但是由于选中的消息在当前路径中，父组件会保持完整路径
    const targetMessageId = pathNodes[targetIndex].messageId
    console.log('[MessageTreeSidebar] Calling onNodeSelect with:', targetMessageId)
    if (onNodeSelect) {
      onNodeSelect(targetMessageId)
    }
  }

  // 计算当前导航位置，用于判断按钮禁用状态
  const currentNavigationIndex = useMemo(() => {
    if (localNavigationIndex !== -1) {
      return localNavigationIndex
    }
    // 默认为最后一个
    return pathNodes.length - 1
  }, [localNavigationIndex, pathNodes])

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
            {stats.bookmarked > 0 && (
              <div className="stat-item stat-item-bookmarked-collapsed">
                <BookFilled />
                <Text type="secondary">{stats.bookmarked}</Text>
                <div className="bookmarked-navigation-collapsed">
                  <Button
                    type="text"
                    size="small"
                    icon={<UpOutlined />}
                    onClick={() => navigateToBookmarked('prev')}
                    title="上一个书签"
                    className="nav-btn-collapsed"
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<DownOutlined />}
                    onClick={() => navigateToBookmarked('next')}
                    title="下一个书签"
                    className="nav-btn-collapsed"
                  />
                </div>
              </div>
            )}
            {pathNodes.length > 0 && (
              <>
                <div className="stat-item">
                  <Button
                    type="text"
                    size="small"
                    icon={<VerticalAlignTopOutlined />}
                    onClick={() => navigateToFirstOrLast('first')}
                    title="回到顶部"
                    className="nav-btn-collapsed"
                  />
                </div>
                <div className="stat-item">
                  <Button
                    type="text"
                    size="small"
                    icon={<VerticalAlignBottomOutlined />}
                    onClick={() => navigateToFirstOrLast('last')}
                    title="回到底部"
                    className="nav-btn-collapsed"
                  />
                </div>
                <div className="stat-item">
                  <Button
                    type="text"
                    size="small"
                    icon={<LeftOutlined />}
                    onClick={() => navigateToPrevOrNext('prev')}
                    title="上一条消息"
                    className="nav-btn-collapsed"
                    disabled={currentNavigationIndex <= 0 || pathNodes.length === 0}
                  />
                </div>
                <div className="stat-item">
                  <Button
                    type="text"
                    size="small"
                    icon={<NextIcon />}
                    onClick={() => navigateToPrevOrNext('next')}
                    title="下一条消息"
                    className="nav-btn-collapsed"
                    disabled={currentNavigationIndex >= pathNodes.length - 1 || pathNodes.length === 0}
                  />
                </div>
              </>
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
          {stats.bookmarked > 0 && (
            <div className="stat-item stat-item-bookmarked">
              <div className="bookmarked-info">
                <BookOutlined />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {stats.bookmarked}个书签
                  {currentBookmarkedIndex >= 0 && (
                    <span className="bookmarked-position">
                      {` (${currentBookmarkedIndex + 1}/${stats.bookmarked})`}
                    </span>
                  )}
                </Text>
              </div>
              <div className="bookmarked-navigation">
                <Button
                  type="text"
                  size="small"
                  icon={<UpOutlined />}
                  onClick={() => navigateToBookmarked('prev')}
                  title="上一个书签"
                  className="nav-btn"
                />
                <Button
                  type="text"
                  size="small"
                  icon={<DownOutlined />}
                  onClick={() => navigateToBookmarked('next')}
                  title="下一个书签"
                  className="nav-btn"
                />
              </div>
            </div>
          )}
          {pathNodes.length > 0 && (
            <>
              <Tooltip title="回到顶部">
                <Button
                  type="text"
                  size="small"
                  icon={<VerticalAlignTopOutlined />}
                  onClick={() => navigateToFirstOrLast('first')}
                  className="nav-btn path-nav-btn"
                />
              </Tooltip>
              <Tooltip title="回到底部">
                <Button
                  type="text"
                  size="small"
                  icon={<VerticalAlignBottomOutlined />}
                  onClick={() => navigateToFirstOrLast('last')}
                  className="nav-btn path-nav-btn"
                />
              </Tooltip>
              <Tooltip title="上一条消息">
                <Button
                  type="text"
                  size="small"
                  icon={<LeftOutlined />}
                  onClick={() => navigateToPrevOrNext('prev')}
                  className="nav-btn path-nav-btn"
                  disabled={currentNavigationIndex <= 0 || pathNodes.length === 0}
                />
              </Tooltip>
              <Tooltip title="下一条消息">
                <Button
                  type="text"
                  size="small"
                  icon={<NextIcon />}
                  onClick={() => navigateToPrevOrNext('next')}
                  className="nav-btn path-nav-btn"
                  disabled={currentNavigationIndex >= pathNodes.length - 1 || pathNodes.length === 0}
                />
              </Tooltip>
            </>
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
                  } ${node.message.isBookmarked ? 'bookmarked' : ''}`}
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
                        {node.message.isBookmarked && <BookFilled className="bookmark-icon" />}
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
                        } ${sibling.isBookmarked ? 'bookmarked' : ''}`}
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
                              {sibling.isBookmarked && <BookFilled className="bookmark-icon" />}
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
