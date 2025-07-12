import React, { useState, useCallback, useEffect } from 'react'
import { Input, List, Avatar, Typography, Empty, Spin, Card, Tag, Button } from 'antd'
import { SearchOutlined, UserOutlined, RobotOutlined, CloseOutlined } from '@ant-design/icons'
import { useAppContext } from '../../store/AppContext'
import { searchMessages } from '../../store/reducers/searchReducer'
import { SearchResult } from '../../types'
import './search-styles.css'

const { Search } = Input
const { Text, Paragraph } = Typography

interface GlobalSearchProps {
  visible: boolean
  onClose: () => void
  embedded?: boolean
}

export default function GlobalSearch({ visible, onClose, embedded = false }: GlobalSearchProps) {
  const { state, dispatch } = useAppContext()
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)

  // 执行搜索
  const performSearch = useCallback(
    (query: string) => {
      if (!query.trim()) {
        dispatch({ type: 'CLEAR_SEARCH' })
        return
      }

      dispatch({ type: 'SET_IS_SEARCHING', payload: { isSearching: true } })

      // 防抖搜索
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }

      const timeout = setTimeout(() => {
        const results = searchMessages(state.pages, query)
        dispatch({ type: 'SET_SEARCH_RESULTS', payload: { results } })
      }, 300)

      setSearchTimeout(timeout)
    },
    [state.pages, dispatch, searchTimeout]
  )

  // 处理搜索输入变化
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value
      dispatch({ type: 'SET_SEARCH_QUERY', payload: { query } })
      performSearch(query)
    },
    [dispatch, performSearch]
  )

  // 处理搜索结果点击
  const handleResultClick = useCallback(
    (result: SearchResult) => {
      // 打开聊天标签页
      dispatch({ type: 'OPEN_TAB', payload: { chatId: result.chatId } })
      // 如果不是内嵌模式，关闭搜索
      if (!embedded) {
        onClose()
      }
    },
    [dispatch, onClose, embedded]
  )

  // 清除搜索
  const handleClearSearch = useCallback(() => {
    dispatch({ type: 'CLEAR_SEARCH' })
  }, [dispatch])

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
    }
  }, [searchTimeout])

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
      <Search
        placeholder="搜索聊天记录..."
        value={state.searchQuery}
        onChange={handleSearchChange}
        onSearch={performSearch}
        enterButton="搜索"
        size={embedded ? "default" : "large"}
        suffix={
          state.searchQuery ? (
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
  )

  const searchResults = (
    <div className="search-results-section">
      {state.isSearching ? (
        <div className="search-loading">
          <Spin size="large" />
          <Text type="secondary">搜索中...</Text>
        </div>
      ) : state.searchQuery && state.searchResults.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到相关结果" />
      ) : state.searchResults.length > 0 ? (
        <>
          <div className="search-results-header">
            <Text type="secondary">找到 {state.searchResults.length} 条结果</Text>
          </div>
          <List
            className="search-results-list"
            dataSource={state.searchResults}
            renderItem={renderSearchResult}
            pagination={
              state.searchResults.length > 10
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
        {searchResults}
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
        {searchResults}
      </Card>
    </div>
  )
}
