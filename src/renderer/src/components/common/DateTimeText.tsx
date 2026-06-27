import React from 'react'
import { Tooltip } from 'antd'
import { formatLongDateTime, formatSemanticDateTime, parseDateLike } from '../../utils/dateTime'

interface DateTimeTextProps {
  value: number | string | Date | null | undefined
  className?: string
  style?: React.CSSProperties
  tooltip?: boolean
  emptyText?: string
}

export function DateTimeText({
  value,
  className,
  style,
  tooltip = true,
  emptyText = '-'
}: DateTimeTextProps): React.JSX.Element {
  const date = parseDateLike(value)
  const mergedStyle = { whiteSpace: 'nowrap', ...style }

  if (!date) {
    return (
      <span className={className} style={mergedStyle}>
        {emptyText}
      </span>
    )
  }

  const content = (
    <span className={className} style={mergedStyle}>
      {formatSemanticDateTime(date)}
    </span>
  )

  if (!tooltip) {
    return content
  }

  return <Tooltip title={formatLongDateTime(date)}>{content}</Tooltip>
}
