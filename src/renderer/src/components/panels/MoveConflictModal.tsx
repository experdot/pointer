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
  const typeLabel = conflict?.type === 'folder' ? '文件夹' : '对话'

  return (
    <Modal
      title={
        <span>
          <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
          名称冲突
        </span>
      }
      open={open}
      onCancel={onCancel}
      okText="自动重命名"
      cancelText="取消"
      onOk={onAutoRename}
      width={400}
    >
      <p>
        目标位置已存在同名{typeLabel} &ldquo;{conflict?.name}&rdquo;。
      </p>
      <p>请选择：</p>
      <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
        <li>
          <strong>自动重命名</strong>：自动添加编号后缀
        </li>
        <li>
          <strong>取消</strong>：放弃移动操作
        </li>
      </ul>
    </Modal>
  )
}
