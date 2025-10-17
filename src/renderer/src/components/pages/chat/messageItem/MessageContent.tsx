import React, { useState } from 'react'
import { Card, Collapse, Dropdown, Typography, Button, Image, Space } from 'antd'
import { BulbOutlined, CopyOutlined, FileImageOutlined } from '@ant-design/icons'
import { Markdown } from '../../../common/markdown/Markdown'
import SearchableMarkdown from '../../../common/markdown/SearchableMarkdown'
import { FileAttachment } from '../../../../types/type'

const { Text } = Typography

interface MessageContentProps {
  currentContent: string
  currentReasoningContent?: string
  isCurrentlyStreaming: boolean
  reasoningExpanded: string[]
  onReasoningExpandChange: (keys: string | string[]) => void
  contextMenuItems: any[] | (() => any[])
  searchQuery?: string
  messageId: string
  getCurrentMatch?: () => { messageId: string; startIndex: number; endIndex: number } | null
  getHighlightInfo?: (
    text: string,
    messageId: string
  ) => { text: string; highlights: Array<{ start: number; end: number; isCurrentMatch: boolean }> }
  currentMatchIndex?: number
  attachments?: FileAttachment[]
}

export const MessageContent: React.FC<MessageContentProps> = ({
  currentContent,
  currentReasoningContent,
  isCurrentlyStreaming,
  reasoningExpanded,
  onReasoningExpandChange,
  contextMenuItems,
  searchQuery,
  messageId,
  getCurrentMatch,
  getHighlightInfo,
  currentMatchIndex,
  attachments
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <>
      {/* 文件附件显示 */}
      {attachments && attachments.length > 0 && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              style={{
                position: 'relative',
                display: 'inline-block',
                border: '1px solid #d9d9d9',
                borderRadius: 4,
                padding: 4,
                background: '#fafafa'
              }}
            >
              {attachment.type.startsWith('image/') && attachment.url ? (
                <div>
                  <Image
                    src={attachment.url}
                    alt={attachment.name}
                    width={120}
                    height={120}
                    style={{ objectFit: 'cover', borderRadius: 2 }}
                    preview={{
                      mask: <div style={{ fontSize: 12 }}>预览</div>
                    }}
                  />
                  <div style={{ fontSize: 11, marginTop: 4, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {attachment.name}
                  </div>
                </div>
              ) : (
                <Space>
                  <FileImageOutlined />
                  <span style={{ fontSize: 12 }}>{attachment.name}</span>
                </Space>
              )}
            </div>
          ))}
        </div>
      )}

      {currentReasoningContent && (
        <Card size="small" className="message-reasoning-card" style={{ marginBottom: 8 }}>
          <Collapse
            size="small"
            ghost
            activeKey={reasoningExpanded}
            onChange={onReasoningExpandChange}
            items={[
              {
                key: 'reasoning_content',
                label: (
                  <Text type="secondary">
                    <BulbOutlined style={{ marginRight: 4 }} />
                    思考过程
                  </Text>
                ),
                children: (
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'copy-reasoning',
                          label: '复制思考过程',
                          icon: <CopyOutlined />,
                          onClick: () =>
                            navigator.clipboard.writeText(currentReasoningContent || '')
                        }
                      ]
                    }}
                    trigger={['contextMenu']}
                    disabled={isCurrentlyStreaming}
                  >
                    <div
                      style={{
                        marginBottom: 0,
                        color: '#666',
                        backgroundColor: '#fafafa',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: '1px solid #f0f0f0',
                        userSelect: 'text',
                        cursor: 'text'
                      }}
                    >
                      <Markdown content={currentReasoningContent ?? ''} />
                    </div>
                  </Dropdown>
                )
              }
            ]}
          />
        </Card>
      )}

      <Card size="small" className="message-card">
        <Dropdown
          open={dropdownOpen}
          onOpenChange={setDropdownOpen}
          menu={{
            items: typeof contextMenuItems === 'function' ? contextMenuItems() : contextMenuItems
          }}
          trigger={['contextMenu']}
          disabled={isCurrentlyStreaming}
        >
          <div
            style={{
              marginBottom: 0,
              userSelect: 'text',
              cursor: 'text'
            }}
          >
            <SearchableMarkdown
              content={currentContent ?? ''}
              loading={isCurrentlyStreaming && !currentContent}
              searchQuery={searchQuery}
              messageId={messageId}
              getCurrentMatch={getCurrentMatch}
              getHighlightInfo={getHighlightInfo}
              currentMatchIndex={currentMatchIndex}
            />
          </div>
        </Dropdown>
      </Card>
    </>
  )
}
