import React from 'react'
import { Button, Badge, Tooltip } from 'antd'
import { HourglassOutlined } from '@ant-design/icons'

interface QueueButtonProps {
  count: number
  onClick: () => void
}

export function QueueButton({ count, onClick }: QueueButtonProps): React.JSX.Element | null {
  if (count === 0) {
    return null
  }

  return (
    <Tooltip title="消息队列">
      <Badge count={count} size="small" offset={[-4, 4]}>
        <Button type="text" icon={<HourglassOutlined />} onClick={onClick} />
      </Badge>
    </Tooltip>
  )
}
