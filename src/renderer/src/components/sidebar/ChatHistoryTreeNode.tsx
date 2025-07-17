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
import { Page, PageFolder } from '../../types/type'

const { Text } = Typography

interface ChatHistoryTreeNodeProps {
  type: 'folder' | 'chat'
  data: PageFolder | Page
  isEditing?: boolean
  onEdit?: () => void
  onDelete?: () => void
  onCreate?: (type: 'folder' | 'chat') => void
  onChatClick?: (chatId: string) => void
  onSaveEdit?: (nodeId: string, nodeType: 'folder' | 'chat', newValue: string) => void
}

export default function ChatHistoryTreeNode({
  type,
  data,
  isEditing,
  onEdit,
  onDelete,
  onCreate,
  onChatClick,
  onSaveEdit
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
  }

  const handleSaveEdit = () => {
    if (editValue.trim() && onSaveEdit) {
      onSaveEdit(data.id, type, editValue.trim())
    }
    setIsInlineEditing(false)
  }

  const handleCancelEdit = () => {
    setIsInlineEditing(false)
    setEditValue('')
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
          key: 'rename',
          label: '重命名',
          icon: <EditOutlined />,
          onClick: () => startInlineEdit()
        },
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
          type: 'divider'
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
              onBlur={handleSaveEdit}
              onKeyDown={handleKeyDown}
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
}
