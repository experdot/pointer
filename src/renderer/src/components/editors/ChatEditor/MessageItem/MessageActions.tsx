import { t, useI18n } from '@renderer/i18n'
import React from 'react'
import { Button, Tooltip, Popconfirm } from 'antd'
import {
  CopyOutlined,
  CheckOutlined,
  EditOutlined,
  ReloadOutlined,
  ArrowDownOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import type { MessageActionsProps } from './types'

export const MessageActions = React.memo(function MessageActions({
  isUser,
  isAssistant,
  isLeaf,
  copied,
  onCopy,
  onStartEdit,
  onRetry,
  onContinue,
  onDelete
}: MessageActionsProps): React.JSX.Element {
  useI18n()

  return (
    <div className="message-item__actions">
      <Tooltip title={copied ? t('common.copied') : t('common.copy')}>
        <Button
          aria-label={copied ? t('common.copied') : t('common.copy')}
          type="text"
          size="small"
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          onClick={onCopy}
        />
      </Tooltip>
      <Tooltip title={t('common.edit')}>
        <Button
          aria-label={t('common.edit')}
          type="text"
          size="small"
          icon={<EditOutlined />}
          onClick={onStartEdit}
        />
      </Tooltip>
      {isAssistant && (
        <Tooltip title={t('common.retry')}>
          <Button
            aria-label={t('common.retry')}
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={onRetry}
          />
        </Tooltip>
      )}
      {isUser && isLeaf && (
        <Tooltip title={t('chat.continue')}>
          <Button
            aria-label={t('chat.continue')}
            type="text"
            size="small"
            icon={<ArrowDownOutlined />}
            onClick={onContinue}
          />
        </Tooltip>
      )}
      <Popconfirm
        title={t('chat.deleteMessage')}
        onConfirm={onDelete}
        okText={t('common.delete')}
        cancelText={t('common.cancel')}
      >
        <Tooltip title={t('common.delete')}>
          <Button
            aria-label={t('common.delete')}
            type="text"
            size="small"
            icon={<DeleteOutlined />}
          />
        </Tooltip>
      </Popconfirm>
    </div>
  )
})
