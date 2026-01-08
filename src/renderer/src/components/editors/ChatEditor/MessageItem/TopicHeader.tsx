import React from 'react'
import { Button, Input, Tooltip, Dropdown } from 'antd'
import {
  RightOutlined,
  DownOutlined,
  FolderOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import { AIGeneratePopover } from '../../../common/AIGeneratePopover'
import type { TopicHeaderProps } from './types'

export const TopicHeader = React.memo(function TopicHeader({
  topic,
  topicMessageCount,
  messageId,
  isEditing,
  editValue,
  popoverOpen,
  inputRef,
  onEditValueChange,
  onStartEdit,
  onSave,
  onKeyDown,
  onPopoverOpenChange,
  topicCallbacks
}: TopicHeaderProps): React.JSX.Element {
  return (
    <div
      className={`message-item__topic-header ${topic.collapsed ? 'message-item__topic-header--collapsed' : ''}`}
    >
      <Button
        type="text"
        size="small"
        className="message-item__topic-toggle"
        icon={topic.collapsed ? <RightOutlined /> : <DownOutlined />}
        onClick={() => topicCallbacks.onToggleTopicCollapse?.(topic.id)}
      />
      <FolderOutlined className="message-item__topic-icon" />
      {isEditing ? (
        <Input
          ref={inputRef}
          size="small"
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={(e) => {
            // 如果点击的是生成按钮或 Popover 内容，不触发 blur 保存
            if (
              e.relatedTarget?.closest('.rename-input__ai-btn') ||
              e.relatedTarget?.closest('.ai-generate-popover__content')
            )
              return
            if (!popoverOpen) {
              onSave()
            }
          }}
          placeholder="输入 Topic 名称..."
          className="message-item__topic-input"
          suffix={
            topicCallbacks.onGenerateTopic ? (
              <AIGeneratePopover
                open={popoverOpen}
                onOpenChange={(open) => {
                  onPopoverOpenChange(open)
                }}
                mode="topic"
                onGenerate={async (options) => {
                  await topicCallbacks.onGenerateTopic!(messageId, options)
                  onPopoverOpenChange(false)
                }}
                placement="bottomRight"
              >
                <Tooltip title="AI 生成">
                  <ThunderboltOutlined
                    className="rename-input__ai-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onPopoverOpenChange(true)
                    }}
                  />
                </Tooltip>
              </AIGeneratePopover>
            ) : undefined
          }
        />
      ) : (
        <>
          <span className="message-item__topic-name">{topic.name}</span>
          {topicMessageCount !== undefined && (
            <span className="message-item__topic-count">({topicMessageCount})</span>
          )}
          <Dropdown
            menu={{
              items: [
                {
                  key: 'rename',
                  label: '重命名',
                  icon: <EditOutlined />,
                  onClick: () => onStartEdit()
                },
                { type: 'divider' },
                {
                  key: 'delete',
                  label: '删除',
                  icon: <DeleteOutlined />,
                  danger: true,
                  onClick: () => topicCallbacks.onDeleteTopic?.(topic.id)
                }
              ]
            }}
            trigger={['click']}
          >
            <Button
              type="text"
              size="small"
              className="message-item__topic-more"
              icon={<MoreOutlined />}
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        </>
      )}
    </div>
  )
})
