import React, { useCallback } from 'react'
import { Empty, Spin, Button } from 'antd'
import { useGlobalSearchStore } from '../../../stores/globalSearchStore'
import { useGlobalSearch } from '../../../hooks/useGlobalSearch'
import { SearchInput } from './SearchInput'
import { SearchOptions } from './SearchOptions'
import { SearchResults } from './SearchResults'
import type { GlobalSearchMatch } from '../../../types/type'
import './index.css'

export function Search(): React.JSX.Element {
  const { query, results, totalCount, isSearching, setSelectedIndex, expandAll, collapseAll } =
    useGlobalSearchStore()
  const { navigateToResult } = useGlobalSearch()

  const handleItemClick = useCallback(
    (match: GlobalSearchMatch, groupIndex: number, matchIndex: number) => {
      setSelectedIndex([groupIndex, matchIndex])
      navigateToResult(match)
    },
    [setSelectedIndex, navigateToResult]
  )

  return (
    <div className="search-panel">
      <div className="search-panel-header">
        <SearchInput />
        <SearchOptions />
      </div>

      <div className="search-panel-body">
        {isSearching && (
          <div className="search-loading">
            <Spin size="small" />
            <span>搜索中...</span>
          </div>
        )}

        {!isSearching && totalCount > 0 && (
          <div className="search-summary">
            <span>
              共 {totalCount} 个结果，来自 {results.length} 个会话
            </span>
            <div className="search-summary-actions">
              <Button type="text" size="small" onClick={expandAll}>
                展开
              </Button>
              <Button type="text" size="small" onClick={collapseAll}>
                折叠
              </Button>
            </div>
          </div>
        )}

        {!isSearching && totalCount > 0 && (
          <SearchResults results={results} onItemClick={handleItemClick} />
        )}

        {!isSearching && query && totalCount === 0 && (
          <Empty description="未找到匹配结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}

        {!isSearching && !query && (
          <div className="search-placeholder">
            <p>输入关键词搜索所有会话</p>
          </div>
        )}
      </div>
    </div>
  )
}
