import React from 'react'
import { Tooltip } from 'antd'
import { formatRelativeTime, formatExactDateTime } from '../../utils/timeFormatter'

interface RelativeTimeProps {
  timestamp: number
  className?: string
  style?: React.CSSProperties
}

/**
 * 相对时间组件
 * 显示相对时间（如"2小时前"），hover时显示具体日期时间
 */
export const RelativeTime: React.FC<RelativeTimeProps> = ({ timestamp, className, style }) => {
  const relativeTime = formatRelativeTime(timestamp)
  const exactTime = formatExactDateTime(timestamp)

  return (
    <Tooltip title={exactTime} placement="top">
      <span className={className} style={{ color: 'rgba(0, 0, 0, 0.3)', ...style }}>
        {relativeTime}
      </span>
    </Tooltip>
  )
}

export default RelativeTime
