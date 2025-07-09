import React from 'react'
import { Button, Space, Typography } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'

const { Text } = Typography

interface BranchNavigatorProps {
  currentIndex: number
  totalBranches: number
  onPrevious: () => void
  onNext: () => void
  className?: string
}

export default function BranchNavigator({
  currentIndex,
  totalBranches,
  onPrevious,
  onNext,
  className = ''
}: BranchNavigatorProps) {
  if (totalBranches <= 1) {
    return null
  }

  return (
    <div className={`branch-navigator ${className}`}>
      <Space size="small">
        <Button
          type="text"
          size="small"
          icon={<LeftOutlined />}
          onClick={onPrevious}
          disabled={currentIndex === 0}
          className="branch-nav-btn"
        />
        <Text type="secondary" className="branch-info">
          {currentIndex + 1} / {totalBranches}
        </Text>
        <Button
          type="text"
          size="small"
          icon={<RightOutlined />}
          onClick={onNext}
          disabled={currentIndex === totalBranches - 1}
          className="branch-nav-btn"
        />
      </Space>
    </div>
  )
}
