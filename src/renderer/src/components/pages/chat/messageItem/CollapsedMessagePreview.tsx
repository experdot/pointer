import React from 'react'
import { Card, Typography } from 'antd'
import { BulbOutlined } from '@ant-design/icons'

const { Text } = Typography

interface CollapsedMessagePreviewProps {
  content: string
  hasReasoningContent: boolean
}

const getPreviewText = (content: string, maxLength: number = 80): string => {
  if (!content) return '消息已折叠，点击展开按钮查看内容'

  const cleanContent = content
    .replace(/[#*_`~\[\]]/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (cleanContent.length <= maxLength) {
    return cleanContent
  }

  const truncated = cleanContent.slice(0, maxLength)
  const lastSpaceIndex = truncated.lastIndexOf(' ')

  if (lastSpaceIndex > maxLength * 0.8) {
    return truncated.slice(0, lastSpaceIndex) + '...'
  }

  return truncated + '...'
}

export const CollapsedMessagePreview: React.FC<CollapsedMessagePreviewProps> = ({
  content,
  hasReasoningContent
}) => {
  return (
    <Card size="small" className="message-card message-collapsed">
      <div className="message-preview">
        <Text type="secondary" className="message-preview-text">
          {getPreviewText(content)}
        </Text>
        {hasReasoningContent && (
          <Text type="secondary" className="message-preview-reasoning">
            <BulbOutlined style={{ marginRight: 4 }} />
            含思考过程
          </Text>
        )}
      </div>
    </Card>
  )
}
