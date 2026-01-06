import React, { useCallback, useMemo } from 'react'
import { Select, Collapse, Tag } from 'antd'
import { FilterOutlined } from '@ant-design/icons'
import { useGlobalSearchStore } from '../../../stores/globalSearchStore'
import { useFoldersStore } from '../../../stores/foldersStore'
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
  const { folders } = useFoldersStore()

  const handleOptionChange = useCallback(
    (key: keyof GlobalSearchOptions, value: boolean | string) => {
      setOptions({ [key]: value })
    },
    [setOptions]
  )

  const handleFolderChange = useCallback(
    (folderIds: string[]) => {
      setOptions({ folderIds: folderIds.length > 0 ? folderIds : undefined })
    },
    [setOptions]
  )

  const clearFolderFilter = useCallback(() => {
    setOptions({ folderIds: undefined })
  }, [setOptions])

  // 构建文件夹选项（扁平列表，带层级前缀）
  const folderOptions = useMemo(() => {
    const buildOptions = (
      parentId: string | undefined,
      prefix: string
    ): { value: string; label: string }[] => {
      const children = folders
        .filter((f) => f.parentFolderId === parentId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

      const result: { value: string; label: string }[] = []
      for (const folder of children) {
        result.push({ value: folder.id, label: prefix + folder.name })
        result.push(...buildOptions(folder.id, prefix + '  '))
      }
      return result
    }
    return buildOptions(undefined, '')
  }, [folders])

  // 获取已选文件夹的名称
  const selectedFolderNames = useMemo(() => {
    if (!options.folderIds || options.folderIds.length === 0) return []
    return options.folderIds
      .map((id) => folders.find((f) => f.id === id)?.name)
      .filter(Boolean) as string[]
  }, [options.folderIds, folders])

  return (
    <div className="search-options">
      {/* 显示已选文件夹标签 */}
      {selectedFolderNames.length > 0 && (
        <div className="search-folder-tags">
          {selectedFolderNames.map((name, index) => (
            <Tag key={options.folderIds?.[index]} closable onClose={clearFolderFilter}>
              {name}
            </Tag>
          ))}
        </div>
      )}
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
                {folders.length > 0 && (
                  <div className="search-filter-item">
                    <span className="search-filter-title">文件夹</span>
                    <Select
                      mode="multiple"
                      size="small"
                      value={options.folderIds || []}
                      onChange={handleFolderChange}
                      options={folderOptions}
                      placeholder="全部文件夹"
                      style={{ width: '100%' }}
                      maxTagCount={1}
                      maxTagPlaceholder={(omitted) => `+${omitted.length}`}
                      allowClear
                    />
                  </div>
                )}
              </div>
            )
          }
        ]}
      />
    </div>
  )
}
