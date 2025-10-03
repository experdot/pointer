import React from 'react'
import { Button, Tooltip } from 'antd'
import {
  CopyOutlined,
  PictureOutlined,
  StarOutlined,
  StarFilled,
  EditOutlined,
  RedoOutlined,
  SendOutlined,
  DeleteOutlined
} from '@ant-design/icons'

interface MessageActionButtonsProps {
  role: string
  isFavorited: boolean
  isCurrentlyStreaming: boolean
  isEditing: boolean
  hasChildren: boolean
  isLoading: boolean
  onCopy: () => void
  onCopyAsImage: () => void
  onToggleFavorite: () => void
  onEdit: () => void
  onRetry?: () => void
  onContinue?: () => void
  onDelete?: () => void
}

export const MessageActionButtons: React.FC<MessageActionButtonsProps> = ({
  role,
  isFavorited,
  isCurrentlyStreaming,
  isEditing,
  hasChildren,
  isLoading,
  onCopy,
  onCopyAsImage,
  onToggleFavorite,
  onEdit,
  onRetry,
  onContinue,
  onDelete
}) => {
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
      <Tooltip title="收藏">
        <Button
          type="text"
          size="small"
          icon={isFavorited ? <StarFilled /> : <StarOutlined />}
          onClick={onToggleFavorite}
          className={isFavorited ? 'favorited' : ''}
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
    </div>
  )
}
