import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  Input,
  Typography,
  Empty,
  Spin,
  Card,
  Tag,
  Button,
  Checkbox,
  Space,
  Tooltip,
  Dropdown,
  Badge
} from 'antd'
import type { InputRef } from 'antd'
import {
  SearchOutlined,
  CloseOutlined,
  SettingOutlined,
  FilterOutlined,
  DownOutlined,
  UpOutlined,
  FolderOutlined
} from '@ant-design/icons'
import { useSearchStore } from '../../../../stores/searchStore'
import { usePagesStore } from '../../../../stores/pagesStore'
import { useTabsStore } from '../../../../stores/tabsStore'
import { SearchResult, SearchOptions } from '../../../../types/type'
import SearchResultGroup from './SearchResultGroup'
import './search-styles-vscode.css'

const { Text } = Typography

interface GlobalSearchRefactoredProps {
  visible: boolean
  onClose: () => void
  embedded?: boolean
  filterFolderId?: string | null
  filterFolderName?: string
}

export default function GlobalSearchRefactored({
  visible,
  onClose,
  embedded = false,
  filterFolderId = null,
  filterFolderName = ''
}: GlobalSearchRefactoredProps) {
  const {
    searchQuery,
    searchResults,
    isSearching,
    searchOptions,
    filterFolderId: storedFilterFolderId,
    setSearchQuery,
    setSearchResults,
    setIsSearching,
    setSearchOptions,
    setFilterFolderId,
    clearSearch
  } = useSearchStore()
  const { pages } = usePagesStore()
  const { openTab } = useTabsStore()
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)
  const [visibleGroups, setVisibleGroups] = useState(10) // 初始显示10个组
  const inputRef = useRef<InputRef>(null)
  const [inputValue, setInputValue] = useState('')
  const [showOptions, setShowOptions] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded] = useState(true)

  // 使用props传入的filterFolderId或存储的filterFolderId
  const activeFolderId = filterFolderId || storedFilterFolderId

  // 将搜索结果按对话分组
  const groupedResults = useMemo(() => {
    const groups = new Map<string, { title: string; results: SearchResult[] }>()

    searchResults.forEach((result) => {
      const chatId = result.chatId
      if (!groups.has(chatId)) {
        groups.set(chatId, {
          title: result.chatTitle,
          results: []
        })
      }
      groups.get(chatId)!.results.push(result)
    })

    // 按照每组第一条结果的时间排序
    return Array.from(groups.entries())
      .sort(([, a], [, b]) => {
        const aTime = a.results[0]?.message.timestamp || 0
        const bTime = b.results[0]?.message.timestamp || 0
        return bTime - aTime
      })
      .map(([chatId, data]) => ({
        chatId,
        ...data
      }))
  }, [searchResults])

  // 初始化展开状态 - 默认全部折叠
  useEffect(() => {
    if (groupedResults.length > 0 && expandedGroups.size === 0 && !searchQuery) {
      // 保持默认折叠状态
      setAllExpanded(false)
    }
  }, [groupedResults, searchQuery])

  // 当filterFolderId变化时，更新store中的filterFolderId
  useEffect(() => {
    if (filterFolderId !== undefined) {
      setFilterFolderId(filterFolderId)
    }
  }, [filterFolderId, setFilterFolderId])

  // 执行搜索
  const performSearch = useCallback(
    (query: string) => {
      if (!query.trim()) {
        setSearchResults([])
        setIsSearching(false)
        setVisibleGroups(10)
        return
      }

      // 防抖搜索
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }

      const timeout = setTimeout(() => {
        setIsSearching(true)

        try {
          const { searchMessages } = useSearchStore.getState()
          const results = searchMessages(pages, query, searchOptions, activeFolderId)
          setSearchResults(results)
          setIsSearching(false)
          setVisibleGroups(10) // 重置可见组数量

          // 搜索完成后默认全部折叠
          if (results.length > 0) {
            setExpandedGroups(new Set())
            setAllExpanded(false)
          }
        } catch (error) {
          console.error('搜索失败:', error)
          setSearchResults([])
          setIsSearching(false)
        }
      }, 500) // 增加防抖时间到500ms

      setSearchTimeout(timeout)
    },
    [pages, searchTimeout, searchOptions, activeFolderId, setSearchResults, setIsSearching]
  )

  // 处理输入变化
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setInputValue(value)

      if (!value.trim()) {
        setSearchResults([])
        setIsSearching(false)
        setExpandedGroups(new Set())
        if (searchTimeout) {
          clearTimeout(searchTimeout)
        }
        return
      }

      performSearch(value)
    },
    [performSearch, searchTimeout]
  )

  // 处理回车键搜索
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const value = inputValue.trim()
        if (value) {
          // 清除之前的防抖计时器
          if (searchTimeout) {
            clearTimeout(searchTimeout)
          }
          // 立即执行搜索
          setIsSearching(true)
          try {
            const { searchMessages } = useSearchStore.getState()
            const results = searchMessages(pages, value, searchOptions, activeFolderId)
            setSearchResults(results)
            setIsSearching(false)
            setVisibleGroups(10)
            // 搜索完成后默认全部折叠
            if (results.length > 0) {
              setExpandedGroups(new Set())
              setAllExpanded(false)
            }
          } catch (error) {
            console.error('搜索失败:', error)
            setSearchResults([])
            setIsSearching(false)
          }
        }
      }
    },
    [inputValue, pages, searchOptions, activeFolderId, searchTimeout]
  )

  // 处理搜索结果点击
  const handleResultClick = useCallback(
    (result: SearchResult) => {
      // 打开对应的聊天标签页，并导航到具体的消息
      openTab(result.chatId, result.messageId)
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
    setExpandedGroups(new Set())
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

  // 清除文件夹过滤
  const handleClearFolderFilter = useCallback(() => {
    setFilterFolderId(null)
    // 如果有搜索内容，重新执行搜索
    if (inputValue.trim()) {
      performSearch(inputValue)
    }
  }, [setFilterFolderId, inputValue, performSearch])

  // 切换单个组的展开状态
  const handleToggleGroup = useCallback(
    (chatId: string) => {
      setExpandedGroups((prev) => {
        const newSet = new Set(prev)
        if (newSet.has(chatId)) {
          newSet.delete(chatId)
        } else {
          newSet.add(chatId)
        }
        setAllExpanded(newSet.size === groupedResults.length)
        return newSet
      })
    },
    [groupedResults.length]
  )

  // 切换全部展开/收起
  const handleToggleAll = useCallback(() => {
    if (allExpanded) {
      setExpandedGroups(new Set())
      setAllExpanded(false)
    } else {
      const allIds = new Set(groupedResults.map((g) => g.chatId))
      setExpandedGroups(allIds)
      setAllExpanded(true)
    }
  }, [allExpanded, groupedResults])

  // 处理搜索选项变化
  const handleSearchOptionChange = useCallback(
    (option: keyof SearchOptions, value: boolean) => {
      const newOptions = { ...searchOptions, [option]: value }
      setSearchOptions(newOptions)

      // 如果有搜索内容，立即重新搜索
      if (inputValue.trim()) {
        // 清除之前的防抖计时器
        if (searchTimeout) {
          clearTimeout(searchTimeout)
        }
        // 立即执行搜索
        setIsSearching(true)
        try {
          const { searchMessages } = useSearchStore.getState()
          const results = searchMessages(pages, inputValue, newOptions, activeFolderId)
          setSearchResults(results)
          setIsSearching(false)
          setVisibleGroups(10)
          // 搜索完成后默认全部折叠
          if (results.length > 0) {
            setExpandedGroups(new Set())
            setAllExpanded(false)
          }
        } catch (error) {
          console.error('搜索失败:', error)
          setSearchResults([])
          setIsSearching(false)
        }
      }
    },
    [inputValue, pages, activeFolderId, searchTimeout]
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
      setExpandedGroups(new Set())
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
    }
  }, [visible, searchTimeout])

  if (!visible) return null

  const searchContent = (
    <div className="vscode-search-input-section">
      {activeFolderId && (
        <div style={{ marginBottom: 8 }}>
          <Tag icon={<FolderOutlined />} closable onClose={handleClearFolderFilter} color="blue">
            {filterFolderName || '文件夹过滤'}
          </Tag>
        </div>
      )}
      <div className="search-input-wrapper">
        <Input
          ref={inputRef}
          className="vscode-search-input"
          placeholder={activeFolderId ? '在文件夹中搜索' : '搜索'}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          prefix={<SearchOutlined />}
          suffix={
            <Space size={4}>
              {inputValue && (
                <Button
                  type="text"
                  icon={<CloseOutlined />}
                  onClick={handleClearSearch}
                  size="small"
                  className="search-action-btn"
                />
              )}
              <Tooltip title="搜索选项">
                <Button
                  type="text"
                  icon={<FilterOutlined />}
                  onClick={() => setShowOptions(!showOptions)}
                  size="small"
                  className={`search-action-btn ${showOptions ? 'active' : ''}`}
                />
              </Tooltip>
            </Space>
          }
        />
      </div>

      {showOptions && (
        <div className="vscode-search-options">
          <Space direction="vertical" size={4}>
            <Checkbox
              checked={searchOptions.matchCase}
              onChange={(e) => handleSearchOptionChange('matchCase', e.target.checked)}
            >
              区分大小写
            </Checkbox>
            <Checkbox
              checked={searchOptions.matchWholeWord}
              onChange={(e) => handleSearchOptionChange('matchWholeWord', e.target.checked)}
            >
              全字匹配
            </Checkbox>
            <Checkbox
              checked={searchOptions.useRegex}
              onChange={(e) => handleSearchOptionChange('useRegex', e.target.checked)}
            >
              使用正则表达式
            </Checkbox>
          </Space>
        </div>
      )}
    </div>
  )

  const searchResultsSection = (
    <div className="vscode-search-results-section">
      {isSearching ? (
        <div className="search-loading">
          <Spin size="small" />
          <Text type="secondary">搜索中...</Text>
        </div>
      ) : inputValue && searchResults.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无结果" className="search-empty" />
      ) : searchResults.length > 0 ? (
        <>
          <div className="vscode-search-results-header">
            <div className="results-count">
              <Text>
                {searchResults.length} 个结果在 {groupedResults.length} 个对话中
              </Text>
            </div>
            <div className="results-actions">
              <Tooltip title={allExpanded ? '全部折叠' : '全部展开'}>
                <Button
                  type="text"
                  size="small"
                  icon={allExpanded ? <UpOutlined /> : <DownOutlined />}
                  onClick={handleToggleAll}
                  className="expand-all-btn"
                />
              </Tooltip>
            </div>
          </div>
          <div className="vscode-search-results-list">
            {groupedResults.slice(0, visibleGroups).map((group) => (
              <SearchResultGroup
                key={group.chatId}
                chatId={group.chatId}
                chatTitle={group.title}
                results={group.results}
                onResultClick={handleResultClick}
                expandedGroups={expandedGroups}
                onToggleGroup={handleToggleGroup}
              />
            ))}
            {visibleGroups < groupedResults.length && (
              <div className="load-more-container">
                <Button
                  type="link"
                  onClick={() =>
                    setVisibleGroups((prev) => Math.min(prev + 10, groupedResults.length))
                  }
                >
                  显示更多结果 ({visibleGroups} / {groupedResults.length} 个对话)
                </Button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="search-placeholder">
          <SearchOutlined className="search-placeholder-icon" />
          <Text type="secondary">输入关键词搜索所有对话</Text>
        </div>
      )}
    </div>
  )

  if (embedded) {
    return (
      <div className="vscode-search-embedded">
        {searchContent}
        {searchResultsSection}
      </div>
    )
  }

  return (
    <div className="vscode-search-overlay">
      <Card
        className="vscode-search-card"
        title={
          <div className="search-header">
            <SearchOutlined />
            <span>搜索</span>
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
