import React, { useState, useEffect, useRef } from 'react'
import { Input } from 'antd'

interface InlineEditorProps {
  initialValue: string
  onSave: (value: string) => void
  onCancel: () => void
  placeholder?: string
}

export default function InlineEditor({
  initialValue,
  onSave,
  onCancel,
  placeholder = '请输入名称'
}: InlineEditorProps) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<any>(null)

  useEffect(() => {
    setValue(initialValue)
    // Focus and select all text when editing starts
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [initialValue])

  const handleSave = () => {
    onSave(value)
  }

  const handleCancel = () => {
    setValue(initialValue)
    onCancel()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <Input
      ref={inputRef}
      size="small"
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: '#fff',
        border: '1px solid #d9d9d9',
        borderRadius: '4px'
      }}
    />
  )
}
