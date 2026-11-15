import { t, useI18n } from '@renderer/i18n'
import React from 'react'
import { Button, Badge, Tooltip } from 'antd'
import { HourglassOutlined } from '@ant-design/icons'

interface QueueButtonProps {
  count: number
  onClick: () => void
}

export function QueueButton({ count, onClick }: QueueButtonProps): React.JSX.Element | null {
  useI18n()

  if (count === 0) {
    return null
  }

  return (
    <Tooltip title={t('queue.title')}>
      <Badge count={count} size="small" offset={[-4, 4]}>
        <Button type="text" icon={<HourglassOutlined />} onClick={onClick} />
      </Badge>
    </Tooltip>
  )
}
