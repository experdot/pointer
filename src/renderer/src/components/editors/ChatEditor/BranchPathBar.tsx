import React, { useMemo } from 'react'
import { Dropdown, Tooltip } from 'antd'
import {
  RightOutlined,
  EllipsisOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CompressOutlined,
  ExpandOutlined,
  UserOutlined,
  RobotOutlined
} from '@ant-design/icons'
import { OutlineDropdown } from './OutlineDropdown'
import type { ChatMessage, OutlineNode } from '../../../types/type'
import type { GenerateMode } from './GenerateTitleModal'
import './BranchPathBar.css'

const getRoleIcon = (role: ChatMessage['role']): React.ReactNode => {
  return role === 'user' ? <UserOutlined /> : <RobotOutlined />
}

interface KeyNode {
  message: ChatMessage
  index: number // 在完整路径中的索引
  siblings: ChatMessage[]
  siblingIndex: number // 在兄弟中的索引
}

interface BranchPathBarProps {
  messages: ChatMessage[] // 当前路径（从根到叶子）
  getChildMessages: (parentId: string | undefined) => ChatMessage[]
  onSwitchBranch: (messageId: string) => void
  onNavigateToMessage: (messageId: string) => void
  onNavigateToPrev: () => void
  onNavigateToNext: () => void
  onCollapseAll?: () => void
  onExpandAll?: () => void
  // 大纲相关
  outline?: OutlineNode[]
  onOpenGenerateModal?: (mode: GenerateMode) => void
  batchProgress?: { current: number; total: number } | null
  isSegmenting?: boolean
}

export function BranchPathBar({
  messages,
  getChildMessages,
  onSwitchBranch,
  onNavigateToMessage,
  onNavigateToPrev,
  onNavigateToNext,
  onCollapseAll,
  onExpandAll,
  outline,
  onOpenGenerateModal,
  batchProgress,
  isSegmenting
}: BranchPathBarProps): React.JSX.Element {
  // 筛选关键节点：根节点、叶子节点、有分支的节点
  const keyNodes = useMemo(() => {
    if (messages.length === 0) return []

    const nodes: KeyNode[] = []

    messages.forEach((msg, index) => {
      const isRoot = index === 0
      const isLeaf = index === messages.length - 1
      const siblings = getChildMessages(msg.parentMessageId)
      const hasBranch = siblings.length > 1
      const siblingIndex = siblings.findIndex((s) => s.id === msg.id)

      if (isRoot || isLeaf || hasBranch) {
        nodes.push({ message: msg, index, siblings, siblingIndex })
      }
    })

    return nodes
  }, [messages, getChildMessages])

  // 只要有消息就显示路径
  const showBranchPath = messages.length > 0

  // 获取消息预览文本（优先使用 title）
  const getPreview = (msg: ChatMessage, maxLen = 20): string => {
    // 优先使用 title
    if (msg.title) {
      return msg.title.length > maxLen ? msg.title.slice(0, maxLen) + '...' : msg.title
    }
    // 没有 title 时使用 content
    const text = msg.content.replace(/\n/g, ' ').trim()
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
  }

  // 获取被省略的节点
  const getSkippedMessages = (fromIndex: number, toIndex: number): ChatMessage[] => {
    return messages.slice(fromIndex + 1, toIndex)
  }

  return (
    <div className="branch-path-bar">
      {/* 大纲按钮 */}
      <OutlineDropdown
        outline={outline ?? []}
        onNavigateToMessage={onNavigateToMessage}
        onOpenGenerateModal={onOpenGenerateModal}
        batchProgress={batchProgress}
        isSegmenting={isSegmenting}
      />

      {/* 分支路径 */}
      {showBranchPath &&
        keyNodes.map((node, i) => {
          const { message, index, siblings, siblingIndex } = node
          const prevIndex = i > 0 ? keyNodes[i - 1].index : -1
          const skippedCount = index - prevIndex - 1
          const showEllipsis = skippedCount > 0

          const hasBranch = siblings.length > 1

          // 层级标签（点击跳转）
          const levelLabel = (
            <Tooltip title={getPreview(message, 50)} placement="bottom">
              <span
                className="branch-path-bar__item"
                onClick={() => onNavigateToMessage(message.id)}
              >
                {getRoleIcon(message.role)} {index + 1}
              </span>
            </Tooltip>
          )

          // 分支指示器（点击展开下拉）
          const branchIndicator = hasBranch && (
            <Dropdown
              menu={{
                items: siblings.map((s, idx) => ({
                  key: s.id,
                  icon: getRoleIcon(s.role),
                  label: `${index + 1}:${idx + 1} ${getPreview(s)}`,
                  onClick: () => onSwitchBranch(s.id)
                })),
                selectedKeys: [message.id]
              }}
              trigger={['click']}
            >
              <span className="branch-path-bar__branch-indicator">
                ({siblingIndex + 1}/{siblings.length})
              </span>
            </Dropdown>
          )

          // 省略号下拉菜单
          const ellipsisDropdown = showEllipsis && (
            <>
              <RightOutlined className="branch-path-bar__separator" />
              <Dropdown
                menu={{
                  items: getSkippedMessages(prevIndex, index).map((m, idx) => ({
                    key: m.id,
                    icon: getRoleIcon(m.role),
                    label: `${prevIndex + 2 + idx}. ${getPreview(m)}`,
                    onClick: () => onNavigateToMessage(m.id)
                  }))
                }}
                trigger={['click']}
              >
                <span className="branch-path-bar__ellipsis branch-path-bar__ellipsis--clickable">
                  <EllipsisOutlined />
                  <span className="branch-path-bar__ellipsis-count">{skippedCount}</span>
                </span>
              </Dropdown>
            </>
          )

          return (
            <React.Fragment key={message.id}>
              {ellipsisDropdown}
              {i > 0 && <RightOutlined className="branch-path-bar__separator" />}
              {levelLabel}
              {branchIndicator}
            </React.Fragment>
          )
        })}
      <div className="branch-path-bar__nav">
        <Tooltip title="上一条">
          <ArrowUpOutlined className="branch-path-bar__nav-btn" onClick={onNavigateToPrev} />
        </Tooltip>
        <Tooltip title="下一条">
          <ArrowDownOutlined className="branch-path-bar__nav-btn" onClick={onNavigateToNext} />
        </Tooltip>
        <span className="branch-path-bar__nav-divider" />
        <Tooltip title="全部折叠">
          <CompressOutlined className="branch-path-bar__nav-btn" onClick={onCollapseAll} />
        </Tooltip>
        <Tooltip title="全部展开">
          <ExpandOutlined className="branch-path-bar__nav-btn" onClick={onExpandAll} />
        </Tooltip>
      </div>
    </div>
  )
}
