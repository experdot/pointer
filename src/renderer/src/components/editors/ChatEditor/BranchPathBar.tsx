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
import type { ChatMessage } from '../../../types/type'

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
  onScrollToMessage: (messageId: string) => void
  onScrollToPrev: () => void
  onScrollToNext: () => void
  onCollapseAll?: () => void
  onExpandAll?: () => void
}

export function BranchPathBar({
  messages,
  getChildMessages,
  onSwitchBranch,
  onScrollToMessage,
  onScrollToPrev,
  onScrollToNext,
  onCollapseAll,
  onExpandAll
}: BranchPathBarProps): React.JSX.Element | null {
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

  // 没有分支时不显示
  const hasBranches = keyNodes.some((n) => n.siblings.length > 1)
  if (!hasBranches || messages.length <= 1) return null

  // 获取消息预览文本
  const getPreview = (msg: ChatMessage, maxLen = 20): string => {
    const text = msg.content.replace(/\n/g, ' ').trim()
    return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
  }

  // 获取被省略的节点
  const getSkippedMessages = (fromIndex: number, toIndex: number): ChatMessage[] => {
    return messages.slice(fromIndex + 1, toIndex)
  }

  return (
    <div className="branch-path-bar">
      {keyNodes.map((node, i) => {
        const { message, index, siblings, siblingIndex } = node
        const prevIndex = i > 0 ? keyNodes[i - 1].index : -1
        const skippedCount = index - prevIndex - 1
        const showEllipsis = skippedCount > 0

        const hasBranch = siblings.length > 1

        // 层级标签（点击跳转）
        const levelLabel = (
          <Tooltip title={getPreview(message, 50)} placement="bottom">
            <span className="branch-path-bar__item" onClick={() => onScrollToMessage(message.id)}>
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
                label: `${index + 1}.${idx + 1} ${getPreview(s)}`,
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
                  onClick: () => onScrollToMessage(m.id)
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
          <ArrowUpOutlined className="branch-path-bar__nav-btn" onClick={onScrollToPrev} />
        </Tooltip>
        <Tooltip title="下一条">
          <ArrowDownOutlined className="branch-path-bar__nav-btn" onClick={onScrollToNext} />
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
