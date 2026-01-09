import React, { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import { Input, Tooltip } from 'antd'
import type { InputRef } from 'antd'
import { TagOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { AIGeneratePopover } from '../../../common/AIGeneratePopover'
import type { TitleRowProps, TitleRowRef } from './types'

export const TitleRow = React.memo(
  forwardRef<TitleRowRef, TitleRowProps>(function TitleRow(
    { messageId, title, titleCallbacks },
    ref
  ): React.JSX.Element | null {
    // 编辑状态在组件内部管理
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(title || '')
    const [popoverOpen, setPopoverOpen] = useState(false)
    const inputRef = useRef<InputRef>(null)

    const handleStartEdit = useCallback(() => {
      setEditValue(title || '')
      setIsEditing(true)
      setTimeout(() => inputRef.current?.focus(), 50)
    }, [title])

    // 暴露 startEdit 方法给父组件
    useImperativeHandle(ref, () => ({
      startEdit: handleStartEdit
    }))

    const handleSave = useCallback(() => {
      const trimmedTitle = editValue.trim()
      titleCallbacks.onUpdateTitle?.(messageId, trimmedTitle)
      setIsEditing(false)
    }, [messageId, editValue, titleCallbacks])

    const handleCancel = useCallback(() => {
      setIsEditing(false)
      setEditValue(title || '')
    }, [title])

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

    if (!isEditing && !title) {
      return null
    }

    return (
      <div className="message-item__title-row">
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
            placeholder="输入标题..."
            style={{ width: 180 }}
            suffix={
              titleCallbacks.onGenerateTitle ? (
                <AIGeneratePopover
                  open={popoverOpen}
                  onOpenChange={handlePopoverOpenChange}
                  mode="title"
                  onGenerate={async (options) => {
                    await titleCallbacks.onGenerateTitle!(messageId, options)
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
          <Tooltip title="点击编辑标题">
            <span className="message-item__title" onClick={handleStartEdit}>
              <TagOutlined />
              {title}
            </span>
          </Tooltip>
        )}
      </div>
    )
  })
)
