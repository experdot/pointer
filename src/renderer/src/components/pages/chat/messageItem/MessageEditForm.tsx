import React from 'react'
import { Card, Input, Button, Space } from 'antd'
import { CheckOutlined, CloseOutlined, SendOutlined } from '@ant-design/icons'

const { TextArea } = Input

interface MessageEditFormProps {
  editContent: string
  isUserMessage: boolean
  isLoading: boolean
  onContentChange: (content: string) => void
  onSave: () => void
  onSaveAndResend: () => void
  onCancel: () => void
  containerRef: React.RefObject<HTMLDivElement>
}

export const MessageEditForm: React.FC<MessageEditFormProps> = ({
  editContent,
  isUserMessage,
  isLoading,
  onContentChange,
  onSave,
  onSaveAndResend,
  onCancel,
  containerRef
}) => {
  return (
    <Card size="small" className="message-card">
      <div className="message-edit-container" ref={containerRef}>
        <TextArea
          value={editContent}
          onChange={(e) => onContentChange(e.target.value)}
          autoSize={{ minRows: 2, maxRows: 16 }}
          placeholder="编辑消息内容..."
        />
        <div className="message-edit-actions">
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={onSave}
              disabled={!editContent.trim()}
            >
              保存
            </Button>
            {isUserMessage && (
              <Button
                type="primary"
                size="small"
                icon={<SendOutlined />}
                onClick={onSaveAndResend}
                disabled={!editContent.trim() || isLoading}
                ghost
              >
                保存并重发
              </Button>
            )}
            <Button size="small" icon={<CloseOutlined />} onClick={onCancel}>
              取消
            </Button>
          </Space>
        </div>
      </div>
    </Card>
  )
}
