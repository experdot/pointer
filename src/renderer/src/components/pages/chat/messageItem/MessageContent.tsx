import React, { useState } from 'react'
import { Card, Collapse, Dropdown, Typography, Button } from 'antd'
import { BulbOutlined, CopyOutlined } from '@ant-design/icons'
import { Markdown } from '../../../common/markdown/Markdown'
import SearchableMarkdown from '../../../common/markdown/SearchableMarkdown'

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
  currentMatchIndex
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <>
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
