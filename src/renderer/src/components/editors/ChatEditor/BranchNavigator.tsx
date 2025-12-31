import React from 'react'
import { Button } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import type { ChatMessage } from '../../../types/type'

interface BranchNavigatorProps {
  currentIndex: number
  totalCount: number
  siblings: ChatMessage[]
  onSwitchBranch: (messageId: string) => void
}

export function BranchNavigator({
  currentIndex,
  totalCount,
  siblings,
  onSwitchBranch
}: BranchNavigatorProps): React.JSX.Element {
  const handlePrev = (): void => {
    if (currentIndex > 0) {
      onSwitchBranch(siblings[currentIndex - 1].id)
    }
  }

  const handleNext = (): void => {
    if (currentIndex < totalCount - 1) {
      onSwitchBranch(siblings[currentIndex + 1].id)
    }
  }

  return (
    <div className="branch-navigator">
      <Button
        type="text"
        size="small"
        icon={<LeftOutlined />}
        disabled={currentIndex === 0}
        onClick={handlePrev}
      />
      <span className="branch-navigator__count">
        {currentIndex + 1}/{totalCount}
      </span>
      <Button
        type="text"
        size="small"
        icon={<RightOutlined />}
        disabled={currentIndex === totalCount - 1}
        onClick={handleNext}
      />
    </div>
  )
}
