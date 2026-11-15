import { t, useI18n } from '@renderer/i18n'
import React from 'react'
import { Modal } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'

export interface MoveConflictInfo {
  type: 'page' | 'folder'
  id: string
  name: string
  targetFolderId: string | undefined
}

interface MoveConflictModalProps {
  open: boolean
  conflict: MoveConflictInfo | null
  onCancel: () => void
  onAutoRename: () => void
}

export function MoveConflictModal({
  open,
  conflict,
  onCancel,
  onAutoRename
}: MoveConflictModalProps): React.JSX.Element {
  useI18n()

  return (
    <Modal
      title={
        <span>
          <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
          {t('tree.nameConflict')}
        </span>
      }
      open={open}
      onCancel={onCancel}
      okText={t('tree.autoRename')}
      cancelText={t('common.cancel')}
      onOk={onAutoRename}
      width={400}
    >
      <p>
        {t(conflict?.type === 'folder' ? 'tree.folderConflict' : 'tree.pageConflict', {
          name: conflict?.name ?? ''
        })}
      </p>
      <p>{t('tree.chooseAction')}</p>
      <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
        <li>
          <strong>{t('tree.autoRename')}</strong>
          {t('tree.autoRenameDescription')}
        </li>
        <li>
          <strong>{t('common.cancel')}</strong>
          {t('tree.cancelMoveDescription')}
        </li>
      </ul>
    </Modal>
  )
}
