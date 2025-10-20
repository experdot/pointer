import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Input, Button, Typography, Tooltip } from 'antd'
import { SearchOutlined, CloseOutlined, UpOutlined, DownOutlined } from '@ant-design/icons'

const { Text } = Typography

interface MessageSearchProps {
  isVisible: boolean
  onClose: () => void
  onSearch: (query: string, currentIndex: number, direction: 'next' | 'previous') => void
  currentIndex: number
  totalMatches: number
}

const MessageSearch: React.FC<MessageSearchProps> = ({
  isVisible,
  onClose,
  onSearch,
  currentIndex,
  totalMatches
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const inputRef = useRef<any>(null)

  // 当搜索框显示时自动聚焦
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isVisible])

  // 处理搜索输入变化
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value
      setSearchQuery(query)
      // 立即触发搜索，包括空查询（用于清除高亮）
      onSearch(query, 0, 'next')
    },
    [onSearch]
  )

  // 处理键盘事件
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (searchQuery.trim()) {
          if (e.shiftKey) {
            onSearch(searchQuery, currentIndex, 'previous')
          } else {
            onSearch(searchQuery, currentIndex, 'next')
          }
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    },
    [searchQuery, currentIndex, onSearch, onClose]
  )

  // 处理上一个/下一个按钮点击
  const handlePrevious = useCallback(() => {
    if (searchQuery.trim()) {
      onSearch(searchQuery, currentIndex, 'previous')
    }
  }, [searchQuery, currentIndex, onSearch])

  const handleNext = useCallback(() => {
    if (searchQuery.trim()) {
      onSearch(searchQuery, currentIndex, 'next')
    }
  }, [searchQuery, currentIndex, onSearch])

  if (!isVisible) {
    return null
  }

  return (
    <div className="message-search-container">
      <div className="message-search-bar">
        <Input
          ref={inputRef}
          placeholder="搜索消息内容..."
          value={searchQuery}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          prefix={<SearchOutlined />}
          className="message-search-input"
          size="small"
        />

        <div className="message-search-navigation">
          {searchQuery.trim() && (
            <Text className="search-results-info" type="secondary">
              {totalMatches > 0 ? `${currentIndex + 1}/${totalMatches}` : '无结果'}
            </Text>
          )}

          <Tooltip title="上一个 (Shift+Enter)">
            <Button
              type="text"
              size="small"
              icon={<UpOutlined />}
              onClick={handlePrevious}
              disabled={!searchQuery.trim() || totalMatches === 0}
            />
          </Tooltip>

          <Tooltip title="下一个 (Enter)">
            <Button
              type="text"
              size="small"
              icon={<DownOutlined />}
              onClick={handleNext}
              disabled={!searchQuery.trim() || totalMatches === 0}
            />
          </Tooltip>

          <Tooltip title="关闭 (Esc)">
            <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

export default MessageSearch
