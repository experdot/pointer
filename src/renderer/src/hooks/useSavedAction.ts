import { App } from 'antd'
import { useCallback } from 'react'
import { command, errorMessage } from '../runtime/client'

/** 未保存回答阻止切换时，让用户先重试落盘或留在当前工作区。 */
export function useSavedAction(): (action: () => Promise<unknown>) => Promise<boolean> {
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
            title: '回答尚未保存',
            content: '请先保存回答，再继续当前操作。取消后会保留当前工作区和回答。',
            okText: '重试保存',
            cancelText: '取消',
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
