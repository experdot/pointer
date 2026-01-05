import React, { useCallback } from 'react'
import { Select, Collapse } from 'antd'
import { FilterOutlined } from '@ant-design/icons'
import { useGlobalSearchStore } from '../../../stores/globalSearchStore'
import type { GlobalSearchOptions } from '../../../types/type'

const roleOptions = [
  { value: 'all', label: '全部角色' },
  { value: 'user', label: '仅用户消息' },
  { value: 'assistant', label: '仅 AI 消息' }
]

const timeOptions = [
  { value: 'all', label: '不限时间' },
  { value: 'today', label: '今天' },
  { value: 'week', label: '最近一周' },
  { value: 'month', label: '最近一月' }
]

export function SearchOptions(): React.JSX.Element {
  const { options, setOptions } = useGlobalSearchStore()

  const handleOptionChange = useCallback(
    (key: keyof GlobalSearchOptions, value: boolean | string) => {
      setOptions({ [key]: value })
    },
    [setOptions]
  )

  return (
    <div className="search-options">
      <Collapse
        ghost
        size="small"
        items={[
          {
            key: 'filters',
            label: (
              <span className="search-filter-label">
                <FilterOutlined /> 筛选条件
              </span>
            ),
            children: (
              <div className="search-filters">
                <div className="search-filter-item">
                  <span className="search-filter-title">角色</span>
                  <Select
                    size="small"
                    value={options.roleFilter}
                    onChange={(value) => handleOptionChange('roleFilter', value)}
                    options={roleOptions}
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="search-filter-item">
                  <span className="search-filter-title">时间</span>
                  <Select
                    size="small"
                    value={options.timeRange}
                    onChange={(value) => handleOptionChange('timeRange', value)}
                    options={timeOptions}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            )
          }
        ]}
      />
    </div>
  )
}
