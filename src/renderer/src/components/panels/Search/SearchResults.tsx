import React, { useCallback, useState } from 'react'
import { Typography } from 'antd'
import {
  MessageOutlined,
  UserOutlined,
  RobotOutlined,
  RightOutlined,
  DownOutlined
} from '@ant-design/icons'
import { useGlobalSearchStore } from '../../../stores/globalSearchStore'
import type {
  GlobalSearchMatch,
  GlobalSearchMessageGroup,
  GlobalSearchResultGroup
} from '../../../types/type'

const { Text } = Typography

/** 每次加载的数量 */
const PAGE_SIZE = 20

interface SearchResultsProps {
  results: GlobalSearchResultGroup[]
  onItemClick: (
    match: GlobalSearchMatch,
    pageIndex: number,
    messageIndex: number,
    matchIndex: number
  ) => void
}

export function SearchResults({ results, onItemClick }: SearchResultsProps): React.JSX.Element {
  const { toggleGroupExpanded, toggleMessageExpanded, selectedIndex } = useGlobalSearchStore()
  const [visiblePageCount, setVisiblePageCount] = useState(PAGE_SIZE)

  const handleGroupClick = useCallback(
    (pageId: string) => {
      toggleGroupExpanded(pageId)
    },
    [toggleGroupExpanded]
  )

  const handleMessageClick = useCallback(
    (pageId: string, messageId: string) => {
      toggleMessageExpanded(pageId, messageId)
    },
    [toggleMessageExpanded]
  )

  const handleLoadMorePages = useCallback(() => {
    setVisiblePageCount((prev) => prev + PAGE_SIZE)
  }, [])

  const visibleResults = results.slice(0, visiblePageCount)
  const hasMorePages = results.length > visiblePageCount

  return (
    <div className="search-results">
      {visibleResults.map((group, pageIndex) => (
        <SearchResultPageGroup
          key={group.pageId}
          group={group}
          pageIndex={pageIndex}
          selectedIndex={selectedIndex}
          onGroupClick={handleGroupClick}
          onMessageClick={handleMessageClick}
          onItemClick={onItemClick}
        />
      ))}
      {hasMorePages && (
        <LoadMoreButton
          current={visiblePageCount}
          total={results.length}
          onLoadMore={handleLoadMorePages}
        />
      )}
    </div>
  )
}

interface LoadMoreButtonProps {
  current: number
  total: number
  onLoadMore: () => void
}

function LoadMoreButton({ current, total, onLoadMore }: LoadMoreButtonProps): React.JSX.Element {
  return (
    <div className="search-load-more" onClick={onLoadMore}>
      <span>
        已显示 {Math.min(current, total)}/{total} 项，点击加载更多
      </span>
    </div>
  )
}

interface SearchResultPageGroupProps {
  group: GlobalSearchResultGroup
  pageIndex: number
  selectedIndex: [number, number, number] | null
  onGroupClick: (pageId: string) => void
  onMessageClick: (pageId: string, messageId: string) => void
  onItemClick: (
    match: GlobalSearchMatch,
    pageIndex: number,
    messageIndex: number,
    matchIndex: number
  ) => void
}

function SearchResultPageGroup({
  group,
  pageIndex,
  selectedIndex,
  onGroupClick,
  onMessageClick,
  onItemClick
}: SearchResultPageGroupProps): React.JSX.Element {
  const [visibleMessageCount, setVisibleMessageCount] = useState(PAGE_SIZE)

  // 计算该页面的总匹配数
  const totalMatches = group.messageGroups.reduce((sum, mg) => sum + mg.matches.length, 0)

  // 格式化时间
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  const handleLoadMoreMessages = useCallback(() => {
    setVisibleMessageCount((prev) => prev + PAGE_SIZE)
  }, [])

  const visibleMessageGroups = group.messageGroups.slice(0, visibleMessageCount)
  const hasMoreMessages = group.messageGroups.length > visibleMessageCount

  return (
    <div className="search-result-group">
      <div className="search-result-group-header" onClick={() => onGroupClick(group.pageId)}>
        <span className="search-result-group-icon">
          {group.expanded ? <DownOutlined /> : <RightOutlined />}
        </span>
        <MessageOutlined className="search-result-page-icon" />
        <Text className="search-result-group-title" ellipsis>
          {group.pageTitle}
        </Text>
        {group.folderPath && <span className="search-result-group-path">{group.folderPath}</span>}
        <span className="search-result-group-time">{formatTime(group.createdAt)}</span>
        <span className="search-result-group-count">{totalMatches}</span>
      </div>

      {group.expanded && (
        <div className="search-result-messages">
          {visibleMessageGroups.map((messageGroup, messageIndex) => (
            <SearchResultMessageGroup
              key={messageGroup.messageId}
              messageGroup={messageGroup}
              pageId={group.pageId}
              pageIndex={pageIndex}
              messageIndex={messageIndex}
              selectedIndex={selectedIndex}
              onMessageClick={onMessageClick}
              onItemClick={onItemClick}
            />
          ))}
          {hasMoreMessages && (
            <LoadMoreButton
              current={visibleMessageCount}
              total={group.messageGroups.length}
              onLoadMore={handleLoadMoreMessages}
            />
          )}
        </div>
      )}
    </div>
  )
}

