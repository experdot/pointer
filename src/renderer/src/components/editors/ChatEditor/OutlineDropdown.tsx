import React, { useMemo } from 'react'
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
import type { OutlineNode } from '../../../types/type'
import type { GenerateMode } from './GenerateTitleModal'

interface OutlineDropdownProps {
  outline: OutlineNode[]
  currentMessageId?: string
  onScrollToMessage: (messageId: string) => void
  onToggleTopicCollapse?: (topicId: string) => void
  onOpenGenerateModal?: (mode: GenerateMode) => void
  /** 批量生成进度 { current, total } */
  batchProgress?: { current: number; total: number } | null
  isSegmenting?: boolean
}

export function OutlineDropdown({
  outline,
  currentMessageId,
  onScrollToMessage,
  onToggleTopicCollapse,
  onOpenGenerateModal,
  batchProgress,
  isSegmenting
}: OutlineDropdownProps): React.JSX.Element {
  const isGenerating = !!batchProgress
  // 扁平化渲染大纲节点
  const renderOutlineItems = useMemo(() => {
    const items: React.ReactNode[] = []

    const renderNode = (node: OutlineNode, depth: number = 0, prefix: string = ''): void => {
      const isActive = node.messageId === currentMessageId
      const isTopic = node.type === 'topic'
      const hasChildren = node.children && node.children.length > 0

      items.push(
        <div
          key={node.id}
          className={`outline-dropdown__item ${isActive ? 'outline-dropdown__item--active' : ''} ${isTopic ? 'outline-dropdown__item--topic' : 'outline-dropdown__item--title'}`}
        >
          {/* 缩进 */}
          <span
            className="outline-dropdown__indent"
            style={{ width: depth * 16 }}
          />

          {/* Topic 折叠/展开按钮 */}
          {isTopic && node.topicId ? (
            <span
              className="outline-dropdown__toggle"
              onClick={(e) => {
                e.stopPropagation()
                onToggleTopicCollapse?.(node.topicId!)
              }}
            >
              {node.collapsed ? <RightOutlined /> : <DownOutlined />}
            </span>
          ) : (
            <span className="outline-dropdown__toggle-placeholder" />
          )}

          {/* 图标 */}
          <span className="outline-dropdown__icon">
            {isTopic ? <FolderOutlined /> : <TagOutlined />}
          </span>

          {/* 层级序号前缀 */}
          {prefix && <span className="outline-dropdown__prefix">{prefix}</span>}

          {/* 标题文本 */}
          <span
            className="outline-dropdown__text"
            onClick={() => onScrollToMessage(node.messageId)}
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

      // 递归渲染子节点（Topic 未折叠时才显示）
      if (hasChildren && !node.collapsed) {
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
  }, [outline, currentMessageId, onScrollToMessage, onToggleTopicCollapse])

  const dropdownContent = (
    <div className="outline-dropdown">
      {/* 大纲内容 */}
      <div className="outline-dropdown__content">
        {outline.length === 0 ? (
          <div className="outline-dropdown__empty">
            暂无大纲
            <br />
            <small>右键消息可添加标题或设为 Topic</small>
          </div>
        ) : (
          renderOutlineItems
        )}
      </div>

      {/* 底部操作栏 */}
      {onOpenGenerateModal && (
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
              <Button
                type="text"
                size="small"
                icon={<ThunderboltOutlined />}
                onClick={() => onOpenGenerateModal('batch-title')}
                loading={isGenerating}
                className="outline-dropdown__action-btn"
              >
                生成标题
              </Button>
              <Button
                type="text"
                size="small"
                icon={<ApartmentOutlined />}
                onClick={() => onOpenGenerateModal('smart-segment')}
                loading={isSegmenting}
                className="outline-dropdown__action-btn"
              >
                智能分段
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <Dropdown
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomLeft"
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
