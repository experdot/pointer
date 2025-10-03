import { useState, useCallback } from 'react'
import { App } from 'antd'
import { AIService } from '../../../../services/aiService'
import { useAppStores } from '../../../../stores'

export function useAITaskManager() {
  const stores = useAppStores()
  const { message } = App.useApp()

  const [currentAIService, setCurrentAIService] = useState<AIService | null>(null)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)

  const stopCurrentGeneration = useCallback(async () => {
    if (currentAIService) {
      try {
        await currentAIService.stopStreaming()

        if (currentTaskId) {
          stores.aiTasks.updateTask(currentTaskId, {
            status: 'cancelled',
            endTime: Date.now()
          })
        }

        setCurrentAIService(null)
        setCurrentTaskId(null)
        message.info('已停止生成')
      } catch (error) {
        console.error('停止生成失败:', error)
        message.error('停止生成失败')
      }
    }
  }, [currentAIService, currentTaskId, stores.aiTasks, message])

  const clearAIService = useCallback(() => {
    setCurrentAIService(null)
    setCurrentTaskId(null)
  }, [])

  return {
    currentAIService,
    currentTaskId,
    setCurrentAIService,
    setCurrentTaskId,
    stopCurrentGeneration,
    clearAIService
  }
}
