import React, { useState } from 'react'
import { Button, Dropdown, Typography, Input, Modal, TreeSelect } from 'antd'
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
  FolderAddOutlined,
  FolderOpenFilled
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
  onToggleStar?: (itemId: string) => void
  onMoveTo?: (targetFolderId: string | undefined) => void
  allFolders?: FavoriteFolder[]
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
  onToggleStar,
  onMoveTo,
  allFolders = []
}: FavoriteTreeNodeProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isInlineEditing, setIsInlineEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [selectedTargetFolder, setSelectedTargetFolder] = useState<string | undefined>(undefined)

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

  const handleShowMoveModal = () => {
    // 初始化选中值为当前所在的文件夹
    if (type === 'folder') {
      const parentId = (data as FavoriteFolder).parentId
      setSelectedTargetFolder(parentId === undefined ? 'ROOT' : parentId)
    } else {
      const folderId = (data as FavoriteItem).folderId
      setSelectedTargetFolder(folderId === undefined ? 'ROOT' : folderId)
    }

    setShowMoveModal(true)
  }

  const handleConfirmMove = () => {
    if (onMoveTo) {
      // 将'ROOT'转换为undefined表示根目录
      const targetFolder = selectedTargetFolder === 'ROOT' ? undefined : selectedTargetFolder
      onMoveTo(targetFolder)
    }
    setShowMoveModal(false)
  }

  const handleCancelMove = () => {
    setShowMoveModal(false)
    setSelectedTargetFolder(undefined)
  }

  // 构建文件夹树数据（用于TreeSelect）
  const buildFolderTreeData = () => {
    const buildTree = (parentId?: string): any[] => {
      const children = allFolders
        .filter(folder => {
          // 过滤掉当前节点（不能移动到自己）
          if (type === 'folder' && folder.id === data.id) {
            return false
          }
          // 如果是文件夹，还要过滤掉所有子文件夹（防止循环引用）
          if (type === 'folder') {
            let current = folder
            while (current.parentId) {
              if (current.parentId === data.id) {
                return false
              }
              current = allFolders.find(f => f.id === current.parentId)!
              if (!current) break
            }
          }
          return folder.parentId === parentId
        })
        .sort((a, b) => (a.order || 0) - (b.order || 0))

      return children.map(folder => ({
        title: folder.name,
        value: folder.id,
        children: buildTree(folder.id)
      }))
    }

    return buildTree()
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
          key: 'moveTo',
          label: '移动至...',
          icon: <FolderOpenFilled />,
          onClick: (e) => {
            e?.domEvent?.stopPropagation()
            handleShowMoveModal()
          }
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
          key: 'star',
          label: item.starred ? '取消星标' : '标记为星标',
          icon: item.starred ? <StarFilled /> : <StarOutlined />,
          onClick: (e) => {
            e?.domEvent?.stopPropagation()
            onToggleStar?.(item.id)
          }
        },
        {
          type: 'divider'
        },
        {
          key: 'rename',
          label: '重命名',
          icon: <EditOutlined />,
          onClick: () => startInlineEdit()
        },
        {
          key: 'moveTo',
          label: '移动至...',
          icon: <FolderOpenFilled />,
          onClick: (e) => {
            e?.domEvent?.stopPropagation()
            handleShowMoveModal()
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
        {item?.starred && (
          <StarFilled style={{ color: '#faad14', fontSize: '12px' }} />
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

      {/* 移动到文件夹的模态框 */}
      <Modal
        title={`移动${type === 'folder' ? '文件夹' : '收藏项'}至...`}
        open={showMoveModal}
        onOk={handleConfirmMove}
        onCancel={handleCancelMove}
        okText="确定"
        cancelText="取消"
        destroyOnClose
        key={showMoveModal ? `modal-${allFolders.length}` : 'modal-closed'}
      >
        <div style={{ marginBottom: 16 }}>
          <TreeSelect
            style={{ width: '100%' }}
            value={selectedTargetFolder}
            dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
            placeholder="选择目标文件夹"
            allowClear
            treeDefaultExpandAll
            treeData={[
              {
                title: '根目录',
                value: 'ROOT',
                selectable: true,
                children: buildFolderTreeData()
              }
            ]}
            onChange={(value) => setSelectedTargetFolder(value === 'ROOT' ? undefined : value)}
          />
        </div>
        <div style={{ color: '#666', fontSize: '12px' }}>
          {type === 'folder'
            ? '注意：不能将文件夹移动到自身或其子文件夹中'
            : '提示：选择目标文件夹后，收藏项将被移动到该文件夹中'}
        </div>
      </Modal>
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
      prevItem.starred === nextItem.starred &&
      prevItem.type === nextItem.type
    )
  }
})

export default FavoriteTreeNode
