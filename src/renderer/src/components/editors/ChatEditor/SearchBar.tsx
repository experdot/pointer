import React, { useEffect, useRef, useCallback } from 'react'
import { Input, Button, Tooltip } from 'antd'
import { SearchOutlined, UpOutlined, DownOutlined, CloseOutlined } from '@ant-design/icons'
import type { InputRef } from 'antd'
import type { ChatMessage } from '../../../types/type'
import { useChatUIStore } from '../../../stores/chatUIStore'
import { useSearchHighlight } from '../../../hooks/useSearchHighlight'
import { isValidRegex } from '../../../utils/searchUtils'
import './SearchBar.css'

interface SearchBarProps {
  pageId: string
  messages: ChatMessage[]
  containerRef: React.RefObject<HTMLElement | null>
}

export function SearchBar({ pageId, messages, containerRef }: SearchBarProps): React.JSX.Element {
  const inputRef = useRef<InputRef>(null)

  const searchState = useChatUIStore((state) => state.getState(pageId).search)
  const setSearchQuery = useChatUIStore((state) => state.setSearchQuery)
  const setSearchCurrentIndex = useChatUIStore((state) => state.setSearchCurrentIndex)
  const setSearchOptions = useChatUIStore((state) => state.setSearchOptions)
  const setSearchOpen = useChatUIStore((state) => state.setSearchOpen)

  // 使用搜索高亮 Hook
  const { total, scrollToMatch } = useSearchHighlight({
    containerRef,
    messages,
    searchState,
    pageId
  })

  // 自动聚焦并选中输入框
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 50)
    return () => clearTimeout(timer)
  }, [searchState.focusRequestKey])

  // 当 currentIndex 变化时滚动到对应位置
  useEffect(() => {
    if (total > 0) {
      scrollToMatch(searchState.currentIndex)
    }
  }, [searchState.currentIndex, total, scrollToMatch])

  // 导航到下一个匹配
  const goToNext = useCallback(() => {
    if (total === 0) return
    const nextIndex = (searchState.currentIndex + 1) % total
    setSearchCurrentIndex(pageId, nextIndex)
  }, [pageId, searchState.currentIndex, total, setSearchCurrentIndex])

  // 导航到上一个匹配
  const goToPrev = useCallback(() => {
    if (total === 0) return
    const prevIndex = (searchState.currentIndex - 1 + total) % total
    setSearchCurrentIndex(pageId, prevIndex)
  }, [pageId, searchState.currentIndex, total, setSearchCurrentIndex])

  // 关闭搜索栏
  const handleClose = useCallback(() => {
    setSearchOpen(pageId, false)
  }, [pageId, setSearchOpen])

  // 处理输入变化
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(pageId, e.target.value)
    },
    [pageId, setSearchQuery]
  )

  // 处理键盘事件
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) {
          goToPrev()
        } else {
          goToNext()
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    },
    [goToNext, goToPrev, handleClose]
  )

  // 切换选项
  const toggleMatchCase = useCallback(() => {
    setSearchOptions(pageId, { matchCase: !searchState.matchCase })
  }, [pageId, searchState.matchCase, setSearchOptions])

  const toggleUseRegex = useCallback(() => {
    setSearchOptions(pageId, { useRegex: !searchState.useRegex })
  }, [pageId, searchState.useRegex, setSearchOptions])

  const toggleMatchWholeWord = useCallback(() => {
    setSearchOptions(pageId, { matchWholeWord: !searchState.matchWholeWord })
  }, [pageId, searchState.matchWholeWord, setSearchOptions])

  // 检查正则表达式是否有效
  const isRegexValid =
    !searchState.useRegex || !searchState.query || isValidRegex(searchState.query)

  // 计算显示的计数（永远显示）
  const countDisplay = total > 0 ? `${searchState.currentIndex + 1}/${total}` : '0/0'

  return (
    <div className="search-bar">
      <SearchOutlined className="search-bar__icon" />

      <Input
        ref={inputRef}
        className={`search-bar__input ${!isRegexValid ? 'search-bar__input--error' : ''}`}
        value={searchState.query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="搜索..."
        status={!isRegexValid ? 'error' : undefined}
        suffix={
          <div className="search-bar__options">
            <Tooltip title="区分大小写 (Alt+C)">
              <Button
                type={searchState.matchCase ? 'primary' : 'text'}
                size="small"
                onClick={toggleMatchCase}
              >
                Aa
              </Button>
            </Tooltip>

            <Tooltip title="使用正则表达式 (Alt+R)">
              <Button
                type={searchState.useRegex ? 'primary' : 'text'}
                size="small"
                onClick={toggleUseRegex}
              >
                .*
              </Button>
            </Tooltip>

            <Tooltip title="全词匹配 (Alt+W)">
              <Button
                type={searchState.matchWholeWord ? 'primary' : 'text'}
                size="small"
                onClick={toggleMatchWholeWord}
              >
                W
              </Button>
            </Tooltip>
          </div>
        }
      />

      <span className="search-bar__count">{countDisplay}</span>

      <div className="search-bar__nav">
        <Tooltip title="上一个 (Shift+Enter)">
          <Button
            type="text"
            size="small"
            icon={<UpOutlined />}
            onClick={goToPrev}
            disabled={total === 0}
          />
        </Tooltip>

        <Tooltip title="下一个 (Enter)">
          <Button
            type="text"
            size="small"
            icon={<DownOutlined />}
            onClick={goToNext}
            disabled={total === 0}
          />
        </Tooltip>
      </div>

      <Tooltip title="关闭 (Escape)">
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={handleClose}
          className="search-bar__close"
        />
      </Tooltip>
    </div>
  )
}
