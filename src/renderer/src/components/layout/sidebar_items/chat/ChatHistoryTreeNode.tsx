import React, { useState } from 'react'
import { Button, Dropdown, Space, Typography, Tooltip, Input, Badge } from 'antd'
import {
  FolderOutlined,
  FolderOpenOutlined,
  MessageOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  FolderAddOutlined
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Page, PageFolder } from '../../../../types/type'

const { Text } = Typography

interface ChatHistoryTreeNodeProps {
  type: 'folder' | 'chat'
  data: PageFolder | Page
  isEditing?: boolean
  onEdit?: () => void
  onDelete?: () => void
  onClear?: () => void
  onCreate?: (type: 'folder' | 'chat') => void
  onChatClick?: (chatId: string) => void
  onSaveEdit?: (nodeId: string, nodeType: 'folder' | 'chat', newValue: string) => void
  onStartEdit?: () => void
  onEndEdit?: () => void
}

const ChatHistoryTreeNode = React.memo(function ChatHistoryTreeNode({
  type,
  data,
  isEditing,
  onEdit,
  onDelete,
  onClear,
  onCreate,
  onChatClick,
  onSaveEdit,
  onStartEdit,
  onEndEdit
}: ChatHistoryTreeNodeProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isInlineEditing, setIsInlineEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (type === 'chat' && onChatClick) {
      onChatClick(data.id)
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    startInlineEdit()
  }

  const startInlineEdit = () => {
    const currentName = getName()
    setEditValue(currentName)
    setIsInlineEditing(true)
    onStartEdit?.()
  }

  const handleSaveEdit = () => {
    if (editValue.trim() && onSaveEdit) {
      onSaveEdit(data.id, type, editValue.trim())
    }
    setIsInlineEditing(false)
    onEndEdit?.()
  }

  const handleCancelEdit = () => {
    setIsInlineEditing(false)
    setEditValue('')
    onEndEdit?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  const getMenuItems = (): MenuProps['items'] => {
    if (type === 'folder') {
      return [
        {
          key: 'addChat',
          label: '新建聊天',
          icon: <MessageOutlined />,
          onClick: () => onCreate?.('chat')
        },
        {
          key: 'addFolder',
          label: '新建文件夹',
          icon: <FolderAddOutlined />,
          onClick: () => onCreate?.('folder')
        },
        {
          key: 'rename',
          label: '重命名',
          icon: <EditOutlined />,
          onClick: () => startInlineEdit()
        },
        {
          type: 'divider'
        },
        {
          key: 'clear',
          label: '清空文件夹',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: (e) => {
            e?.domEvent?.stopPropagation()
            onClear?.()
          }
        },
        {
          key: 'delete',
          label: '删除文件夹',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: (e) => {
            e?.domEvent?.stopPropagation()
            onDelete?.()
          }
        }
      ]
    } else {
      return [
        {
          key: 'rename',
          label: '重命名',
          icon: <EditOutlined />,
          onClick: () => startInlineEdit()
        },
        {
          type: 'divider'
        },
        {
          key: 'delete',
          label: '删除聊天',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: (e) => {
            e?.domEvent?.stopPropagation()
            onDelete?.()
          }
        }
      ]
    }
  }

  const getIcon = () => {
    if (type === 'folder') {
      const folder = data as PageFolder
      return folder.expanded ? <FolderOpenOutlined /> : <FolderOutlined />
    }
    return <MessageOutlined />
  }

  const getName = () => {
    return type === 'folder' ? (data as PageFolder).name : (data as Page).title
  }

  // 获取聊天状态指示器的颜色和状态文本
  const getChatStatus = () => {
    if (type !== 'chat') return null

    const chat = data as Page
    const messageCount = chat.messages?.length || 0
    const hasStreamingMessage = !!chat.streamingMessage
    const hasStreamingInMessages = chat.messages?.some((msg) => msg.isStreaming) || false
    const isStreaming = hasStreamingMessage || hasStreamingInMessages

    if (isStreaming) {
      return {
        status: 'processing' as const, // 蓝色，带动画
        text: '正在生成中'
      }
    } else if (messageCount > 1) {
      return {
        status: 'success' as const, // 绿色
        text: '已完成对话'
      }
    } else {
      return {
        status: 'default' as const, // 灰色
        text: '未开始对话'
      }
    }
  }

  const chatStatus = getChatStatus()

  return (
    <div
      className={`tree-node tree-node-${type}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      draggable={false}
      onMouseDown={(e) => {
        // 阻止编辑状态下的拖动
        if (isInlineEditing) {
          e.stopPropagation()
        }
      }}
    >
      <div className="tree-node-content">
        <div className="tree-node-icon">{getIcon()}</div>
        {chatStatus && (
          <Tooltip title={chatStatus.text}>
            <Badge status={chatStatus.status} />
          </Tooltip>
        )}
        <div className="tree-node-title">
          {isInlineEditing ? (
            <Input
              size="small"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={(e) => {
                handleSaveEdit()
              }}
              onKeyDown={handleKeyDown}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              style={{ width: '100%' }}
            />
          ) : (
            <Text
              ellipsis
              style={{
                display: 'block',
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {getName()}
            </Text>
          )}
        </div>
      </div>

      {(isHovered || isEditing) && (
        <div className="tree-node-actions">
          {type === 'folder' && onCreate && (
            <>
              <Tooltip title="新建聊天">
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreate('chat')
                  }}
                />
              </Tooltip>
              <Tooltip title="新建文件夹">
                <Button
                  type="text"
                  size="small"
                  icon={<FolderAddOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreate('folder')
                  }}
                />
              </Tooltip>
            </>
          )}
          <Dropdown menu={{ items: getMenuItems() }} trigger={['click']} placement="bottomRight">
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        </div>
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  // 自定义比较函数，只在关键属性变化时重新渲染
  if (
    prevProps.type !== nextProps.type ||
    prevProps.data.id !== nextProps.data.id ||
    prevProps.isEditing !== nextProps.isEditing
  ) {
    return false
  }

  if (prevProps.type === 'folder') {
    const prevFolder = prevProps.data as PageFolder
    const nextFolder = nextProps.data as PageFolder
    return prevFolder.name === nextFolder.name && prevFolder.expanded === nextFolder.expanded
  } else {
    const prevPage = prevProps.data as Page
    const nextPage = nextProps.data as Page

    // 检查标题是否变化
    if (prevPage.title !== nextPage.title) {
      return false
    }

    // 检查消息数量是否变化
    if (prevPage.messages?.length !== nextPage.messages?.length) {
      return false
    }

    // 检查 streamingMessage 状态是否变化
    if (!!(prevPage.streamingMessage) !== !!(nextPage.streamingMessage)) {
      return false
    }

    // 检查是否有任何消息的 isStreaming 状态发生变化
    // 需要更精确的比较：计算实际的流式消息数量
    const prevStreamingCount = prevPage.messages?.filter(msg => msg.isStreaming)?.length || 0
    const nextStreamingCount = nextPage.messages?.filter(msg => msg.isStreaming)?.length || 0

    if (prevStreamingCount !== nextStreamingCount) {
      return false
    }

    return true
  }
})

export default ChatHistoryTreeNode
