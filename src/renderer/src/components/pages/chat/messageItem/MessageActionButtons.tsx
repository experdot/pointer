import React from 'react'
import { Button, Tooltip, Dropdown, type MenuProps } from 'antd'
import {
  CopyOutlined,
  PictureOutlined,
  StarOutlined,
  StarFilled,
  EditOutlined,
  RedoOutlined,
  SendOutlined,
  DeleteOutlined,
  MoreOutlined,
  HeartOutlined
} from '@ant-design/icons'

interface MessageActionButtonsProps {
  role: string
  starred: boolean
  isCurrentlyStreaming: boolean
  isEditing: boolean
  hasChildren: boolean
  isLoading: boolean
  onCopy: () => void
  onCopyAsImage: () => void
  onToggleStar: () => void
  onAddToFavorites?: () => void
  onEdit: () => void
  onRetry?: () => void
  onContinue?: () => void
  onDelete?: () => void
}

export const MessageActionButtons: React.FC<MessageActionButtonsProps> = ({
  role,
  starred,
  isCurrentlyStreaming,
  isEditing,
  hasChildren,
  isLoading,
  onCopy,
  onCopyAsImage,
  onToggleStar,
  onAddToFavorites,
  onEdit,
  onRetry,
  onContinue,
  onDelete
}) => {
  // 构建下拉菜单项
  const menuItems: MenuProps['items'] = []

  // 添加"添加到收藏"选项
  if (onAddToFavorites) {
    menuItems.push({
      key: 'addToFavorites',
      label: '添加到收藏',
      icon: <HeartOutlined />,
      onClick: onAddToFavorites,
      disabled: isCurrentlyStreaming
    })
  }

  return (
    <div className="message-action-buttons">
      <Tooltip title="复制">
        <Button
          type="text"
          size="small"
          icon={<CopyOutlined />}
          onClick={onCopy}
          disabled={isCurrentlyStreaming}
        />
      </Tooltip>
      <Tooltip title="复制为图片">
        <Button
          type="text"
          size="small"
          icon={<PictureOutlined />}
          onClick={onCopyAsImage}
          disabled={isCurrentlyStreaming}
        />
      </Tooltip>
      <Tooltip title="星标">
        <Button
          type="text"
          size="small"
          icon={starred ? <StarFilled /> : <StarOutlined />}
          onClick={onToggleStar}
          className={starred ? 'starred' : ''}
          disabled={isCurrentlyStreaming}
        />
      </Tooltip>
      {!isEditing && (
        <Tooltip title="编辑">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={onEdit}
            disabled={isCurrentlyStreaming}
          />
        </Tooltip>
      )}
      {role === 'assistant' && onRetry && (
        <Tooltip title="重试">
          <Button
            type="text"
            size="small"
            icon={<RedoOutlined />}
            onClick={onRetry}
            disabled={isLoading || isCurrentlyStreaming}
          />
        </Tooltip>
      )}
      {role === 'user' && onContinue && !hasChildren && (
        <Tooltip title="继续">
          <Button
            type="text"
            size="small"
            icon={<SendOutlined />}
            onClick={onContinue}
            disabled={isLoading || isCurrentlyStreaming}
          />
        </Tooltip>
      )}
      {onDelete && (
        <Tooltip title="删除">
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            onClick={onDelete}
            className="message-delete-btn"
          />
        </Tooltip>
      )}
      {menuItems.length > 0 && (
        <Dropdown menu={{ items: menuItems }} trigger={['click']}>
          <Button
            type="text"
            size="small"
            icon={<MoreOutlined />}
            disabled={isCurrentlyStreaming}
          />
        </Dropdown>
      )}
    </div>
  )
}
