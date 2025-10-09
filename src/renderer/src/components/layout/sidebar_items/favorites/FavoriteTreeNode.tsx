import React, { useState } from 'react'
import { Button, Dropdown, Typography, Input } from 'antd'
import {
  FolderOutlined,
  FolderOpenOutlined,
  MessageOutlined,
  FileOutlined,
  FontSizeOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  StarFilled,
  StarOutlined,
  FolderAddOutlined
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { FavoriteItem, FavoriteFolder } from '../../../../types/type'

const { Text } = Typography

interface FavoriteTreeNodeProps {
  type: 'folder' | 'item'
  data: FavoriteFolder | FavoriteItem
  itemCount?: number
  isEditing?: boolean
  onEdit?: () => void
  onDelete?: () => void
  onClear?: () => void
  onCreate?: (type: 'folder') => void
  onItemClick?: (itemId: string) => void
  onSaveEdit?: (nodeId: string, nodeType: 'folder' | 'item', newValue: string) => void
  onStartEdit?: () => void
  onEndEdit?: () => void
  onTogglePin?: (itemId: string) => void
}

const FavoriteTreeNode = React.memo(function FavoriteTreeNode({
  type,
  data,
  itemCount,
  isEditing,
  onEdit,
  onDelete,
  onClear,
  onCreate,
  onItemClick,
  onSaveEdit,
  onStartEdit,
  onEndEdit,
  onTogglePin
}: FavoriteTreeNodeProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isInlineEditing, setIsInlineEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (type === 'item' && onItemClick) {
      onItemClick(data.id)
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
      const item = data as FavoriteItem
      return [
        {
          key: 'pin',
          label: item.pinned ? '取消置顶' : '置顶',
          icon: item.pinned ? <StarOutlined /> : <StarFilled />,
          onClick: (e) => {
            e?.domEvent?.stopPropagation()
            onTogglePin?.(item.id)
          }
        },
        {
          type: 'divider'
        },
        {
          key: 'delete',
          label: '删除',
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
      const folder = data as FavoriteFolder
      return folder.expanded ? <FolderOpenOutlined /> : <FolderOutlined />
    }
    const item = data as FavoriteItem
    switch (item.type) {
      case 'page':
        return <FileOutlined />
      case 'message':
        return <MessageOutlined />
      case 'text-fragment':
        return <FontSizeOutlined />
      default:
        return <FileOutlined />
    }
  }

  const getName = () => {
    if (type === 'folder') {
      return (data as FavoriteFolder).name
    }
    return (data as FavoriteItem).title
  }

  const item = type === 'item' ? (data as FavoriteItem) : null

  return (
    <div
      className={`tree-node tree-node-${type}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      draggable={false}
      onMouseDown={(e) => {
        if (isInlineEditing) {
          e.stopPropagation()
        }
      }}
    >
      <div className="tree-node-content">
        <div className="tree-node-icon">{getIcon()}</div>
        {item?.pinned && (
          <StarFilled style={{ color: '#faad14', fontSize: '12px', marginRight: '4px' }} />
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
        {type === 'folder' && itemCount !== undefined && (
          <span className="folder-count" style={{ marginLeft: 'auto', color: '#999', fontSize: '12px' }}>
            {itemCount}
          </span>
        )}
      </div>

      {(isHovered || isEditing) && (
        <div className="tree-node-actions">
          {type === 'folder' && onCreate && (
            <Button
              type="text"
              size="small"
              icon={<FolderAddOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                onCreate('folder')
              }}
            />
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
  if (
    prevProps.type !== nextProps.type ||
    prevProps.data.id !== nextProps.data.id ||
    prevProps.isEditing !== nextProps.isEditing ||
    prevProps.itemCount !== nextProps.itemCount
  ) {
    return false
  }

  if (prevProps.type === 'folder') {
    const prevFolder = prevProps.data as FavoriteFolder
    const nextFolder = nextProps.data as FavoriteFolder
    return prevFolder.name === nextFolder.name && prevFolder.expanded === nextFolder.expanded
  } else {
    const prevItem = prevProps.data as FavoriteItem
    const nextItem = nextProps.data as FavoriteItem
    return (
      prevItem.title === nextItem.title &&
      prevItem.pinned === nextItem.pinned &&
      prevItem.type === nextItem.type
    )
  }
})

export default FavoriteTreeNode