interface SearchResultMessageGroupProps {
  messageGroup: GlobalSearchMessageGroup
  pageId: string
  pageIndex: number
  messageIndex: number
  selectedIndex: [number, number, number] | null
  onMessageClick: (pageId: string, messageId: string) => void
  onItemClick: (
    match: GlobalSearchMatch,
    pageIndex: number,
    messageIndex: number,
    matchIndex: number
  ) => void
}

function SearchResultMessageGroup({
  messageGroup,
  pageId,
  pageIndex,
  messageIndex,
  selectedIndex,
  onMessageClick,
  onItemClick
}: SearchResultMessageGroupProps): React.JSX.Element {
  const [visibleMatchCount, setVisibleMatchCount] = useState(PAGE_SIZE)

  const roleIcon = messageGroup.role === 'user' ? <UserOutlined /> : <RobotOutlined />

  // 格式化时间
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  // 生成消息标题显示：优先使用 title，否则使用内容预览
  const displayTitle = messageGroup.title || messageGroup.contentPreview

  const handleLoadMoreMatches = useCallback(() => {
    setVisibleMatchCount((prev) => prev + PAGE_SIZE)
  }, [])

  const visibleMatches = messageGroup.matches.slice(0, visibleMatchCount)
  const hasMoreMatches = messageGroup.matches.length > visibleMatchCount

  return (
    <div className="search-result-message-group">
      <div
        className="search-result-message-header"
        onClick={() => onMessageClick(pageId, messageGroup.messageId)}
      >
        <span className="search-result-group-icon">
          {messageGroup.expanded ? <DownOutlined /> : <RightOutlined />}
        </span>
        <span className="search-result-message-icon">{roleIcon}</span>
        <Text className="search-result-message-title" ellipsis>
          {displayTitle}
        </Text>
        <span className="search-result-message-time">{formatTime(messageGroup.createdAt)}</span>
        <span className="search-result-message-count">{messageGroup.matches.length}</span>
      </div>

      {messageGroup.expanded && (
        <div className="search-result-items">
          {visibleMatches.map((match, matchIndex) => (
            <SearchResultItem
              key={`${match.messageId}-${match.contentStart}`}
              match={match}
              isSelected={
                selectedIndex !== null &&
                selectedIndex[0] === pageIndex &&
                selectedIndex[1] === messageIndex &&
                selectedIndex[2] === matchIndex
              }
              onClick={() => onItemClick(match, pageIndex, messageIndex, matchIndex)}
            />
          ))}
          {hasMoreMatches && (
            <LoadMoreButton
              current={visibleMatchCount}
              total={messageGroup.matches.length}
              onLoadMore={handleLoadMoreMatches}
            />
          )}
        </div>
      )}
    </div>
  )
}

interface SearchResultItemProps {
  match: GlobalSearchMatch
  isSelected: boolean
  onClick: () => void
}

function SearchResultItem({
  match,
  isSelected,
  onClick
}: SearchResultItemProps): React.JSX.Element {
  // 渲染带高亮的片段
  const renderSnippet = (): React.JSX.Element => {
    const { snippet, matchStart, matchEnd } = match
    const before = snippet.slice(0, matchStart)
    const highlighted = snippet.slice(matchStart, matchEnd)
    const after = snippet.slice(matchEnd)

    return (
      <>
        {before}
        <mark className="search-highlight">{highlighted}</mark>
        {after}
      </>
    )
  }

  return (
    <div
      className={`search-result-item ${isSelected ? 'search-result-item-selected' : ''}`}
      onClick={onClick}
    >
      <span className="search-result-item-snippet">{renderSnippet()}</span>
    </div>
  )
}
