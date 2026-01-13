import React, { useMemo, useState, useCallback, useRef } from 'react'
import { Dropdown, Button, Tooltip, Progress } from 'antd'
import {
  UnorderedListOutlined,
  FolderOutlined,
  TagOutlined,
  UserOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  ApartmentOutlined,
  RightOutlined,
  DownOutlined
} from '@ant-design/icons'
import { AIGeneratePopover, type GenerateOptions } from '../../common/AIGeneratePopover'
import type { OutlineNode } from '../../../types/type'
import './OutlineDropdown.css'

// 空心圆点图标（用于无标题消息）
const HollowCircleIcon = (): React.JSX.Element => (
  <svg viewBox="0 0 16 16" width="1em" height="1em" fill="currentColor">
    <circle cx="8" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

interface OutlineDropdownProps {
  outline: OutlineNode[]
  onNavigateToMessage: (messageId: string) => void
  onBatchGenerateTitles?: (options: GenerateOptions) => Promise<void>
  onSmartSegment?: (options: GenerateOptions) => Promise<void>
  /** 批量生成进度 { current, total } */
  batchProgress?: { current: number; total: number } | null
  isSegmenting?: boolean
  /** 无标题消息数量 */
  untitledCount?: number
}

export function OutlineDropdown({
  outline,
  onNavigateToMessage,
  onBatchGenerateTitles,
  onSmartSegment,
  batchProgress,
  isSegmenting,
  untitledCount = 0
}: OutlineDropdownProps): React.JSX.Element {
  const isGenerating = !!batchProgress

  // Dropdown 状态
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Popover 状态
  const [batchTitlePopoverOpen, setBatchTitlePopoverOpen] = useState(false)
  const [segmentPopoverOpen, setSegmentPopoverOpen] = useState(false)

  // Dropdown 关闭时，同时关闭内部的 Popover
  const handleDropdownOpenChange = useCallback((open: boolean) => {
    setDropdownOpen(open)
    if (!open) {
      setBatchTitlePopoverOpen(false)
      setSegmentPopoverOpen(false)
    }
  }, [])

  // Outline 独立的折叠状态（不与消息列表同步）
  const [collapsedTopics, setCollapsedTopics] = useState<Set<string>>(new Set())

  // Dropdown 内容容器 ref，用于 Popover 渲染
  const dropdownRef = useRef<HTMLDivElement>(null)
  const getPopupContainer = useCallback(() => dropdownRef.current || document.body, [])

  const toggleCollapse = useCallback((topicId: string) => {
    setCollapsedTopics((prev) => {
      const next = new Set(prev)
      if (next.has(topicId)) {
        next.delete(topicId)
      } else {
        next.add(topicId)
      }
      return next
    })
  }, [])

  // 扁平化渲染大纲节点
  const renderOutlineItems = useMemo(() => {
    const items: React.ReactNode[] = []

    const renderNode = (node: OutlineNode, depth: number = 0, prefix: string = ''): void => {
      const isTopic = node.type === 'topic'
      const isUntitled = node.type === 'untitled'
      const hasChildren = node.children && node.children.length > 0
      // 使用本地折叠状态
      const isCollapsed = node.topicId ? collapsedTopics.has(node.topicId) : false

      // 根据节点类型确定样式类
      const itemClass = isTopic
        ? 'outline-dropdown__item--topic'
        : isUntitled
          ? 'outline-dropdown__item--untitled'
          : 'outline-dropdown__item--title'

      // 根据节点类型确定图标
      const nodeIcon = isTopic ? (
        <FolderOutlined />
      ) : isUntitled ? (
        <HollowCircleIcon />
      ) : (
        <TagOutlined />
      )

      items.push(
        <div key={node.id} className={`outline-dropdown__item ${itemClass}`}>
          {/* 缩进 */}
          <span className="outline-dropdown__indent" style={{ width: depth * 16 }} />

          {/* Topic 折叠/展开按钮 */}
          {isTopic && node.topicId ? (
            <span
              className="outline-dropdown__toggle"
              onClick={(e) => {
                e.stopPropagation()
                toggleCollapse(node.topicId!)
              }}
            >
              {isCollapsed ? <RightOutlined /> : <DownOutlined />}
            </span>
          ) : (
            <span className="outline-dropdown__toggle-placeholder" />
          )}

          {/* 图标 */}
          <span className="outline-dropdown__icon">{nodeIcon}</span>

          {/* 层级序号前缀 */}
          {prefix && <span className="outline-dropdown__prefix">{prefix}</span>}

          {/* 标题文本 */}
          <span
            className="outline-dropdown__text"
            onClick={() => onNavigateToMessage(node.messageId)}
          >
            {node.title}
          </span>

          {/* 角色标记 */}
          {node.role && (
            <span className="outline-dropdown__role">
              {node.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
            </span>
          )}
        </div>
      )

      // 递归渲染子节点（使用本地折叠状态）
      if (hasChildren && !isCollapsed) {
        let childIndex = 1
        for (const child of node.children!) {
          const childPrefix = prefix ? `${prefix}${childIndex}.` : `${childIndex}.`
          renderNode(child, depth + 1, childPrefix)
          childIndex++
        }
      }
    }

    let rootIndex = 1
    for (const node of outline) {
      renderNode(node, 0, `${rootIndex}.`)
      rootIndex++
    }

    return items
  }, [outline, onNavigateToMessage, collapsedTopics, toggleCollapse])

  const dropdownContent = (
    <div className="outline-dropdown" ref={dropdownRef}>
      {/* 大纲内容 */}
      <div className="outline-dropdown__content">
        {outline.length === 0 ? (
          <div className="outline-dropdown__empty">
            暂无大纲
            <br />
            <small>右键消息可添加标题或分组</small>
          </div>
        ) : (
          renderOutlineItems
        )}
      </div>

      {/* 底部操作栏 */}
      {(onBatchGenerateTitles || onSmartSegment) && (
        <div className="outline-dropdown__footer">
          {batchProgress ? (
            <div className="outline-dropdown__progress">
              <Progress
                percent={Math.round((batchProgress.current / batchProgress.total) * 100)}
                size="small"
                format={() => `${batchProgress.current}/${batchProgress.total}`}
              />
            </div>
          ) : (
            <div className="outline-dropdown__actions">
              {onBatchGenerateTitles && (
                <AIGeneratePopover
                  open={batchTitlePopoverOpen}
                  onOpenChange={setBatchTitlePopoverOpen}
                  mode="batch-title"
                  onGenerate={onBatchGenerateTitles}
                  placement="bottom"
                  getPopupContainer={getPopupContainer}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<ThunderboltOutlined />}
                    loading={isGenerating}
                    disabled={untitledCount === 0}
                    className="outline-dropdown__action-btn"
                  >
                    生成标题{untitledCount > 0 ? ` (${untitledCount})` : ''}
                  </Button>
                </AIGeneratePopover>
              )}
              {onSmartSegment && (
                <AIGeneratePopover
                  open={segmentPopoverOpen}
                  onOpenChange={setSegmentPopoverOpen}
                  mode="smart-segment"
                  onGenerate={onSmartSegment}
                  placement="bottom"
                  getPopupContainer={getPopupContainer}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<ApartmentOutlined />}
                    loading={isSegmenting}
                    disabled={outline.length === 0}
                    className="outline-dropdown__action-btn"
                  >
                    智能分组
                  </Button>
                </AIGeneratePopover>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <Dropdown
      popupRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomLeft"
      open={dropdownOpen}
      onOpenChange={handleDropdownOpenChange}
    >
      <Tooltip title="大纲">
        <Button
          type="text"
          size="small"
          icon={<UnorderedListOutlined />}
          className="branch-path-bar__outline-btn"
        />
      </Tooltip>
    </Dropdown>
  )
}
