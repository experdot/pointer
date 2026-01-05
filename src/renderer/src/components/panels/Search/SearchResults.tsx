import React, { useCallback } from 'react'
import { Typography } from 'antd'
import {
  MessageOutlined,
  UserOutlined,
  RobotOutlined,
  RightOutlined,
  DownOutlined
} from '@ant-design/icons'
import { useGlobalSearchStore } from '../../../stores/globalSearchStore'
import type { GlobalSearchMatch, GlobalSearchResultGroup } from '../../../types/type'

const { Text } = Typography

interface SearchResultsProps {
  results: GlobalSearchResultGroup[]
  onItemClick: (match: GlobalSearchMatch, groupIndex: number, matchIndex: number) => void
}

export function SearchResults({ results, onItemClick }: SearchResultsProps): React.JSX.Element {
  const { toggleGroupExpanded, selectedIndex } = useGlobalSearchStore()

  const handleGroupClick = useCallback(
    (pageId: string) => {
      toggleGroupExpanded(pageId)
    },
    [toggleGroupExpanded]
  )

  return (
    <div className="search-results">
      {results.map((group, groupIndex) => (
        <div key={group.pageId} className="search-result-group">
          <div
            className="search-result-group-header"
            onClick={() => handleGroupClick(group.pageId)}
          >
            <span className="search-result-group-icon">
              {group.expanded ? <DownOutlined /> : <RightOutlined />}
            </span>
            <MessageOutlined className="search-result-page-icon" />
            <Text className="search-result-group-title" ellipsis>
              {group.pageTitle}
            </Text>
            {group.folderPath && (
              <span className="search-result-group-path">{group.folderPath}</span>
            )}
            <span className="search-result-group-count">{group.matches.length}</span>
          </div>

          {group.expanded && (
            <div className="search-result-items">
              {group.matches.map((match, matchIndex) => (
                <SearchResultItem
                  key={`${match.messageId}-${matchIndex}`}
                  match={match}
                  isSelected={
                    selectedIndex !== null &&
                    selectedIndex[0] === groupIndex &&
                    selectedIndex[1] === matchIndex
                  }
                  onClick={() => onItemClick(match, groupIndex, matchIndex)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
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
  const roleIcon = match.role === 'user' ? <UserOutlined /> : <RobotOutlined />

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
      <span className="search-result-item-icon">{roleIcon}</span>
      <span className="search-result-item-snippet">{renderSnippet()}</span>
    </div>
  )
}
