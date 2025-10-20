import React, { useState, useMemo } from 'react'
import { Avatar, Badge, Button, Collapse, List, Tag, Typography } from 'antd'
import {
  CaretRightOutlined,
  FileTextOutlined,
  UserOutlined,
  RobotOutlined
} from '@ant-design/icons'
import { SearchResult } from '../../../../types/type'
import RelativeTime from '../../../common/RelativeTime'

const { Text, Paragraph } = Typography
const { Panel } = Collapse

interface SearchResultGroupProps {
  chatId: string
  chatTitle: string
  results: SearchResult[]
  onResultClick: (result: SearchResult) => void
  expandedGroups: Set<string>
  onToggleGroup: (chatId: string) => void
}

const SearchResultGroup = React.memo(function SearchResultGroup({
  chatId,
  chatTitle,
  results,
  onResultClick,
  expandedGroups,
  onToggleGroup
}: SearchResultGroupProps) {
  const isExpanded = expandedGroups.has(chatId)
  const [displayCount, setDisplayCount] = useState(10)
  const INITIAL_DISPLAY_COUNT = 10
  const INCREMENT_COUNT = 10

  // 当分组折叠时，重置显示数量
  React.useEffect(() => {
    if (!isExpanded) {
      setDisplayCount(INITIAL_DISPLAY_COUNT)
    }
  }, [isExpanded])

  // 高亮搜索词
  const highlightText = (text: string, indices: number[]) => {
    if (!indices || indices.length < 2) return text

    const [start, end] = indices
    return (
      <>
        {text.substring(0, start)}
        <mark className="search-highlight">{text.substring(start, end)}</mark>
        {text.substring(end)}
      </>
    )
  }

  const renderResultItem = (result: SearchResult, index: number) => {
    const { message, snippet, highlightIndices } = result

    return (
      <div
        key={`${result.id}-${index}`}
        className="search-result-item"
        onClick={() => onResultClick(result)}
      >
        <div className="result-item-content">
          <div className="result-item-header">
            <Avatar
              size={20}
              icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
              style={{
                backgroundColor: message.role === 'user' ? '#52c41a' : '#1677ff',
                marginRight: 8
              }}
            />
            <Tag
              color={message.role === 'user' ? 'green' : 'blue'}
              style={{ fontSize: '11px', padding: '0 4px', marginRight: 8 }}
            >
              {message.role === 'user' ? '用户' : '助手'}
            </Tag>
            <Text type="secondary" className="message-time">
              <RelativeTime timestamp={message.timestamp} />
            </Text>
          </div>
          <div className="result-item-snippet">
            <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0, fontSize: '13px' }}>
              {highlightText(snippet, highlightIndices)}
            </Paragraph>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="search-result-group">
      <div
        className={`group-header ${isExpanded ? 'expanded' : ''}`}
        onClick={() => onToggleGroup(chatId)}
      >
        <CaretRightOutlined
          className="expand-icon"
          style={{
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}
        />
        <FileTextOutlined className="file-icon" />
        <span className="group-title">{chatTitle}</span>
        <Badge
          count={results.length}
          overflowCount={999999}
          style={{
            backgroundColor: '#1677ff',
            fontSize: '11px',
            height: '18px',
            lineHeight: '18px',
            padding: '0 6px'
          }}
        />
      </div>
      {isExpanded && (
        <div className="group-results">
          {results.slice(0, displayCount).map((result, index) => renderResultItem(result, index))}
          {results.length > displayCount && (
            <div className="more-results-actions">
              <Button
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  const remaining = results.length - displayCount
                  const nextIncrement = Math.min(remaining, INCREMENT_COUNT)
                  setDisplayCount(displayCount + nextIncrement)
                }}
                style={{ fontSize: '12px', padding: '4px 36px' }}
              >
                显示更多 (还有 {results.length - displayCount} 条，显示接下来{' '}
                {Math.min(results.length - displayCount, INCREMENT_COUNT)} 条)
              </Button>
              {displayCount > INITIAL_DISPLAY_COUNT && (
                <Button
                  type="link"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDisplayCount(INITIAL_DISPLAY_COUNT)
                  }}
                  style={{ fontSize: '12px', padding: '4px 36px', marginLeft: 8 }}
                >
                  收起
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

export default SearchResultGroup
