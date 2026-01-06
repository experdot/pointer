import React, { useCallback, useRef, useEffect } from 'react'
import { Input, Button, Tooltip } from 'antd'
import type { InputRef } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import { useGlobalSearchStore } from '../../../stores/globalSearchStore'
import { useLayoutStore } from '../../../stores/layoutStore'

export function SearchInput(): React.JSX.Element {
  const { query, setQuery, options, setOptions, clearSearch, triggerSearch } =
    useGlobalSearchStore()
  const activePanel = useLayoutStore((state) => state.activePanel)
  const inputRef = useRef<InputRef>(null)

  // 当切换到搜索面板时自动聚焦
  useEffect(() => {
    if (activePanel === 'search') {
      inputRef.current?.focus()
    }
  }, [activePanel])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value)
    },
    [setQuery]
  )

  const handleClear = useCallback(() => {
    clearSearch()
    inputRef.current?.focus()
  }, [clearSearch])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClear()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        triggerSearch()
      }
    },
    [handleClear, triggerSearch]
  )

  const toggleOption = useCallback(
    (key: 'matchCase' | 'useRegex' | 'matchWholeWord') => {
      setOptions({ [key]: !options[key] })
    },
    [options, setOptions]
  )

  return (
    <div className="search-input-container">
      <Input
        ref={inputRef}
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="搜索消息内容..."
        allowClear={false}
        suffix={
          <div className="search-input-actions">
            <Tooltip title="区分大小写">
              <Button
                type={options.matchCase ? 'primary' : 'text'}
                size="small"
                onClick={() => toggleOption('matchCase')}
              >
                Aa
              </Button>
            </Tooltip>
            <Tooltip title="使用正则表达式">
              <Button
                type={options.useRegex ? 'primary' : 'text'}
                size="small"
                onClick={() => toggleOption('useRegex')}
              >
                .*
              </Button>
            </Tooltip>
            <Tooltip title="全词匹配">
              <Button
                type={options.matchWholeWord ? 'primary' : 'text'}
                size="small"
                onClick={() => toggleOption('matchWholeWord')}
              >
                W
              </Button>
            </Tooltip>
            {query && (
              <Tooltip title="清除 (Esc)">
                <Button type="text" size="small" icon={<CloseOutlined />} onClick={handleClear} />
              </Tooltip>
            )}
          </div>
        }
      />
    </div>
  )
}
