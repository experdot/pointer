import React, { useState } from 'react'
import { Button, Dropdown, Typography, Input, Tag } from 'antd'
import {
  EditOutlined,
  DeleteOutlined,
  ClearOutlined,
  MoreOutlined,
  CommentOutlined,
  FileTextOutlined,
  CalendarOutlined,
  ApiOutlined
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { ObjectNode as ObjectNodeType } from '../../../types/type'

const { Text } = Typography

interface ObjectTreeNodeProps {
  node: ObjectNodeType
  isSelected?: boolean
  isRoot?: boolean
  onEdit?: () => void
  onDelete?: () => void
  onClearChildren?: () => void
  onSaveEdit?: (nodeId: string, newValue: string) => void
  onCreateChat?: (nodeId: string, nodeName: string) => void
}

export default function ObjectTreeNode({
  node,
  isSelected,
  isRoot,
  onEdit,
  onDelete,
  onClearChildren,
  onSaveEdit,
  onCreateChat
}: ObjectTreeNodeProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isInlineEditing, setIsInlineEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  // 获取节点类型图标
  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'entity':
        return <FileTextOutlined />
      case 'event':
        return <CalendarOutlined />
      case 'relation':
        return <ApiOutlined />
      default:
        return <FileTextOutlined />
    }
  }

  // 获取节点类型颜色
  const getNodeTypeColor = (type: string) => {
    switch (type) {
      case 'entity':
        return '#1890ff'
      case 'event':
        return '#52c41a'
      case 'relation':
        return '#722ed1'
      default:
        return '#1890ff'
    }
  }

  // 获取节点类型标签颜色
  const getNodeTypeTagColor = (type: string) => {
    switch (type) {
      case 'entity':
        return 'blue'
      case 'event':
        return 'green'
      case 'relation':
        return 'purple'
      default:
        return 'default'
    }
  }

  // 获取节点类型标签文本
  const getNodeTypeTagText = (type: string) => {
    switch (type) {
      case 'entity':
        return '实体'
      case 'event':
        return '事件'
      case 'relation':
        return '关系'
      default:
        return type || '未知'
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    startInlineEdit()
  }

  const startInlineEdit = () => {
    setEditValue(node.name)
    setIsInlineEditing(true)
  }

  const handleSaveEdit = () => {
    if (editValue.trim() && onSaveEdit) {
      onSaveEdit(node.id, editValue.trim())
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
    const items: MenuProps['items'] = [
      {
        key: 'edit',
        label: '编辑节点',
        icon: <EditOutlined />,
        onClick: () => startInlineEdit()
      }
    ]

    if (onCreateChat) {
      items.push({
        key: 'chat',
        label: '创建对话',
        icon: <CommentOutlined />,
        onClick: (e) => {
          e?.domEvent?.stopPropagation()
          onCreateChat(node.id, node.name)
        }
      })
    }

    if (!isRoot) {
      items.push({
        key: 'delete',
        label: '删除节点',
        icon: <DeleteOutlined />,
        danger: true,
        onClick: (e) => {
          e?.domEvent?.stopPropagation()
          onDelete?.()
        }
      })
    }

    if (node.children && node.children.length > 0) {
      items.push(
        {
          type: 'divider'
        },
        {
          key: 'clearChildren',
          label: '清空子节点',
          icon: <ClearOutlined />,
          onClick: (e) => {
            e?.domEvent?.stopPropagation()
            onClearChildren?.()
          }
        }
      )
    }

    return items
  }

  return (
    <div
      className="tree-node"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={handleDoubleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        minWidth: 0,
        overflow: 'hidden',
        padding: '4px 8px',
        borderRadius: '4px',
        transition: 'all 0.2s',
        backgroundColor: isSelected ? '#e6f7ff' : isHovered ? '#f5f5f5' : 'transparent'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          minWidth: 0,
          gap: 8
        }}
      >
        <span
          style={{
            fontSize: '14px',
            flexShrink: 0,
            color: getNodeTypeColor(node.type || 'entity')
          }}
        >
          {getNodeIcon(node.type || 'entity')}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Text
                style={{
                  fontWeight: isSelected ? 'bold' : 'normal',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                  flexShrink: 1
                }}
              >
                {node.name}
              </Text>
              <Tag
                color={getNodeTypeTagColor(node.type || 'entity')}
                style={{
                  fontSize: '10px',
                  padding: '0 4px',
                  lineHeight: '16px',
                  height: '16px',
                  borderRadius: '2px',
                  marginLeft: 'auto',
                  flexShrink: 0
                }}
              >
                {getNodeTypeTagText(node.type || 'entity')}
              </Tag>
            </div>
          )}
        </div>
      </div>

      {isHovered && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.2s'
          }}
        >
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
