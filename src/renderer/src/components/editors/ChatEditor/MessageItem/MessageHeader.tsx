import React from 'react'
import { Button, Tooltip } from 'antd'
import { DownOutlined, UpOutlined } from '@ant-design/icons'
import { BranchNavigator } from '../BranchNavigator'
import { ModelSelector } from '../ModelSelector'
import { ModelConfigSelector } from '../ModelConfigSelector'
import { formatTime } from './utils'
import type { MessageHeaderProps } from './types'

export const MessageHeader = React.memo(function MessageHeader({
  message,
  isUser,
  isAssistant,
  isStreaming,
  branchIndex,
  branchCount,
  siblings,
  onToggleCollapse,
  onRetry,
  onSwitchBranch
}: MessageHeaderProps): React.JSX.Element {
  return (
    <div className="message-item__header">
      <span className="message-item__role">{isUser ? '你' : 'AI'}</span>
      <span className="message-item__time">{formatTime(message.createdAt)}</span>

      {/* 折叠按钮 */}
      <Tooltip title={message.collapsed ? '展开' : '折叠'}>
        <Button
          type="text"
          size="small"
          className="message-item__collapse-btn"
          icon={message.collapsed ? <DownOutlined /> : <UpOutlined />}
          onClick={() => onToggleCollapse?.(message.id)}
        />
      </Tooltip>

      {/* 模型选择器 - assistant 消息 */}
      {isAssistant && (
        <ModelSelector
          value={message.modelId}
          onChange={(llmId) => onRetry(message.id, llmId)}
          disabled={isStreaming}
        />
      )}

      {/* 模型配置选择器 - assistant 消息 */}
      {isAssistant && (
        <ModelConfigSelector
          value={message.modelConfigId}
          onChange={(modelConfigId) => onRetry(message.id, undefined, modelConfigId)}
          disabled={isStreaming}
        />
      )}

      {/* 分支导航 - 仅在有多个分支时显示 */}
      {branchCount > 1 && (
        <BranchNavigator
          currentIndex={branchIndex}
          totalCount={branchCount}
          siblings={siblings}
          onSwitchBranch={onSwitchBranch}
        />
      )}
    </div>
  )
})
