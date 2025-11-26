import { useMemo, useCallback, useState } from 'react'
import { App } from 'antd'
import { v4 as uuidv4 } from 'uuid'
import { CrosstabMetadata, AITask } from '../../../../types/type'
import { useAppStores } from '../../../../stores'
import { createAIService, AIService } from '../../../../services/aiService'
import {
  PROMPT_TEMPLATES,
  extractJsonContent,
  generateAxisCombinations,
  generateDimensionPath
} from '../CrosstabUtils'

export interface WorkflowStatus {
  topicCompleted: boolean
  structureCompleted: boolean
  axisDataCompleted: boolean
  tableDataCompleted: boolean
}

export interface GenerationState {
  isGeneratingMetadata: boolean
  isGeneratingDimensionValues: { [dimensionId: string]: boolean }
  isGeneratingTableData: boolean
  isGeneratingColumn: string | null
  isGeneratingRow: string | null
  isGeneratingCell: string | null
}

export function useCrosstabWorkflow(chatId: string, selectedModelId: string | undefined) {
  const stores = useAppStores()
  const { message } = App.useApp()

  // 生成状态
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false)
  const [isGeneratingDimensionValues, setIsGeneratingDimensionValues] = useState<{
    [dimensionId: string]: boolean
  }>({})
  const [isGeneratingTableData, setIsGeneratingTableData] = useState(false)
  const [isGeneratingColumn, setIsGeneratingColumn] = useState<string | null>(null)
  const [isGeneratingRow, setIsGeneratingRow] = useState<string | null>(null)
  const [isGeneratingCell, setIsGeneratingCell] = useState<string | null>(null)

  // AI 服务实例管理
  const [currentAIService, setCurrentAIService] = useState<AIService | null>(null)
  const [dimensionAIServices, setDimensionAIServices] = useState<{
    [dimensionId: string]: AIService
  }>({})
  const [tableDataAIService, setTableDataAIService] = useState<AIService | null>(null)

  // 获取 LLM 配置
  const getLLMConfig = useCallback(() => {
    const targetModelId = selectedModelId || stores.settings.settings.defaultLLMId
    return stores.settings.settings.llmConfigs?.find((config) => config.id === targetModelId) || null
  }, [selectedModelId, stores.settings.settings])

  // 获取当前 chat 数据
  const chat = useMemo(() => {
    const foundChat = stores.pages.pages.find((c) => c.id === chatId)
    return foundChat && foundChat.type === 'crosstab' ? foundChat : null
  }, [stores.pages.pages, chatId])

  // 计算工作流状态
  const workflowStatus = useMemo<WorkflowStatus>(() => {
    if (!chat?.crosstabData) {
      return {
        topicCompleted: false,
        structureCompleted: false,
        axisDataCompleted: false,
        tableDataCompleted: false
      }
    }

    const { metadata, tableData } = chat.crosstabData

    const topicCompleted = !!metadata
    const structureCompleted =
      !!metadata &&
      metadata.horizontalDimensions.length > 0 &&
      metadata.verticalDimensions.length > 0 &&
      metadata.valueDimensions.length > 0

    const axisDataCompleted =
      !!metadata &&
      metadata.horizontalDimensions.every((dim) => dim.values && dim.values.length > 0) &&
      metadata.verticalDimensions.every((dim) => dim.values && dim.values.length > 0)

    const tableDataCompleted = Object.keys(tableData || {}).length > 0

    return {
      topicCompleted,
      structureCompleted,
      axisDataCompleted,
      tableDataCompleted
    }
  }, [chat])

  // 生成状态汇总
  const generationState = useMemo<GenerationState>(
    () => ({
      isGeneratingMetadata,
      isGeneratingDimensionValues,
      isGeneratingTableData,
      isGeneratingColumn,
      isGeneratingRow,
      isGeneratingCell
    }),
    [
      isGeneratingMetadata,
      isGeneratingDimensionValues,
      isGeneratingTableData,
      isGeneratingColumn,
      isGeneratingRow,
      isGeneratingCell
    ]
  )

  // 生成元数据
  const generateMetadata = useCallback(
    async (userInput: string) => {
      if (!userInput.trim()) {
        message.error('请输入主题')
        return false
      }

      const llmConfig = getLLMConfig()
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return false
      }

      const modelConfig = stores.settings.getModelConfigForLLM(llmConfig.id)
      if (!modelConfig) {
        message.error('请先在设置中配置模型参数')
        return false
      }

      setIsGeneratingMetadata(true)

      try {
        const prompt = PROMPT_TEMPLATES.metadata.replace(/\[USER_INPUT\]/g, userInput.trim())
        const aiService = createAIService(llmConfig, modelConfig)
        setCurrentAIService(aiService)

        const taskId = uuidv4()
        const task: AITask = {
          id: taskId,
          requestId: aiService.id,
          type: 'crosstab_cell',
          status: 'running',
          title: '生成多维度元数据',
          description: `分析主题"${userInput}"并生成多维度交叉表结构`,
          chatId,
          modelId: llmConfig.id,
          startTime: Date.now()
        }
        stores.aiTasks.addTask(task)

        const result = await new Promise<string>((resolve, reject) => {
          aiService.sendMessage(
            [{ id: 'temp', role: 'user', content: prompt, timestamp: Date.now() }],
            {
              onChunk: () => {},
              onComplete: (response) => resolve(response),
              onError: (error) => reject(error)
            }
          )
        })

        stores.aiTasks.updateTask(taskId, { status: 'completed', endTime: Date.now() })

        const jsonContent = extractJsonContent(result)
        const metadata = JSON.parse(jsonContent)

        // 为维度分配 UUID
        for (const dim of metadata.horizontalDimensions) {
          dim.id = uuidv4()
          dim.values = []
        }
        for (const dim of metadata.verticalDimensions) {
          dim.id = uuidv4()
          dim.values = []
        }
        for (const dim of metadata.valueDimensions) {
          dim.id = uuidv4()
        }

        stores.crosstab.updateCrosstabData(chatId, { metadata })
        message.success('主题结构生成完成')
        return true
      } catch (error) {
        console.error('元数据生成失败:', error)
        message.error(`主题结构生成失败: ${(error as Error).message}`)
        return false
      } finally {
        setCurrentAIService(null)
        setIsGeneratingMetadata(false)
      }
    },
    [chatId, getLLMConfig, stores.aiTasks, stores.crosstab, stores.settings, message]
  )

  // 生成维度值
  const generateDimensionValues = useCallback(
    async (dimensionId: string, dimensionType: 'horizontal' | 'vertical') => {
      if (!chat?.crosstabData?.metadata) {
        message.error('请先完成主题分析')
        return false
      }

      const llmConfig = getLLMConfig()
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return false
      }

      const modelConfig = stores.settings.getModelConfigForLLM(llmConfig.id)
      if (!modelConfig) {
        message.error('请先在设置中配置模型参数')
        return false
      }

      setIsGeneratingDimensionValues((prev) => ({ ...prev, [dimensionId]: true }))

      try {
        const dimensions =
          dimensionType === 'horizontal'
            ? chat.crosstabData.metadata.horizontalDimensions
            : chat.crosstabData.metadata.verticalDimensions

        const dimension = dimensions.find((d) => d.id === dimensionId)
        if (!dimension) {
          message.error('找不到指定的维度')
          return false
        }

        const prompt = PROMPT_TEMPLATES.dimension_values
          .replace('[METADATA_JSON]', JSON.stringify(chat.crosstabData.metadata, null, 2))
          .replace('[DIMENSION_ID]', dimension.id)
          .replace('[DIMENSION_NAME]', dimension.name)
          .replace('[DIMENSION_DESCRIPTION]', dimension.description || '')

        const aiService = createAIService(llmConfig, modelConfig)
        setDimensionAIServices((prev) => ({ ...prev, [dimensionId]: aiService }))

        const taskId = uuidv4()
        const task: AITask = {
          id: taskId,
          requestId: aiService.id,
          type: 'crosstab_cell',
          status: 'running',
          title: '生成维度值',
          description: `生成维度"${dimension.name}"的值列表`,
          chatId,
          modelId: llmConfig.id,
          startTime: Date.now()
        }
        stores.aiTasks.addTask(task)

        const result = await new Promise<string>((resolve, reject) => {
          aiService.sendMessage(
            [{ id: 'temp', role: 'user', content: prompt, timestamp: Date.now() }],
            {
              onChunk: () => {},
              onComplete: (response) => resolve(response),
              onError: (error) => reject(error)
            }
          )
        })

        stores.aiTasks.updateTask(taskId, { status: 'completed', endTime: Date.now() })

        const jsonContent = extractJsonContent(result)
        const values = JSON.parse(jsonContent)

        // 更新维度值
        const updatedDimensions = dimensions.map((d) =>
          d.id === dimensionId ? { ...d, values } : d
        )
        const updatedMetadata = {
          ...chat.crosstabData.metadata,
          [dimensionType === 'horizontal' ? 'horizontalDimensions' : 'verticalDimensions']:
            updatedDimensions
        }
        stores.crosstab.updateCrosstabData(chatId, { metadata: updatedMetadata })

        message.success(`维度"${dimension.name}"的值生成完成`)
        return true
      } catch (error) {
        console.error('维度值生成失败:', error)
        message.error(`维度值生成失败: ${(error as Error).message}`)
        return false
      } finally {
        setDimensionAIServices((prev) => {
          const newServices = { ...prev }
          delete newServices[dimensionId]
          return newServices
        })
        setIsGeneratingDimensionValues((prev) => ({ ...prev, [dimensionId]: false }))
      }
    },
    [chat, chatId, getLLMConfig, stores.aiTasks, stores.crosstab, stores.settings, message]
  )

  // 生成表格数据
  const generateTableData = useCallback(async () => {
    if (!chat?.crosstabData?.metadata) {
      message.error('请先完成主题分析')
      return false
    }

    const { horizontalDimensions, verticalDimensions, valueDimensions } = chat.crosstabData.metadata

    const allDimensionsHaveValues = [...horizontalDimensions, ...verticalDimensions].every(
      (dim) => dim.values && dim.values.length > 0
    )

    if (!allDimensionsHaveValues) {
      message.error('请先为所有维度生成值')
      return false
    }

    if (valueDimensions.length === 0) {
      message.error('请先添加值维度')
      return false
    }

    const llmConfig = getLLMConfig()
    if (!llmConfig) {
      message.error('请先在设置中配置LLM')
      return false
    }

    const modelConfig = stores.settings.getModelConfigForLLM(llmConfig.id)
    if (!modelConfig) {
      message.error('请先在设置中配置模型参数')
      return false
    }

    setIsGeneratingTableData(true)

    try {
      const horizontalCombinations = generateAxisCombinations(horizontalDimensions)
      const verticalCombinations = generateAxisCombinations(verticalDimensions)

      let completedCells = 0
      const totalCells = horizontalCombinations.length * verticalCombinations.length
      const newTableData: { [key: string]: { [key: string]: string } } = {}

      for (const hCombination of horizontalCombinations) {
        for (const vCombination of verticalCombinations) {
          const hPath = generateDimensionPath(hCombination)
          const vPath = generateDimensionPath(vCombination)
          const cellKey = `${hPath}|${vPath}`

          const prompt = PROMPT_TEMPLATES.cell_values
            .replace('[METADATA_JSON]', JSON.stringify(chat.crosstabData.metadata, null, 2))
            .replace('[HORIZONTAL_PATH]', hPath)
            .replace('[VERTICAL_PATH]', vPath)
            .replace('[VALUE_DIMENSIONS]', JSON.stringify(valueDimensions, null, 2))

          const aiService = createAIService(llmConfig, modelConfig)
          setTableDataAIService(aiService)

          const taskId = uuidv4()
          const task: AITask = {
            id: taskId,
            requestId: aiService.id,
            type: 'crosstab_cell',
            status: 'running',
            title: '生成单元格值',
            description: `生成单元格 ${hPath} × ${vPath} 的值 (${completedCells + 1}/${totalCells})`,
            chatId,
            modelId: llmConfig.id,
            startTime: Date.now()
          }
          stores.aiTasks.addTask(task)

          try {
            const result = await new Promise<string>((resolve, reject) => {
              aiService.sendMessage(
                [{ id: 'temp', role: 'user', content: prompt, timestamp: Date.now() }],
                {
                  onChunk: () => {},
                  onComplete: (response) => resolve(response),
                  onError: (error) => reject(error)
                }
              )
            })

            stores.aiTasks.updateTask(taskId, { status: 'completed', endTime: Date.now() })

            const jsonContent = extractJsonContent(result)
            const cellValues = JSON.parse(jsonContent)

            // 处理 AI 生成的数据格式
            const processedCellValues: { [key: string]: string } = {}
            if (valueDimensions.length > 0) {
              const keys = Object.keys(cellValues)
              const hasGenericKeys = keys.some((key) => key.match(/^value\d+$/))

              if (hasGenericKeys) {
                valueDimensions.forEach((dimension, index) => {
                  const genericKey = `value${index + 1}`
                  if (cellValues[genericKey]) {
                    processedCellValues[dimension.id] = cellValues[genericKey]
                  }
                })
              } else {
                valueDimensions.forEach((dimension) => {
                  if (cellValues[dimension.id]) {
                    processedCellValues[dimension.id] = cellValues[dimension.id]
                  }
                })
              }

              if (
                Object.keys(processedCellValues).length === 0 &&
                Object.keys(cellValues).length > 0
              ) {
                const firstDimension = valueDimensions[0]
                const firstValue = Object.values(cellValues)[0]
                processedCellValues[firstDimension.id] = firstValue as string
              }
            }

            // 确保所有维度都有值
            const validatedCellValues: { [key: string]: string } = {}
            valueDimensions.forEach((dim) => {
              validatedCellValues[dim.id] = processedCellValues[dim.id] || ''
            })

            newTableData[cellKey] = validatedCellValues

            // 实时更新 UI
            const currentTableData = stores.crosstab.getCrosstabData(chatId)?.tableData || {}
            const updatedTableData = { ...currentTableData, ...newTableData }
            stores.crosstab.updateCrosstabData(chatId, { tableData: updatedTableData })

            completedCells++
          } catch (error) {
            stores.aiTasks.updateTask(taskId, {
              status: 'failed',
              error: (error as Error).message,
              endTime: Date.now()
            })
            console.error(`单元格 ${cellKey} 生成失败:`, error)
          }
        }
      }

      message.success(`表格数据生成完成 (${completedCells}/${totalCells})`)
      return true
    } catch (error) {
      console.error('表格数据生成失败:', error)
      message.error(`表格数据生成失败: ${(error as Error).message}`)
      return false
    } finally {
      setTableDataAIService(null)
      setIsGeneratingTableData(false)
    }
  }, [chat, chatId, getLLMConfig, stores.aiTasks, stores.crosstab, stores.settings, message])

  // 停止生成
  const stopGeneration = useCallback(async () => {
    if (currentAIService) {
      await currentAIService.stopStreaming()
      setCurrentAIService(null)
      setIsGeneratingMetadata(false)
      message.info('已停止生成')
    }
  }, [currentAIService, message])

  const stopDimensionGeneration = useCallback(
    async (dimensionId: string) => {
      const aiService = dimensionAIServices[dimensionId]
      if (aiService) {
        await aiService.stopStreaming()
        setDimensionAIServices((prev) => {
          const newServices = { ...prev }
          delete newServices[dimensionId]
          return newServices
        })
        setIsGeneratingDimensionValues((prev) => ({ ...prev, [dimensionId]: false }))
        message.info('已停止维度值生成')
      }
    },
    [dimensionAIServices, message]
  )

  const stopTableDataGeneration = useCallback(async () => {
    if (tableDataAIService) {
      await tableDataAIService.stopStreaming()
      setTableDataAIService(null)
      setIsGeneratingTableData(false)
      message.info('已停止表格数据生成')
    }
  }, [tableDataAIService, message])

  return {
    chat,
    workflowStatus,
    generationState,
    generateMetadata,
    generateDimensionValues,
    generateTableData,
    stopGeneration,
    stopDimensionGeneration,
    stopTableDataGeneration,
    getLLMConfig
  }
}
