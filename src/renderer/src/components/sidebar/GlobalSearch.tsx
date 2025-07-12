import React, { useState, useCallback, useEffect, useRef } from 'react'
import { List, Avatar, Typography, Empty, Spin, Card, Tag, Button, Input } from 'antd'
import type { InputRef } from 'antd'
import { SearchOutlined, UserOutlined, RobotOutlined, CloseOutlined } from '@ant-design/icons'
import { useAppContext } from '../../store/AppContext'
import { searchMessages } from '../../store/reducers/searchReducer'
import { SearchResult } from '../../types'
import './search-styles.css'

const { Text, Paragraph } = Typography

interface GlobalSearchProps {
  visible: boolean
  onClose: () => void
  embedded?: boolean
}

export default function GlobalSearch({ visible, onClose, embedded = false }: GlobalSearchProps) {
  const { state, dispatch } = useAppContext()
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)
  const inputRef = useRef<InputRef>(null)
  const [inputValue, setInputValue] = useState('')

  // 执行搜索
  const performSearch = useCallback(
    (query: string) => {
      if (!query.trim()) {
        setSearchResults([])
        setIsSearching(false)
        return
      }

      // 防抖搜索
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }

      const timeout = setTimeout(() => {
        setIsSearching(true)
        
        // 执行搜索
        const results = searchMessages(state.pages, query)
        setSearchResults(results)
        setIsSearching(false)
      }, 300)

      setSearchTimeout(timeout)
    },
    [state.pages, searchTimeout]
  )

  // 处理输入变化
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setInputValue(value)
      
      if (!value.trim()) {
        setSearchResults([])
        setIsSearching(false)
        if (searchTimeout) {
          clearTimeout(searchTimeout)
        }
        return
      }
      
      performSearch(value)
    },
    [performSearch, searchTimeout]
  )

  // 处理搜索结果点击
  const handleResultClick = useCallback(
    (result: SearchResult) => {
      dispatch({ type: 'OPEN_TAB', payload: { chatId: result.chatId } })
      if (!embedded) {
        onClose()
      }
    },
    [dispatch, onClose, embedded]
  )

  // 清除搜索
  const handleClearSearch = useCallback(() => {
    setInputValue('')
    setSearchResults([])
    setIsSearching(false)
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
    // 重新聚焦
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
    }
  }, [searchTimeout])

  // 处理回车键搜索
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const value = inputValue.trim()
        if (value) {
          // 立即执行搜索
          setIsSearching(true)
          const results = searchMessages(state.pages, value)
          setSearchResults(results)
          setIsSearching(false)
        }
      }
    },
    [inputValue, state.pages]
  )

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
    }
  }, [searchTimeout])

  // 当搜索面板变为可见时，自动聚焦
  useEffect(() => {
    if (visible && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [visible])

  // 当组件隐藏时，清理状态
  useEffect(() => {
    if (!visible) {
      setInputValue('')
      setSearchResults([])
      setIsSearching(false)
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
    }
  }, [visible, searchTimeout])

  // 渲染搜索结果项
  const renderSearchResult = useCallback(
    (result: SearchResult) => {
      const { message, snippet, chatTitle, highlightIndices } = result

      // 高亮搜索词
      const highlightText = (text: string, indices: number[]) => {
        if (indices.length < 2) return text

        const [start, end] = indices
        return (
          <>
            {text.substring(0, start)}
            <mark className="search-highlight">{text.substring(start, end)}</mark>
            {text.substring(end)}
          </>
        )
      }

      return (
        <List.Item
          key={result.id}
          className="search-result-item"
          onClick={() => handleResultClick(result)}
        >
          <div className="search-result-content">
            <div className="search-result-header">
              <Avatar
                size="small"
                icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                style={{
                  backgroundColor: message.role === 'user' ? '#87d068' : '#1890ff'
                }}
              />
              <div className="search-result-meta">
                <Text strong className="chat-title">
                  {chatTitle}
                </Text>
                <Text type="secondary" className="message-time">
                  {new Date(message.timestamp).toLocaleString()}
                </Text>
              </div>
              <Tag color={message.role === 'user' ? 'green' : 'blue'}>
                {message.role === 'user' ? '用户' : '助手'}
              </Tag>
            </div>
            <div className="search-result-snippet">
              <Paragraph ellipsis={{ rows: 2 }}>
                {highlightText(snippet, highlightIndices)}
              </Paragraph>
            </div>
          </div>
        </List.Item>
      )
    },
    [handleResultClick]
  )

  if (!visible) return null

  const searchContent = (
    <div className="search-input-section">
      <div style={{ position: 'relative' }}>
        <Input
          ref={inputRef}
          placeholder="搜索聊天记录..."
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          size={embedded ? "middle" : "large"}
          prefix={<SearchOutlined />}
          suffix={
            inputValue ? (
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={handleClearSearch}
                size="small"
              />
            ) : null
          }
        />
      </div>
    </div>
  )

  const searchResultsSection = (
    <div className="search-results-section">
      {isSearching ? (
        <div className="search-loading">
          <Spin size="large" />
          <Text type="secondary">搜索中...</Text>
        </div>
      ) : inputValue && searchResults.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到相关结果" />
      ) : searchResults.length > 0 ? (
        <>
          <div className="search-results-header">
            <Text type="secondary">找到 {searchResults.length} 条结果</Text>
          </div>
          <List
            className="search-results-list"
            dataSource={searchResults}
            renderItem={renderSearchResult}
            pagination={
              searchResults.length > 10
                ? {
                    pageSize: 10,
                    size: 'small',
                    showSizeChanger: false
                  }
                : false
            }
          />
        </>
      ) : (
        <div className="search-placeholder">
          <SearchOutlined className="search-placeholder-icon" />
          <Text type="secondary">输入关键词搜索所有聊天记录</Text>
        </div>
      )}
    </div>
  )

  if (embedded) {
    return (
      <div className="global-search-embedded">
        {searchContent}
        {searchResultsSection}
      </div>
    )
  }

  return (
    <div className="global-search-overlay">
      <Card
        className="global-search-card"
        title={
          <div className="search-header">
            <SearchOutlined />
            <span>全局搜索</span>
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={onClose}
              className="search-close-btn"
            />
          </div>
        }
      >
        {searchContent}
        {searchResultsSection}
      </Card>
    </div>
  )
}
