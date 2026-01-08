import React from 'react'
import { Input, Tooltip } from 'antd'
import { TagOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { AIGeneratePopover } from '../../../common/AIGeneratePopover'
import type { TitleRowProps } from './types'

export const TitleRow = React.memo(function TitleRow({
  messageId,
  title,
  isEditing,
  editValue,
  popoverOpen,
  inputRef,
  onEditValueChange,
  onStartEdit,
  onSave,
  onKeyDown,
  onPopoverOpenChange,
  titleCallbacks
}: TitleRowProps): React.JSX.Element | null {
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
          placeholder="输入标题..."
          style={{ width: 180 }}
          suffix={
            titleCallbacks.onGenerateTitle ? (
              <AIGeneratePopover
                open={popoverOpen}
                onOpenChange={(open) => {
                  onPopoverOpenChange(open)
                }}
                mode="title"
                onGenerate={async (options) => {
                  await titleCallbacks.onGenerateTitle!(messageId, options)
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
        <Tooltip title="点击编辑标题">
          <span className="message-item__title" onClick={onStartEdit}>
            <TagOutlined />
            {title}
          </span>
        </Tooltip>
      )}
    </div>
  )
})
