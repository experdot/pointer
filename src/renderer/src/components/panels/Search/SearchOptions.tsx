import { t, useI18n } from '@renderer/i18n'
import { compareNodes } from '@shared/domain'
import React, { useCallback, useMemo } from 'react'
import { Select, Collapse, Tag } from 'antd'
import { FilterOutlined } from '@ant-design/icons'
import { useGlobalSearchStore } from '../../../stores/globalSearchStore'
import { useFoldersStore } from '../../../stores/foldersStore'
import type { SearchOptions } from '@renderer/types/shared'

const roleOptions = [
  {
    value: 'all',
    get label(): string {
      return t('search.allRoles')
    }
  },
  {
    value: 'user',
    get label(): string {
      return t('search.userOnly')
    }
  },
  {
    value: 'assistant',
    get label(): string {
      return t('search.assistantOnly')
    }
  }
]

const timeOptions = [
  {
    value: 'all',
    get label(): string {
      return t('search.anyTime')
    }
  },
  {
    value: 'today',
    get label(): string {
      return t('time.today')
    }
  },
  {
    value: 'week',
    get label(): string {
      return t('time.lastWeek')
    }
  },
  {
    value: 'month',
    get label(): string {
      return t('time.lastMonth')
    }
  }
]

export function SearchOptions(): React.JSX.Element {
  useI18n()

  const { options, setOptions } = useGlobalSearchStore()
  const { folders } = useFoldersStore()

  const handleOptionChange = useCallback(
    (key: keyof SearchOptions, value: boolean | string) => {
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
      const children = folders.filter((f) => f.parentFolderId === parentId).sort(compareNodes)

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
                <FilterOutlined /> {t('search.filters')}
              </span>
            ),
            children: (
              <div className="search-filters">
                <div className="search-filter-item">
                  <span className="search-filter-title">{t('search.role')}</span>
                  <Select
                    value={options.roleFilter}
                    onChange={(value) => handleOptionChange('roleFilter', value)}
                    options={roleOptions.map((option) => ({ ...option }))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="search-filter-item">
                  <span className="search-filter-title">{t('common.time')}</span>
                  <Select
                    value={options.timeRange}
                    onChange={(value) => handleOptionChange('timeRange', value)}
                    options={timeOptions.map((option) => ({ ...option }))}
                    style={{ width: '100%' }}
                  />
                </div>
                {folders.length > 0 && (
                  <div className="search-filter-item">
                    <span className="search-filter-title">{t('common.folders')}</span>
                    <Select
                      mode="multiple"
                      value={options.folderIds || []}
                      onChange={handleFolderChange}
                      options={folderOptions}
                      placeholder={t('search.allFolders')}
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
