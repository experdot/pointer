import { useState, useCallback } from 'react'
import { App } from 'antd'
import { AIService } from '../../../../services/aiService'
import { useAppStores } from '../../../../stores'

export function useTableDataAIManager() {
  const stores = useAppStores()
  const { message } = App.useApp()

  const [tableDataAIService, setTableDataAIService] = useState<AIService | null>(null)
  const [tableDataTaskIds, setTableDataTaskIds] = useState<string[]>([])
  const [generateTableDataLoading, setGenerateTableDataLoading] = useState(false)

  const stopTableDataGeneration = useCallback(async () => {
    if (tableDataAIService) {
      try {
        await tableDataAIService.stopStreaming()

        tableDataTaskIds.forEach((taskId) => {
          stores.aiTasks.updateTask(taskId, {
            status: 'cancelled',
            endTime: Date.now()
          })
        })

        setTableDataAIService(null)
        setTableDataTaskIds([])
        setGenerateTableDataLoading(false)
        message.info('已停止表格数据生成')
      } catch (error) {
        console.error('停止表格数据生成失败:', error)
        message.error('停止表格数据生成失败')
      }
    }
  }, [tableDataAIService, tableDataTaskIds, stores.aiTasks, message])

  const registerTableDataAI = useCallback((aiService: AIService, taskIds: string[]) => {
    setTableDataAIService(aiService)
    setTableDataTaskIds(taskIds)
  }, [])

  const clearTableDataAI = useCallback(() => {
    setTableDataAIService(null)
    setTableDataTaskIds([])
  }, [])

  return {
    tableDataAIService,
    tableDataTaskIds,
    generateTableDataLoading,
    setGenerateTableDataLoading,
    stopTableDataGeneration,
    registerTableDataAI,
    clearTableDataAI
  }
}
