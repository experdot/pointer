import { App } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'

export interface ConfirmDialogOptions {
  title: string
  content?: React.ReactNode
  okText?: string
  cancelText?: string
  danger?: boolean
  onOk?: () => void | Promise<void>
  onCancel?: () => void
}

// Hook 方式使用确认对话框
export function useConfirmDialog() {
  const { modal } = App.useApp()

  const showConfirmDialog = (options: ConfirmDialogOptions) => {
    const { title, content, okText = '确定', cancelText = '取消', danger, onOk, onCancel } = options

    modal.confirm({
      title,
      content,
      icon: <ExclamationCircleOutlined />,
      okText,
      cancelText,
      okButtonProps: danger ? { danger: true } : undefined,
      onOk,
      onCancel
    })
  }

  const showDeleteConfirm = (options: {
    title?: string
    content?: React.ReactNode
    onOk: () => void | Promise<void>
  }) => {
    showConfirmDialog({
      title: options.title || '确认删除',
      content: options.content || '此操作不可撤销，确定要删除吗？',
      okText: '删除',
      danger: true,
      onOk: options.onOk
    })
  }

  return { showConfirmDialog, showDeleteConfirm }
}
