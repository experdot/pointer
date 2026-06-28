import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Input, Tooltip, type InputRef } from 'antd'
import { EditOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { updatePage } from '../../../services/pagesService'
import { AIGeneratePopover, type GenerateOptions } from '../../common/AIGeneratePopover'
import type { ChatPage } from '../../../types/type'
import './Header.css'

interface HeaderProps {
  page: ChatPage
  onGenerate?: (options: GenerateOptions) => Promise<void>
}

export function Header({ page, onGenerate }: HeaderProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(page.name)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const inputRef = useRef<InputRef>(null)

  // 同步外部 name 变化
  useEffect(() => {
    if (!isEditing) {
      setEditValue(page.name)
    }
  }, [page.name, isEditing])

  // 进入编辑模式时聚焦输入框
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  const handleEdit = useCallback(() => {
    setEditValue(page.name)
    setIsEditing(true)
  }, [page.name])

  const handleSave = useCallback(async () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== page.name) {
      await updatePage(page.id, { name: trimmed })
    }
    setIsEditing(false)
  }, [editValue, page.id, page.name])

  const handleCancel = useCallback(() => {
    setEditValue(page.name)
    setIsEditing(false)
  }, [page.name])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSave()
      } else if (e.key === 'Escape') {
        handleCancel()
      }
    },
    [handleSave, handleCancel]
  )

  const handleAIGenerate = useCallback(
    async (options: GenerateOptions) => {
      if (onGenerate) {
        await onGenerate(options)
      }
      setIsEditing(false)
    },
    [onGenerate]
  )

  const handlePopoverOpenChange = useCallback((open: boolean) => {
    setPopoverOpen(open)
    if (!open) {
      // Popover 关闭时退出编辑模式
      setIsEditing(false)
    }
  }, [])

  return (
    <div className="chat-editor__header">
      {isEditing ? (
        <Input
          ref={inputRef}
          className="chat-editor__title-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
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
          onKeyDown={handleKeyDown}
          size="small"
          suffix={
            onGenerate ? (
              <AIGeneratePopover
                open={popoverOpen}
                onOpenChange={handlePopoverOpenChange}
                mode="session-title"
                onGenerate={handleAIGenerate}
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
        <div className="chat-editor__title-wrapper">
          <span className="chat-editor__title">{page.name}</span>
          <EditOutlined className="chat-editor__title-edit" onClick={handleEdit} />
        </div>
      )}
    </div>
  )
}
