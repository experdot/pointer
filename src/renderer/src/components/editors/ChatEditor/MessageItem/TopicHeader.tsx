/* eslint-disable react/prop-types */
import React, { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import { Button, Input, Tooltip, Dropdown } from 'antd'
import type { InputRef } from 'antd'
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
import type { TopicHeaderProps, TopicHeaderRef } from './types'

export const TopicHeader = React.memo(
  forwardRef<TopicHeaderRef, TopicHeaderProps>(function TopicHeader(
    { topic, topicMessageCount, messageId, topicCallbacks },
    ref
  ): React.JSX.Element {
    // 编辑状态在组件内部管理
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(topic.name)
    const [popoverOpen, setPopoverOpen] = useState(false)
    const inputRef = useRef<InputRef>(null)

    const handleStartEdit = useCallback(() => {
      setEditValue(topic.name)
      setIsEditing(true)
      setTimeout(() => inputRef.current?.focus(), 50)
    }, [topic.name])

    // 暴露 startEdit 方法给父组件
    useImperativeHandle(ref, () => ({
      startEdit: handleStartEdit
    }))

    const handleSave = useCallback(() => {
      const trimmedTopic = editValue.trim()
      if (trimmedTopic) {
        topicCallbacks.onUpdateTopic?.(topic.id, { name: trimmedTopic })
      }
      setIsEditing(false)
    }, [topic.id, editValue, topicCallbacks])

    const handleCancel = useCallback(() => {
      setIsEditing(false)
      setEditValue(topic.name)
    }, [topic.name])

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          handleSave()
        } else if (e.key === 'Escape') {
          handleCancel()
        }
      },
      [handleSave, handleCancel]
    )

    const handlePopoverOpenChange = useCallback((open: boolean) => {
      setPopoverOpen(open)
      if (!open) setIsEditing(false)
    }, [])

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
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={(e) => {
              // 如果点击的是生成按钮或 Popover 内容，不触发 blur 保存
              if (
                e.relatedTarget?.closest('.rename-input__ai-btn') ||
                e.relatedTarget?.closest('.ai-generate-popover__content')
              )
                return
              if (!popoverOpen) {
                handleSave()
              }
            }}
            placeholder="输入 Topic 名称..."
            className="message-item__topic-input"
            suffix={
              topicCallbacks.onGenerateTopic ? (
                <AIGeneratePopover
                  open={popoverOpen}
                  onOpenChange={handlePopoverOpenChange}
                  mode="topic"
                  onGenerate={async (options) => {
                    await topicCallbacks.onGenerateTopic!(messageId, options)
                    handlePopoverOpenChange(false)
                  }}
                  placement="bottomRight"
                >
                  <Tooltip title="AI 生成">
                    <ThunderboltOutlined
                      className="rename-input__ai-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPopoverOpen(true)
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
                    onClick: () => handleStartEdit()
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
)
