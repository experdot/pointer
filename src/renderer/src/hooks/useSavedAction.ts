import { t, useI18n } from '@renderer/i18n'
import { App } from 'antd'
import { useCallback } from 'react'
import { command, errorMessage } from '../runtime/client'

/** 未保存回答阻止切换时，让用户先重试落盘或留在当前工作区。 */
export function useSavedAction(): (action: () => Promise<unknown>) => Promise<boolean> {
  useI18n()

  const { modal, message } = App.useApp()
  return useCallback(
    async (action: () => Promise<unknown>) => {
      for (;;) {
        try {
          await action()
          return true
        } catch (error) {
          const failure = error as { code?: string; details?: unknown }
          if (failure.code !== 'chat.unsaved' || !Array.isArray(failure.details)) throw error
          const retry = await modal.confirm({
            title: t('chat.unsaved'),
            content: t('chat.saveBeforeContinuing'),
            okText: t('common.retrySave'),
            cancelText: t('common.cancel'),
            maskClosable: false
          })
          if (!retry) return false
          try {
            for (const requestId of failure.details) {
              if (typeof requestId === 'string') await command('chat.retrySave', { requestId })
            }
          } catch (saveError) {
            message.error(errorMessage(saveError))
          }
        }
      }
    },
    [modal, message]
  )
}
