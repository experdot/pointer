import React from 'react'
import { Button, Tooltip, Popconfirm } from 'antd'
import {
  CopyOutlined,
  CheckOutlined,
  EditOutlined,
  ReloadOutlined,
  ArrowDownOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import type { MessageActionsProps } from './types'

export const MessageActions = React.memo(function MessageActions({
  isUser,
  isAssistant,
  isLeaf,
  copied,
  onCopy,
  onStartEdit,
  onRetry,
  onContinue,
  onDelete
}: MessageActionsProps): React.JSX.Element {
  return (
    <div className="message-item__actions">
      <Tooltip title={copied ? '已复制' : '复制'}>
        <Button
          type="text"
          size="small"
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          onClick={onCopy}
        />
      </Tooltip>
      <Tooltip title="编辑">
        <Button type="text" size="small" icon={<EditOutlined />} onClick={onStartEdit} />
      </Tooltip>
      {isAssistant && (
        <Tooltip title="重试">
          <Button type="text" size="small" icon={<ReloadOutlined />} onClick={onRetry} />
        </Tooltip>
      )}
      {isUser && isLeaf && (
        <Tooltip title="继续生成">
          <Button type="text" size="small" icon={<ArrowDownOutlined />} onClick={onContinue} />
        </Tooltip>
      )}
      <Popconfirm title="确定删除此消息？" onConfirm={onDelete} okText="删除" cancelText="取消">
        <Tooltip title="删除">
          <Button type="text" size="small" icon={<DeleteOutlined />} />
        </Tooltip>
      </Popconfirm>
    </div>
  )
})
