import { useState, useCallback } from 'react'
import { App } from 'antd'
import { AIService } from '../../../../services/aiService'
import { useAppStores } from '../../../../stores'

export function useDimensionAIManager() {
  const stores = useAppStores()
  const { message } = App.useApp()

  const [dimensionAIServices, setDimensionAIServices] = useState<{
    [dimensionId: string]: AIService
  }>({})
  const [dimensionTaskIds, setDimensionTaskIds] = useState<{
    [dimensionId: string]: string
  }>({})
  const [generateDimensionValuesLoading, setGenerateDimensionValuesLoading] = useState<{
    [dimensionId: string]: boolean
  }>({})

  const stopDimensionGeneration = useCallback(
    async (dimensionId: string) => {
      const aiService = dimensionAIServices[dimensionId]
      const taskId = dimensionTaskIds[dimensionId]

      if (aiService) {
        try {
          await aiService.stopStreaming()

          if (taskId) {
            stores.aiTasks.updateTask(taskId, {
              status: 'cancelled',
              endTime: Date.now()
            })
          }

          setDimensionAIServices((prev) => {
            const newServices = { ...prev }
            delete newServices[dimensionId]
            return newServices
          })
          setDimensionTaskIds((prev) => {
            const newTaskIds = { ...prev }
            delete newTaskIds[dimensionId]
            return newTaskIds
          })
          setGenerateDimensionValuesLoading((prev) => ({ ...prev, [dimensionId]: false }))
          message.info('已停止维度值生成')
        } catch (error) {
          console.error('停止维度值生成失败:', error)
          message.error('停止维度值生成失败')
        }
      }
    },
    [dimensionAIServices, dimensionTaskIds, stores.aiTasks, message]
  )

  const setDimensionLoading = useCallback((dimensionId: string, loading: boolean) => {
    setGenerateDimensionValuesLoading((prev) => ({ ...prev, [dimensionId]: loading }))
  }, [])

  const registerDimensionAI = useCallback(
    (dimensionId: string, aiService: AIService, taskId: string) => {
      setDimensionAIServices((prev) => ({ ...prev, [dimensionId]: aiService }))
      setDimensionTaskIds((prev) => ({ ...prev, [dimensionId]: taskId }))
    },
    []
  )

  const clearDimensionAI = useCallback((dimensionId: string) => {
    setDimensionAIServices((prev) => {
      const newServices = { ...prev }
      delete newServices[dimensionId]
      return newServices
    })
    setDimensionTaskIds((prev) => {
      const newTaskIds = { ...prev }
      delete newTaskIds[dimensionId]
      return newTaskIds
    })
  }, [])

  return {
    dimensionAIServices,
    dimensionTaskIds,
    generateDimensionValuesLoading,
    stopDimensionGeneration,
    setDimensionLoading,
    registerDimensionAI,
    clearDimensionAI
  }
}
