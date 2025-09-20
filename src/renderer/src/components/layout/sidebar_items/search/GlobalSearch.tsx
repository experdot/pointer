import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  List,
  Avatar,
  Typography,
  Empty,
  Spin,
  Card,
  Tag,
  Button,
  Input,
  Checkbox,
  Space,
  Tooltip,
  Pagination
} from 'antd'
import type { InputRef } from 'antd'
import {
  SearchOutlined,
  UserOutlined,
  RobotOutlined,
  CloseOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { useSearchStore } from '../../../../stores/searchStore'
import { usePagesStore } from '../../../../stores/pagesStore'
import { useTabsStore } from '../../../../stores/tabsStore'
import { SearchResult, SearchOptions } from '../../../../types/type'
import RelativeTime from '../../../common/RelativeTime'
import './search-styles.css'

const { Text, Paragraph } = Typography

interface GlobalSearchProps {
  visible: boolean
  onClose: () => void
  embedded?: boolean
}

export default function GlobalSearch({ visible, onClose, embedded = false }: GlobalSearchProps) {
  const {
    searchQuery,
    searchResults,
    isSearching,
    searchOptions,
    setSearchQuery,
    setSearchResults,
    setIsSearching,
    setSearchOptions,
    clearSearch
  } = useSearchStore()
  const { pages } = usePagesStore()
  const { openTab } = useTabsStore()
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)
  const inputRef = useRef<InputRef>(null)
  const [inputValue, setInputValue] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

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

        try {
          // 执行搜索
          const { searchMessages } = useSearchStore.getState()
          const results = searchMessages(pages, query, searchOptions)
          setSearchResults(results)
          setIsSearching(false)
          setCurrentPage(1) // 重置分页
        } catch (error) {
          console.error('搜索失败:', error)
          setSearchResults([])
          setIsSearching(false)
        }
      }, 300)

      setSearchTimeout(timeout)
    },
    [pages, searchTimeout, searchOptions, setSearchResults, setIsSearching]
  )

  // 处理输入变化
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setInputValue(value)

      if (!value.trim()) {
        setSearchResults([])
        setIsSearching(false)
        setCurrentPage(1)
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
      openTab(result.chatId)
      if (!embedded) {
        onClose()
      }
    },
    [openTab, onClose, embedded]
  )

  // 清除搜索
  const handleClearSearch = useCallback(() => {
    setInputValue('')
    setSearchResults([])
    setIsSearching(false)
    setCurrentPage(1)
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
          try {
            const { searchMessages } = useSearchStore.getState()
            const results = searchMessages(pages, value, searchOptions)
            setSearchResults(results)
            setIsSearching(false)
            setCurrentPage(1)
          } catch (error) {
            console.error('搜索失败:', error)
            setSearchResults([])
            setIsSearching(false)
          }
        }
      }
    },
    [inputValue, pages, searchOptions, setSearchResults, setIsSearching]
  )

  // 处理搜索选项变化
  const handleSearchOptionChange = useCallback(
    (option: keyof SearchOptions, value: boolean) => {
      const newOptions = { ...searchOptions, [option]: value }
      setSearchOptions(newOptions)

      // 如果有搜索内容，重新搜索
      if (inputValue.trim()) {
        performSearch(inputValue)
      }
    },
    [searchOptions, inputValue, performSearch]
  )

  // 处理分页变化
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  // 计算当前页的数据
  const getCurrentPageData = useCallback(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return searchResults.slice(startIndex, endIndex)
  }, [searchResults, currentPage, pageSize])

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
      setCurrentPage(1)
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
                  <RelativeTime timestamp={message.timestamp} />
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
          size={embedded ? 'middle' : 'large'}
          prefix={<SearchOutlined />}
          suffix={
            <Space>
              {inputValue && (
                <Button
                  type="text"
                  icon={<CloseOutlined />}
                  onClick={handleClearSearch}
                  size="small"
                />
              )}
              <Tooltip title="搜索选项">
                <Button
                  type="text"
                  icon={<SettingOutlined />}
                  onClick={() => setShowOptions(!showOptions)}
                  size="small"
                  style={{ color: showOptions ? '#1890ff' : undefined }}
                />
              </Tooltip>
            </Space>
          }
        />
      </div>

      {showOptions && (
        <div className="search-options">
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Checkbox
              checked={searchOptions.matchCase}
              onChange={(e) => handleSearchOptionChange('matchCase', e.target.checked)}
            >
              匹配大小写 (Match Case)
            </Checkbox>
            <Checkbox
              checked={searchOptions.matchWholeWord}
              onChange={(e) => handleSearchOptionChange('matchWholeWord', e.target.checked)}
            >
              匹配整个单词 (Match Whole Word)
            </Checkbox>
            <Checkbox
              checked={searchOptions.useRegex}
              onChange={(e) => handleSearchOptionChange('useRegex', e.target.checked)}
            >
              使用正则表达式 (Use Regex)
            </Checkbox>
          </Space>
        </div>
      )}
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
        <div className="search-results-with-pagination">
          <div className="search-results-header">
            <Text type="secondary">找到 {searchResults.length} 条结果</Text>
          </div>
          <div className="search-results-list-container">
            <List
              className="search-results-list"
              dataSource={getCurrentPageData()}
              renderItem={renderSearchResult}
              pagination={false}
            />
          </div>
          {searchResults.length > pageSize && (
            <div className="search-pagination">
              <Pagination
                current={currentPage}
                total={searchResults.length}
                pageSize={pageSize}
                size="small"
                showSizeChanger={false}
                onChange={handlePageChange}
              />
            </div>
          )}
        </div>
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
        <div className="search-top">
          {searchContent}
          {searchResults.length > 0 && (
            <div className="search-results-header">
              <Text type="secondary">找到 {searchResults.length} 条结果</Text>
            </div>
          )}
        </div>

        <div className="search-middle">
          {isSearching ? (
            <div className="search-loading">
              <Spin size="large" />
              <Text type="secondary">搜索中...</Text>
            </div>
          ) : inputValue && searchResults.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到相关结果" />
          ) : searchResults.length > 0 ? (
            <List
              className="search-results-list"
              dataSource={getCurrentPageData()}
              renderItem={renderSearchResult}
              pagination={false}
            />
          ) : (
            <div className="search-placeholder">
              <SearchOutlined className="search-placeholder-icon" />
              <Text type="secondary">输入关键词搜索所有聊天记录</Text>
            </div>
          )}
        </div>

        {searchResults.length > pageSize && (
          <div className="search-bottom">
            <Pagination
              current={currentPage}
              total={searchResults.length}
              pageSize={pageSize}
              size="small"
              showSizeChanger={false}
              onChange={handlePageChange}
            />
          </div>
        )}
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
