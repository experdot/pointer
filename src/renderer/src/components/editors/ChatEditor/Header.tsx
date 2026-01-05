import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Input, type InputRef } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { updatePage } from '../../../services/pagesService'
import type { ChatPage } from '../../../types/type'

interface HeaderProps {
  page: ChatPage
}

export function Header({ page }: HeaderProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(page.title)
  const inputRef = useRef<InputRef>(null)

  // 同步外部 title 变化
  useEffect(() => {
    if (!isEditing) {
      setEditValue(page.title)
    }
  }, [page.title, isEditing])

  // 进入编辑模式时聚焦输入框
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  const handleEdit = useCallback(() => {
    setEditValue(page.title)
    setIsEditing(true)
  }, [page.title])

  const handleSave = useCallback(async () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== page.title) {
      await updatePage(page.id, { title: trimmed })
    }
    setIsEditing(false)
  }, [editValue, page.id, page.title])

  const handleCancel = useCallback(() => {
    setEditValue(page.title)
    setIsEditing(false)
  }, [page.title])

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

  return (
    <div className="chat-editor__header">
      {isEditing ? (
        <Input
          ref={inputRef}
          className="chat-editor__title-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          size="small"
        />
      ) : (
        <div className="chat-editor__title-wrapper">
          <span className="chat-editor__title">{page.title}</span>
          <EditOutlined className="chat-editor__title-edit" onClick={handleEdit} />
        </div>
      )}
    </div>
  )
}
