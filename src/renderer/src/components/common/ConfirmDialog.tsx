import { t, useI18n } from '@renderer/i18n'
import { App } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { useCallback, useMemo, useRef } from 'react'

interface ConfirmDialogOptions {
  title: string
  content?: React.ReactNode
  okText?: string
  cancelText?: string
  danger?: boolean
  onOk?: () => void | Promise<void>
  onCancel?: () => void
}

// Hook 方式使用确认对话框
export function useConfirmDialog(): {
  showConfirmDialog: (options: ConfirmDialogOptions) => void
  showDeleteConfirm: (options: {
    title?: string
    content?: React.ReactNode
    onOk: () => void | Promise<void>
  }) => void
} {
  useI18n()

  const { modal } = App.useApp()
  // 用 ref 持有 modal：返回的函数保持稳定引用，依赖它们的回调与 memo 才不会被击穿
  const modalRef = useRef(modal)
  modalRef.current = modal

  const showConfirmDialog = useCallback((options: ConfirmDialogOptions): void => {
    const {
      title,
      content,
      okText = t('common.confirm'),
      cancelText = t('common.cancel'),
      danger,
      onOk,
      onCancel
    } = options

    modalRef.current.confirm({
      title,
      content,
      icon: <ExclamationCircleOutlined />,
      okText,
      cancelText,
      okButtonProps: danger ? { danger: true } : undefined,
      onOk,
      onCancel
    })
  }, [])

  const showDeleteConfirm = useCallback(
    (options: {
      title?: string
      content?: React.ReactNode
      onOk: () => void | Promise<void>
    }): void => {
      showConfirmDialog({
        title: options.title || t('common.confirmDelete'),
        content: options.content || t('common.irreversibleDelete'),
        okText: t('common.delete'),
        danger: true,
        onOk: options.onOk
      })
    },
    [showConfirmDialog]
  )

  return useMemo(
    () => ({ showConfirmDialog, showDeleteConfirm }),
    [showConfirmDialog, showDeleteConfirm]
  )
}
