import React, { useState, useCallback } from 'react'
import { Drawer, Button, Input, List, Popconfirm, Typography, Empty } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ClearOutlined } from '@ant-design/icons'
import type { QueueItem } from '../../../persistence/interfaces/userData'
import './MessageQueueDrawer.css'

const { TextArea } = Input
const { Text } = Typography

interface MessageQueueDrawerProps {
  open: boolean
  items: QueueItem[]
  onClose: () => void
  onAdd: (content: string) => Promise<void>
  onRemove: (itemId: string) => Promise<void>
  onUpdate: (itemId: string, content: string) => Promise<void>
  onClear: () => Promise<void>
}

export function MessageQueueDrawer({
  open,
  items,
  onClose,
  onAdd,
  onRemove,
  onUpdate,
  onClear
}: MessageQueueDrawerProps): React.JSX.Element {
  const [newContent, setNewContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')

  const handleAdd = useCallback(async () => {
    const trimmed = newContent.trim()
    if (!trimmed) return
    await onAdd(trimmed)
    setNewContent('')
  }, [newContent, onAdd])

  const handleStartEdit = useCallback((item: QueueItem) => {
    setEditingId(item.id)
    setEditingContent(item.content)
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return
    const trimmed = editingContent.trim()
    if (trimmed) {
      await onUpdate(editingId, trimmed)
    }
    setEditingId(null)
    setEditingContent('')
  }, [editingId, editingContent, onUpdate])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setEditingContent('')
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleAdd()
      }
    },
    [handleAdd]
  )

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSaveEdit()
      } else if (e.key === 'Escape') {
        handleCancelEdit()
      }
    },
    [handleSaveEdit, handleCancelEdit]
  )

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>消息队列 ({items.length})</span>
          {items.length > 0 && (
            <Popconfirm title="确定清空队列？" onConfirm={onClear} okText="确定" cancelText="取消">
              <Button type="text" danger icon={<ClearOutlined />} size="small">
                清空
              </Button>
            </Popconfirm>
          )}
        </div>
      }
      placement="right"
      onClose={onClose}
      open={open}
      width={400}
    >
      <div className="message-queue-drawer">
        {items.length === 0 ? (
          <Empty description="队列为空" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            className="message-queue-drawer__list"
            dataSource={items}
            renderItem={(item, index) => (
              <List.Item
                className="message-queue-drawer__item"
                actions={
                  editingId === item.id
                    ? [
                        <Button key="save" type="link" size="small" onClick={handleSaveEdit}>
                          保存
                        </Button>,
                        <Button key="cancel" type="link" size="small" onClick={handleCancelEdit}>
                          取消
                        </Button>
                      ]
                    : [
                        <Button
                          key="edit"
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleStartEdit(item)}
                        />,
                        <Popconfirm
                          key="delete"
                          title="确定删除？"
                          onConfirm={() => onRemove(item.id)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      ]
                }
              >
                <div className="message-queue-drawer__item-content">
                  <Text type="secondary" className="message-queue-drawer__item-index">
                    {index + 1}.
                  </Text>
                  {editingId === item.id ? (
                    <TextArea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      autoSize={{ minRows: 1, maxRows: 4 }}
                      autoFocus
                    />
                  ) : (
                    <Text
                      className="message-queue-drawer__item-text"
                      ellipsis={{ tooltip: item.content }}
                    >
                      {item.content}
                    </Text>
                  )}
                </div>
              </List.Item>
            )}
          />
        )}

        <div className="message-queue-drawer__add">
          <TextArea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="添加新消息到队列..."
            autoSize={{ minRows: 1, maxRows: 3 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            disabled={!newContent.trim()}
          >
            添加
          </Button>
        </div>
      </div>
    </Drawer>
  )
}
