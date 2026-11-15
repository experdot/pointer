import { t, useI18n } from '@renderer/i18n'
import React, { useCallback } from 'react'
import { Empty, Spin, Button } from 'antd'
import { useGlobalSearchStore } from '../../../stores/globalSearchStore'
import { useGlobalSearch } from '../../../hooks/useGlobalSearch'
import { SearchInput } from './SearchInput'
import { SearchOptions } from './SearchOptions'
import { SearchResults } from './SearchResults'
import type { SearchMatch } from '@renderer/types/shared'
import './index.css'

export function Search(): React.JSX.Element {
  useI18n()

  const { query, results, totalCount, isSearching, setSelectedIndex, expandAll, collapseAll } =
    useGlobalSearchStore()
  const { navigateToResult } = useGlobalSearch()

  const handleItemClick = useCallback(
    (match: SearchMatch, pageIndex: number, messageIndex: number, matchIndex: number) => {
      setSelectedIndex([pageIndex, messageIndex, matchIndex])
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
            <span>{t('search.searching')}</span>
          </div>
        )}

        {!isSearching && totalCount > 0 && (
          <div className="search-summary">
            <span>
              {t('search.summary', {
                matches: t('search.matches', { count: totalCount }),
                conversations: t('common.conversationCount', { count: results.length })
              })}
            </span>
            <div className="search-summary-actions">
              <Button type="text" size="small" onClick={expandAll}>
                {t('common.expand')}
              </Button>
              <Button type="text" size="small" onClick={collapseAll}>
                {t('common.collapse')}
              </Button>
            </div>
          </div>
        )}

        {!isSearching && totalCount > 0 && (
          <SearchResults results={results} onItemClick={handleItemClick} />
        )}

        {!isSearching && query && totalCount === 0 && (
          <Empty description={t('search.noResults')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}

        {!isSearching && !query && (
          <div className="search-placeholder">
            <p>{t('search.hint')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
