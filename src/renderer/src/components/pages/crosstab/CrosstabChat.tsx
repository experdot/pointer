import React, { useState, useCallback, useMemo } from 'react'
import { Typography, Tabs, App, Space, Badge } from 'antd'
import {
  FileTextOutlined,
  BorderOutlined,
  ColumnWidthOutlined,
  TableOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'

import { usePagesStore } from '../../../stores/pagesStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useCrosstabStore } from '../../../stores/crosstabStore'
import { useAITasksStore } from '../../../stores/aiTasksStore'
import { createAIService } from '../../../services/aiService'
import {
  PROMPT_TEMPLATES,
  extractJsonContent,
  generateAxisCombinations,
  generateDimensionPath
} from './CrosstabUtils'
import { AITask } from '../../../types/type'
import { v4 as uuidv4 } from 'uuid'
import TopicInput from './TopicInput'
import MetadataDisplay from './MetadataDisplay'
import AxisDataManager from './AxisDataManager'
import CrosstabTable from './CrosstabTable'
import PageLineageDisplay from '../../common/PageLineageDisplay'
import ModelSelector from '../chat/ModelSelector'
import { useCrosstabWorkflow } from './hooks/useCrosstabWorkflow'
import './crosstab-page.css'

const { Title } = Typography

interface CrosstabChatProps {
  chatId: string
}

export default function CrosstabChat({ chatId }: CrosstabChatProps) {
  const { pages, createAndOpenChat } = usePagesStore()
  const { settings, getModelConfigForLLM } = useSettingsStore()
  const { updateCrosstabData, updateCrosstabStep, completeCrosstabStep } = useCrosstabStore()
  const { addTask, updateTask } = useAITasksStore()
  const [userInput, setUserInput] = useState('')
  const [activeTab, setActiveTab] = useState('0')
  const [selectedModel, setSelectedModel] = useState<string | undefined>(settings.defaultLLMId)
  const [isGeneratingColumn, setIsGeneratingColumn] = useState<string | null>(null)
  const [isGeneratingRow, setIsGeneratingRow] = useState<string | null>(null)
  const [isGeneratingCell, setIsGeneratingCell] = useState<string | null>(null)
  const [isGeneratingTopicSuggestions, setIsGeneratingTopicSuggestions] = useState(false)
  const [isGeneratingDimensionSuggestions, setIsGeneratingDimensionSuggestions] = useState<{
    [dimensionId: string]: boolean
  }>({})
  const [isGeneratingDimensionValues, setIsGeneratingDimensionValues] = useState<{
    [dimensionId: string]: boolean
  }>({})
  const { message } = App.useApp()

  // 使用工作流 hook
  const {
    chat,
    workflowStatus,
    generationState,
    generateMetadata,
    generateDimensionValues,
    generateTableData,
    stopGeneration
  } = useCrosstabWorkflow(chatId, selectedModel)

  const getLLMConfig = useCallback(() => {
    const targetModelId = selectedModel || settings.defaultLLMId
    return settings.llmConfigs?.find((config) => config.id === targetModelId) || null
  }, [selectedModel, settings.llmConfigs, settings.defaultLLMId])

  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModel(modelId)
  }, [])

  // 生成元数据并在完成后显示继续按钮
  const handleGenerateMetadata = useCallback(async () => {
    const success = await generateMetadata(userInput)
    if (success) {
      // 生成成功后保持在当前 tab，用户可以点击继续按钮跳转
    }
  }, [generateMetadata, userInput])

  // 切换到下一个 tab
  const handleGoToNextTab = useCallback(
    (nextTab: string) => {
      setActiveTab(nextTab)
    },
    []
  )

  const handleGenerateColumn = useCallback(
    async (columnPath: string) => {
      if (!chat || isGeneratingColumn) return

      const llmConfig = getLLMConfig()
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      if (!chat.crosstabData.metadata) {
        message.error('请先完成主题设置')
        return
      }

      const { verticalDimensions } = chat.crosstabData.metadata
      const hasVerticalData = verticalDimensions.every((dim) => dim.values.length > 0)

      if (!hasVerticalData) {
        message.error('请先完成纵轴维度数据生成')
        return
      }

      setIsGeneratingColumn(columnPath)

      try {
        const verticalCombinations = generateAxisCombinations(
          chat.crosstabData.metadata.verticalDimensions
        )
        const modelConfig = getModelConfigForLLM(llmConfig.id)
        if (!modelConfig) {
          message.error('请先在设置中配置模型参数')
          return
        }
        const aiService = createAIService(llmConfig, modelConfig)

        const updatedTableData = { ...chat.crosstabData.tableData }

        for (const vCombination of verticalCombinations) {
          const rowPath = generateDimensionPath(vCombination)
          const cellKey = `${columnPath}|${rowPath}`

          const taskId = uuidv4()
          const task: AITask = {
            id: taskId,
            requestId: aiService.id,
            type: 'crosstab_cell',
            status: 'running',
            title: '生成单元格数据',
            description: `生成单元格 ${columnPath} × ${rowPath} 的数据`,
            chatId,
            modelId: llmConfig.id,
            startTime: Date.now()
          }

          addTask(task)

          try {
            const prompt = PROMPT_TEMPLATES.cell_values
              .replace('[METADATA_JSON]', JSON.stringify(chat.crosstabData.metadata, null, 2))
              .replace('[HORIZONTAL_PATH]', columnPath)
              .replace('[VERTICAL_PATH]', rowPath)
              .replace(
                '[VALUE_DIMENSIONS]',
                JSON.stringify(chat.crosstabData.metadata.valueDimensions, null, 2)
              )

            const response = await new Promise<string>((resolve, reject) => {
              aiService.sendMessage(
                [{ id: 'temp', role: 'user', content: prompt, timestamp: Date.now() }],
                {
                  onChunk: () => {},
                  onComplete: (response) => resolve(response),
                  onError: (error) => reject(error)
                }
              )
            })

            const jsonContent = extractJsonContent(response)
            const cellValues = JSON.parse(jsonContent)

            const processedCellValues: { [key: string]: string } = {}
            if (chat.crosstabData.metadata.valueDimensions.length > 0) {
              const valueDimensions = chat.crosstabData.metadata.valueDimensions

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

            updatedTableData[cellKey] = processedCellValues

            updateTask(taskId, {
              status: 'completed',
              endTime: Date.now()
            })
          } catch (error) {
            updateTask(taskId, {
              status: 'failed',
              endTime: Date.now(),
              error: error instanceof Error ? error.message : 'Unknown error'
            })
            console.error(`单元格 ${cellKey} 生成失败:`, error)
          }
        }

        updateCrosstabData(chatId, { tableData: updatedTableData })

        message.success(`列 "${columnPath}" 数据生成完成`)
      } catch (error) {
        console.error('列数据生成失败:', error)
        message.error(`列数据生成失败: ${(error as Error).message}`)
      } finally {
        setIsGeneratingColumn(null)
      }
    },
    [
      chat,
      isGeneratingColumn,
      getLLMConfig,
      message,
      chatId,
      addTask,
      updateTask,
      updateCrosstabData,
      getModelConfigForLLM
    ]
  )

  const handleGenerateRow = useCallback(
    async (rowPath: string) => {
      if (!chat || isGeneratingRow) return

      const llmConfig = getLLMConfig()
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      if (!chat.crosstabData.metadata) {
        message.error('请先完成主题设置')
        return
      }

      const { horizontalDimensions } = chat.crosstabData.metadata
      const hasHorizontalData = horizontalDimensions.every((dim) => dim.values.length > 0)

      if (!hasHorizontalData) {
        message.error('请先完成横轴维度数据生成')
        return
      }

      setIsGeneratingRow(rowPath)

      try {
        const horizontalCombinations = generateAxisCombinations(
          chat.crosstabData.metadata.horizontalDimensions
        )
        const modelConfig = getModelConfigForLLM(llmConfig.id)
        if (!modelConfig) {
          message.error('请先在设置中配置模型参数')
          return
        }
        const aiService = createAIService(llmConfig, modelConfig)

        const updatedTableData = { ...chat.crosstabData.tableData }

        for (const hCombination of horizontalCombinations) {
          const columnPath = generateDimensionPath(hCombination)
          const cellKey = `${columnPath}|${rowPath}`

          const taskId = uuidv4()
          const task: AITask = {
            id: taskId,
            requestId: aiService.id,
            type: 'crosstab_cell',
            status: 'running',
            title: '生成单元格数据',
            description: `生成单元格 ${columnPath} × ${rowPath} 的数据`,
            chatId,
            modelId: llmConfig.id,
            startTime: Date.now()
          }

          addTask(task)

          try {
            const prompt = PROMPT_TEMPLATES.cell_values
              .replace('[METADATA_JSON]', JSON.stringify(chat.crosstabData.metadata, null, 2))
              .replace('[HORIZONTAL_PATH]', columnPath)
              .replace('[VERTICAL_PATH]', rowPath)
              .replace(
                '[VALUE_DIMENSIONS]',
                JSON.stringify(chat.crosstabData.metadata.valueDimensions, null, 2)
              )

            const response = await new Promise<string>((resolve, reject) => {
              aiService.sendMessage(
                [{ id: 'temp', role: 'user', content: prompt, timestamp: Date.now() }],
                {
                  onChunk: () => {},
                  onComplete: (response) => resolve(response),
                  onError: (error) => reject(error)
                }
              )
            })

            const jsonContent = extractJsonContent(response)
            const cellValues = JSON.parse(jsonContent)

            const processedCellValues: { [key: string]: string } = {}
            if (chat.crosstabData.metadata.valueDimensions.length > 0) {
              const valueDimensions = chat.crosstabData.metadata.valueDimensions

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

            updatedTableData[cellKey] = processedCellValues

            updateTask(taskId, {
              status: 'completed',
              endTime: Date.now()
            })
          } catch (error) {
            updateTask(taskId, {
              status: 'failed',
              endTime: Date.now(),
              error: error instanceof Error ? error.message : 'Unknown error'
            })
            console.error(`单元格 ${cellKey} 生成失败:`, error)
          }
        }

        updateCrosstabData(chatId, { tableData: updatedTableData })

        message.success(`行 "${rowPath}" 数据生成完成`)
      } catch (error) {
        console.error('行数据生成失败:', error)
        message.error(`行数据生成失败: ${(error as Error).message}`)
      } finally {
        setIsGeneratingRow(null)
      }
    },
    [chat, isGeneratingRow, getLLMConfig, message, chatId, addTask, updateTask, updateCrosstabData, getModelConfigForLLM]
  )

  const handleGenerateCell = useCallback(
    async (columnPath: string, rowPath: string) => {
      if (!chat || isGeneratingCell) return

      const llmConfig = getLLMConfig()
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      if (!chat.crosstabData.metadata) {
        message.error('请先完成主题设置')
        return
      }

      const cellKey = `${columnPath}|${rowPath}`
      setIsGeneratingCell(cellKey)

      const taskId = uuidv4()
      const modelConfig = getModelConfigForLLM(llmConfig.id)
      if (!modelConfig) {
        message.error('请先在设置中配置模型参数')
        return
      }
      const aiService = createAIService(llmConfig, modelConfig)

      const task: AITask = {
        id: taskId,
        requestId: aiService.id,
        type: 'crosstab_cell',
        status: 'running',
        title: '生成单元格数据',
        description: `生成单元格 ${columnPath} × ${rowPath} 的数据`,
        chatId,
        modelId: llmConfig.id,
        startTime: Date.now()
      }

      addTask(task)

      try {
        const prompt = PROMPT_TEMPLATES.cell_values
          .replace('[METADATA_JSON]', JSON.stringify(chat.crosstabData.metadata, null, 2))
          .replace('[HORIZONTAL_PATH]', columnPath)
          .replace('[VERTICAL_PATH]', rowPath)
          .replace(
            '[VALUE_DIMENSIONS]',
            JSON.stringify(chat.crosstabData.metadata.valueDimensions, null, 2)
          )

        const response = await new Promise<string>((resolve, reject) => {
          aiService.sendMessage(
            [{ id: 'temp', role: 'user', content: prompt, timestamp: Date.now() }],
            {
              onChunk: () => {},
              onComplete: (response) => resolve(response),
              onError: (error) => reject(error)
            }
          )
        })

        const jsonContent = extractJsonContent(response)
        const cellValues = JSON.parse(jsonContent)

        const processedCellValues: { [key: string]: string } = {}

        if (chat.crosstabData.metadata.valueDimensions.length > 0) {
          const valueDimensions = chat.crosstabData.metadata.valueDimensions

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

          if (Object.keys(processedCellValues).length === 0 && Object.keys(cellValues).length > 0) {
            const firstDimension = valueDimensions[0]
            const firstValue = Object.values(cellValues)[0]
            processedCellValues[firstDimension.id] = firstValue as string
          }
        }

        const updatedTableData = { ...chat.crosstabData.tableData }
        updatedTableData[cellKey] = processedCellValues

        updateCrosstabData(chatId, { tableData: updatedTableData })

        updateTask(taskId, {
          status: 'completed',
          endTime: Date.now()
        })

        message.success('单元格数据生成完成')
      } catch (error) {
        console.error('单元格生成失败:', error)
        message.error(`单元格生成失败: ${(error as Error).message}`)

        updateTask(taskId, {
          status: 'failed',
          endTime: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      } finally {
        setIsGeneratingCell(null)
      }
    },
    [chat, isGeneratingCell, getLLMConfig, addTask, updateTask, updateCrosstabData, chatId, message, getModelConfigForLLM]
  )

  const handleClearColumn = useCallback(
    (columnPath: string) => {
      if (!chat) return

      const updatedTableData = { ...chat.crosstabData.tableData }

      Object.keys(updatedTableData).forEach((cellKey) => {
        if (cellKey.startsWith(columnPath + '|')) {
          delete updatedTableData[cellKey]
        }
      })

      updateCrosstabData(chatId, { tableData: updatedTableData })

      message.success(`列 "${columnPath}" 数据已清除`)
    },
    [chat, updateCrosstabData, chatId, message]
  )

  const handleClearRow = useCallback(
    (rowPath: string) => {
      if (!chat) return

      const updatedTableData = { ...chat.crosstabData.tableData }

      Object.keys(updatedTableData).forEach((cellKey) => {
        if (cellKey.endsWith('|' + rowPath)) {
          delete updatedTableData[cellKey]
        }
      })

      updateCrosstabData(chatId, { tableData: updatedTableData })

      message.success(`行 "${rowPath}" 数据已清除`)
    },
    [chat, updateCrosstabData, chatId, message]
  )

  const handleClearCell = useCallback(
    (columnPath: string, rowPath: string) => {
      if (!chat) return

      const updatedTableData = { ...chat.crosstabData.tableData }
      const cellKey = `${columnPath}|${rowPath}`

      if (updatedTableData[cellKey]) {
        delete updatedTableData[cellKey]
      }

      updateCrosstabData(chatId, { tableData: updatedTableData })

      message.success(`单元格 "${columnPath} × ${rowPath}" 数据已清除`)
    },
    [chat, updateCrosstabData, chatId, message]
  )

  const handleCreateChatFromCell = useCallback(
    (columnPath: string, rowPath: string, cellContent: string, metadata: any) => {
      if (!chat || !metadata) return

      const newChatId = usePagesStore.getState().createChatFromCell({
        folderId: chat.folderId,
        horizontalItem: columnPath,
        verticalItem: rowPath,
        cellContent,
        metadata,
        sourcePageId: chat.id
      })

      message.success(`已创建新聊天窗口分析 "${columnPath} × ${rowPath}"`)
    },
    [chat, message]
  )

  const handleUpdateMetadata = useCallback(
    (metadata: any) => {
      updateCrosstabData(chatId, { metadata })
    },
    [updateCrosstabData, chatId]
  )

  const handleUpdateDimension = useCallback(
    (dimensionId: string, dimensionType: 'horizontal' | 'vertical', updates: any) => {
      if (!chat || !chat.crosstabData.metadata) return

      const metadata = chat.crosstabData.metadata
      const dimensionsKey =
        dimensionType === 'horizontal' ? 'horizontalDimensions' : 'verticalDimensions'
      const dimensions = metadata[dimensionsKey]

      const updatedDimensions = dimensions.map((dim) =>
        dim.id === dimensionId ? { ...dim, ...updates } : dim
      )

      const updatedMetadata = {
        ...metadata,
        [dimensionsKey]: updatedDimensions
      }

      updateCrosstabData(chatId, { metadata: updatedMetadata })
      message.success('维度已更新')
    },
    [chat, chatId, updateCrosstabData, message]
  )

  const handleGenerateDimensionValues = useCallback(
    async (dimensionId: string, dimensionType: 'horizontal' | 'vertical') => {
      if (!chat || !chat.crosstabData.metadata) {
        message.error('请先完成主题分析')
        return
      }

      const llmConfig = getLLMConfig()
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
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
          return
        }

        const prompt = PROMPT_TEMPLATES.dimension_values
          .replace('[METADATA_JSON]', JSON.stringify(chat.crosstabData.metadata, null, 2))
          .replace('[DIMENSION_ID]', dimension.id)
          .replace('[DIMENSION_NAME]', dimension.name)
          .replace('[DIMENSION_DESCRIPTION]', dimension.description || '')

        const modelConfig = getModelConfigForLLM(llmConfig.id)
        if (!modelConfig) {
          message.error('请先在设置中配置模型参数')
          return
        }

        const aiService = createAIService(llmConfig, modelConfig)
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

        const jsonContent = extractJsonContent(result)
        const values = JSON.parse(jsonContent)

        handleUpdateDimension(dimensionId, dimensionType, { values })
        message.success(`维度"${dimension.name}"的值生成完成`)
      } catch (error) {
        console.error('维度值生成失败:', error)
        message.error(`维度值生成失败: ${(error as Error).message}`)
      } finally {
        setIsGeneratingDimensionValues((prev) => ({ ...prev, [dimensionId]: false }))
      }
    },
    [chat, getLLMConfig, handleUpdateDimension, message, getModelConfigForLLM]
  )

  const handleGenerateTopicSuggestions = useCallback(async () => {
    if (!chat || isGeneratingTopicSuggestions) return

    const llmConfig = getLLMConfig()
    if (!llmConfig) {
      message.error('请先在设置中配置LLM')
      return
    }

    if (!chat.crosstabData.metadata) {
      message.error('请先完成主题设置')
      return
    }

    setIsGeneratingTopicSuggestions(true)

    const taskId = uuidv4()
    const modelConfig = getModelConfigForLLM(llmConfig.id)
    if (!modelConfig) {
      message.error('请先在设置中配置模型参数')
      return
    }
    const aiService = createAIService(llmConfig, modelConfig)

    const task: AITask = {
      id: taskId,
      requestId: aiService.id,
      type: 'crosstab_cell',
      status: 'running',
      title: '生成主题候选项',
      description: `为主题 "${chat.crosstabData.metadata.topic}" 生成相关候选项`,
      chatId,
      modelId: llmConfig.id,
      startTime: Date.now(),
      context: {
        crosstab: {
          horizontalItem: 'suggestions',
          verticalItem: 'topic',
          metadata: chat.crosstabData.metadata
        }
      }
    }

    addTask(task)

    try {
      const prompt = PROMPT_TEMPLATES.topicSuggestions.replace(
        '[CURRENT_TOPIC]',
        chat.crosstabData.metadata.topic
      )
      const response = await new Promise<string>((resolve, reject) => {
        aiService.sendMessage(
          [{ id: 'temp', role: 'user', content: prompt, timestamp: Date.now() }],
          {
            onChunk: () => {},
            onComplete: (response) => resolve(response),
            onError: (error) => reject(error)
          }
        )
      })

      try {
        const parsedSuggestions = JSON.parse(extractJsonContent(response))
        if (Array.isArray(parsedSuggestions)) {
          const newMetadata = {
            ...chat.crosstabData.metadata!,
            topicSuggestions: parsedSuggestions
          }
          updateCrosstabData(chatId, { metadata: newMetadata })

          updateTask(taskId, {
            status: 'completed',
            endTime: Date.now()
          })

          message.success('主题候选项生成完成')
        } else {
          throw new Error('返回的不是数组格式')
        }
      } catch (e) {
        message.error('解析主题候选项失败')
        throw e
      }
    } catch (error) {
      console.error('Topic suggestions generation error:', error)
      message.error('主题候选项生成失败，请重试')

      updateTask(taskId, {
        status: 'failed',
        endTime: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsGeneratingTopicSuggestions(false)
    }
  }, [
    chat,
    isGeneratingTopicSuggestions,
    getLLMConfig,
    addTask,
    updateTask,
    updateCrosstabData,
    chatId,
    message,
    getModelConfigForLLM
  ])

  const handleGenerateDimensionSuggestions = useCallback(
    async (dimensionId: string) => {
      if (!chat || !chat.crosstabData.metadata) {
        message.error('请先完成主题设置')
        return
      }

      if (isGeneratingDimensionSuggestions[dimensionId]) return

      const llmConfig = getLLMConfig()
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      setIsGeneratingDimensionSuggestions((prev) => ({ ...prev, [dimensionId]: true }))

      const taskId = uuidv4()
      const modelConfig = getModelConfigForLLM(llmConfig.id)
      if (!modelConfig) {
        message.error('请先在设置中配置模型参数')
        return
      }
      const aiService = createAIService(llmConfig, modelConfig)

      const allDimensions = [
        ...chat.crosstabData.metadata.horizontalDimensions,
        ...chat.crosstabData.metadata.verticalDimensions,
        ...chat.crosstabData.metadata.valueDimensions
      ]
      const dimension = allDimensions.find((d) => d.id === dimensionId)

      if (!dimension) {
        message.error('找不到指定的维度')
        setIsGeneratingDimensionSuggestions((prev) => ({ ...prev, [dimensionId]: false }))
        return
      }

      const task: AITask = {
        id: taskId,
        requestId: aiService.id,
        type: 'crosstab_cell',
        status: 'running',
        title: '生成维度候选项',
        description: `为维度 "${dimension.name}" 生成候选项`,
        chatId,
        modelId: llmConfig.id,
        startTime: Date.now(),
        context: {
          crosstab: {
            horizontalItem: 'suggestions',
            verticalItem: dimensionId,
            metadata: chat.crosstabData.metadata
          }
        }
      }

      addTask(task)

      try {
        const prompt = PROMPT_TEMPLATES.dimensionSuggestions
          .replace('[METADATA_JSON]', JSON.stringify(chat.crosstabData.metadata, null, 2))
          .replace(
            '[DIMENSION_TYPE]',
            dimension.id.startsWith('h')
              ? 'horizontal'
              : dimension.id.startsWith('v')
                ? 'vertical'
                : 'value'
          )
          .replace('[DIMENSION_NAME]', dimension.name)
          .replace('[DIMENSION_DESCRIPTION]', (dimension as any).description || '')

        const response = await new Promise<string>((resolve, reject) => {
          aiService.sendMessage(
            [{ id: 'temp', role: 'user', content: prompt, timestamp: Date.now() }],
            {
              onChunk: () => {},
              onComplete: (response) => resolve(response),
              onError: (error) => reject(error)
            }
          )
        })

        try {
          const parsedSuggestions = JSON.parse(extractJsonContent(response))
          if (Array.isArray(parsedSuggestions)) {
            const metadata = chat.crosstabData.metadata
            let updatedMetadata = { ...metadata }

            if (dimension.id.startsWith('h')) {
              updatedMetadata.horizontalDimensions = updatedMetadata.horizontalDimensions.map(
                (d) => (d.id === dimensionId ? { ...d, suggestions: parsedSuggestions } : d)
              )
            } else if (dimension.id.startsWith('v')) {
              updatedMetadata.verticalDimensions = updatedMetadata.verticalDimensions.map((d) =>
                d.id === dimensionId ? { ...d, suggestions: parsedSuggestions } : d
              )
            } else {
              updatedMetadata.valueDimensions = updatedMetadata.valueDimensions.map((d) =>
                d.id === dimensionId ? { ...d, suggestions: parsedSuggestions } : d
              )
            }

            updateCrosstabData(chatId, { metadata: updatedMetadata })

            updateTask(taskId, {
              status: 'completed',
              endTime: Date.now()
            })

            message.success('维度候选项生成完成')
          } else {
            throw new Error('返回的不是数组格式')
          }
        } catch (e) {
          message.error('解析维度候选项失败')
          throw e
        }
      } catch (error) {
        console.error('Dimension suggestions generation error:', error)
        message.error('维度候选项生成失败，请重试')

        updateTask(taskId, {
          status: 'failed',
          endTime: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      } finally {
        setIsGeneratingDimensionSuggestions((prev) => ({ ...prev, [dimensionId]: false }))
      }
    },
    [
      chat,
      isGeneratingDimensionSuggestions,
      getLLMConfig,
      addTask,
      updateTask,
      updateCrosstabData,
      chatId,
      message,
      getModelConfigForLLM
    ]
  )

  const handleSelectTopicSuggestion = useCallback(
    (suggestion: string) => {
      if (!chat) return

      const newMetadata = {
        ...chat.crosstabData.metadata!,
        topic: suggestion
      }

      updateCrosstabData(chatId, {
        metadata: newMetadata,
        tableData: {}
      })
      message.success('主题已更新')
    },
    [chat, updateCrosstabData, chatId, message]
  )

  // 渲染 Tab 标签（带状态徽章）
  const renderTabLabel = (icon: React.ReactNode, label: string, completed: boolean) => (
    <Space>
      {icon}
      {label}
      {completed && (
        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 14 }} />
      )}
    </Space>
  )

  if (!chat) {
    return <div className="crosstab-error">交叉视图聊天不存在</div>
  }

  const tabItems = [
    {
      key: '0',
      label: renderTabLabel(<FileTextOutlined />, '输入主题', workflowStatus.topicCompleted),
      children: (
        <TopicInput
          userInput={userInput}
          onUserInputChange={setUserInput}
          onGenerate={handleGenerateMetadata}
          isGenerating={generationState.isGeneratingMetadata}
          isCompleted={workflowStatus.topicCompleted}
          onGoNext={() => handleGoToNextTab('1')}
        />
      )
    },
    {
      key: '1',
      label: renderTabLabel(<BorderOutlined />, '主题结构', workflowStatus.structureCompleted),
      children: (
        <MetadataDisplay
          metadata={chat.crosstabData.metadata}
          onUpdateMetadata={handleUpdateMetadata}
          onGenerateTopicSuggestions={handleGenerateTopicSuggestions}
          onGenerateDimensionSuggestions={handleGenerateDimensionSuggestions}
          onSelectTopicSuggestion={handleSelectTopicSuggestion}
          isGeneratingTopicSuggestions={isGeneratingTopicSuggestions}
          isGeneratingDimensionSuggestions={isGeneratingDimensionSuggestions}
          onGoNext={() => handleGoToNextTab('2')}
        />
      )
    },
    {
      key: '2',
      label: renderTabLabel(<ColumnWidthOutlined />, '轴数据', workflowStatus.axisDataCompleted),
      children: (
        <AxisDataManager
          metadata={chat.crosstabData.metadata}
          onUpdateDimension={handleUpdateDimension}
          onGenerateDimensionValues={handleGenerateDimensionValues}
          isGeneratingDimensionValues={isGeneratingDimensionValues}
          onGenerateTableData={generateTableData}
          isGeneratingTableData={generationState.isGeneratingTableData}
          canGenerateTableData={workflowStatus.axisDataCompleted}
          onGoNext={() => handleGoToNextTab('3')}
        />
      )
    },
    {
      key: '3',
      label: renderTabLabel(<TableOutlined />, '交叉分析表', workflowStatus.tableDataCompleted),
      children: (
        <CrosstabTable
          metadata={chat.crosstabData.metadata}
          tableData={chat.crosstabData.tableData}
          onGenerateColumn={handleGenerateColumn}
          isGeneratingColumn={isGeneratingColumn}
          onGenerateRow={handleGenerateRow}
          isGeneratingRow={isGeneratingRow}
          onGenerateCell={handleGenerateCell}
          isGeneratingCell={isGeneratingCell}
          onClearColumn={handleClearColumn}
          onClearRow={handleClearRow}
          onClearCell={handleClearCell}
          onCreateChatFromCell={handleCreateChatFromCell}
        />
      )
    }
  ]

  return (
    <div className="crosstab-page">
      {/* 页面溯源信息 */}
      <PageLineageDisplay pageId={chatId} size="small" showInCard={false} />

      <div className="crosstab-header">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px'
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            <TableOutlined /> 交叉视图生成器
          </Title>

          {/* 模型选择器 */}
          <Space>
            <span style={{ fontSize: '12px', color: '#666' }}>模型选择:</span>
            <ModelSelector
              llmConfigs={settings.llmConfigs || []}
              selectedModel={selectedModel}
              defaultLLMId={settings.defaultLLMId}
              onChange={handleModelChange}
              size="small"
            />
          </Space>
        </div>
      </div>

      <div className="crosstab-content">
        <div className="crosstab-workspace">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            type="card"
            size="large"
            className="crosstab-tabs"
            items={tabItems}
          />
        </div>
      </div>
    </div>
  )
}
