import React from 'react'
import { Button, Tooltip } from 'antd'
import type { ButtonType } from 'antd/es/button'

interface ToolbarButtonProps {
  tooltip: string
  icon: React.ReactNode
  onClick: () => void
  type?: ButtonType
  danger?: boolean
  disabled?: boolean
}

export const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  tooltip,
  icon,
  onClick,
  type = 'default',
  danger = false,
  disabled = false
}) => {
  return (
    <Tooltip title={tooltip}>
      <Button
        type={type}
        size="middle"
        icon={icon}
        onClick={onClick}
        danger={danger}
        disabled={disabled}
        style={{ borderRadius: '6px', color: danger ? undefined : '#666' }}
      />
    </Tooltip>
  )
}
