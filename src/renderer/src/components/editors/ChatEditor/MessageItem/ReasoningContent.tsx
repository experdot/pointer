import { t, useI18n } from '@renderer/i18n'
import React from 'react'
import { RightOutlined, DownOutlined } from '@ant-design/icons'
import type { ReasoningContentProps } from './types'

export const ReasoningContent = React.memo(function ReasoningContent({
  content,
  expanded,
  onToggle
}: ReasoningContentProps): React.JSX.Element {
  useI18n()

  return (
    <div
      className={`message-item__reasoning ${expanded ? 'message-item__reasoning--expanded' : ''}`}
    >
      <div className="message-item__reasoning-label" onClick={onToggle}>
        {expanded ? <DownOutlined /> : <RightOutlined />}
        <span>{t('chat.reasoning')}</span>
      </div>
      <div className="message-item__reasoning-content">{content}</div>
    </div>
  )
})
