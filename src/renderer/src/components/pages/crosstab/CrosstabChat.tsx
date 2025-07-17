import React, { useState, useCallback, useMemo } from 'react'
import { Typography, Tabs, App, Space } from 'antd'
import {
  FileTextOutlined,
  BorderOutlined,
  ColumnWidthOutlined,
  TableOutlined
} from '@ant-design/icons'

import { useAppContext } from '../../../store/AppContext'
import { createAIService } from '../../../services/aiService'
import {
  PROMPT_TEMPLATES,
  extractJsonContent,
  generateAxisCombinations,
  generateDimensionPath
} from './CrosstabUtils'
import { AITask } from '../../../types/type'
import { v4 as uuidv4 } from 'uuid'
import StepFlow from './StepFlow'
import TopicInput from './TopicInput'
import MetadataDisplay from './MetadataDisplay'
import AxisDataManager from './AxisDataManager'
import CrosstabTable from './CrosstabTable'
import PageLineageDisplay from '../../common/PageLineageDisplay'
import ModelSelector from '../chat/ModelSelector'
import './crosstab-page.css'

const { Title } = Typography
const { TabPane } = Tabs

interface CrosstabChatProps {
  chatId: string
}

export default function CrosstabChat({ chatId }: CrosstabChatProps) {
  const { state, dispatch } = useAppContext()
  const [userInput, setUserInput] = useState('')
  const [activeTab, setActiveTab] = useState('0')
  const [selectedModel, setSelectedModel] = useState<string | undefined>(
    state.settings.defaultLLMId
  )
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

  const chat = useMemo(() => {
    const foundChat = state.pages.find((c) => c.id === chatId)
    return foundChat && foundChat.type === 'crosstab' ? foundChat : null
  }, [state.pages, chatId])

  const getLLMConfig = useCallback(() => {
    const targetModelId = selectedModel || state.settings.defaultLLMId
    return state.settings.llmConfigs?.find((config) => config.id === targetModelId) || null
  }, [selectedModel, state.settings.llmConfigs, state.settings.defaultLLMId])

  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModel(modelId)
  }, [])

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

      // 生成该列的所有单元格数据
      try {
        // 使用已经导入的函数
        const verticalCombinations = generateAxisCombinations(
          chat.crosstabData.metadata.verticalDimensions
        )
        const aiService = createAIService(llmConfig)

        const updatedTableData = { ...chat.crosstabData.tableData }

        // 为该列的每个单元格生成数据
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

          dispatch({
            type: 'ADD_AI_TASK',
            payload: { task }
          })

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

            // 处理AI生成的数据格式
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

            dispatch({
              type: 'UPDATE_AI_TASK',
              payload: {
                taskId,
                updates: {
                  status: 'completed',
                  endTime: Date.now()
                }
              }
            })
          } catch (error) {
            dispatch({
              type: 'UPDATE_AI_TASK',
              payload: {
                taskId,
                updates: {
                  status: 'failed',
                  endTime: Date.now(),
                  error: error instanceof Error ? error.message : 'Unknown error'
                }
              }
            })
            console.error(`单元格 ${cellKey} 生成失败:`, error)
          }
        }

        // 批量更新表格数据
        dispatch({
          type: 'UPDATE_CROSSTAB_DATA',
          payload: {
            chatId,
            data: { tableData: updatedTableData }
          }
        })

        message.success(`列 "${columnPath}" 数据生成完成`)
      } catch (error) {
        console.error('列数据生成失败:', error)
        message.error(`列数据生成失败: ${error.message}`)
      } finally {
        setIsGeneratingColumn(null)
      }
    },
    [chat, isGeneratingColumn, getLLMConfig, message, chatId, dispatch]
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

      // 生成该行的所有单元格数据
      try {
        // 使用已经导入的函数
        const horizontalCombinations = generateAxisCombinations(
          chat.crosstabData.metadata.horizontalDimensions
        )
        const aiService = createAIService(llmConfig)

        const updatedTableData = { ...chat.crosstabData.tableData }

        // 为该行的每个单元格生成数据
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

          dispatch({
            type: 'ADD_AI_TASK',
            payload: { task }
          })

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

            // 处理AI生成的数据格式
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

            dispatch({
              type: 'UPDATE_AI_TASK',
              payload: {
                taskId,
                updates: {
                  status: 'completed',
                  endTime: Date.now()
                }
              }
            })
          } catch (error) {
            dispatch({
              type: 'UPDATE_AI_TASK',
              payload: {
                taskId,
                updates: {
                  status: 'failed',
                  endTime: Date.now(),
                  error: error instanceof Error ? error.message : 'Unknown error'
                }
              }
            })
            console.error(`单元格 ${cellKey} 生成失败:`, error)
          }
        }

        // 批量更新表格数据
        dispatch({
          type: 'UPDATE_CROSSTAB_DATA',
          payload: {
            chatId,
            data: { tableData: updatedTableData }
          }
        })

        message.success(`行 "${rowPath}" 数据生成完成`)
      } catch (error) {
        console.error('行数据生成失败:', error)
        message.error(`行数据生成失败: ${error.message}`)
      } finally {
        setIsGeneratingRow(null)
      }
    },
    [chat, isGeneratingRow, getLLMConfig, message, chatId, dispatch]
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
      const aiService = createAIService(llmConfig)

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

      dispatch({
        type: 'ADD_AI_TASK',
        payload: { task }
      })

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

        // 处理AI生成的数据格式，确保键是实际的值维度ID
        const processedCellValues: { [key: string]: string } = {}

        // 如果AI生成的数据使用的是通用键（如value1, value2），需要映射到实际的值维度ID
        if (chat.crosstabData.metadata.valueDimensions.length > 0) {
          const valueDimensions = chat.crosstabData.metadata.valueDimensions

          // 检查是否使用了通用键格式
          const keys = Object.keys(cellValues)
          const hasGenericKeys = keys.some((key) => key.match(/^value\d+$/))

          if (hasGenericKeys) {
            // 映射通用键到实际的值维度ID
            valueDimensions.forEach((dimension, index) => {
              const genericKey = `value${index + 1}`
              if (cellValues[genericKey]) {
                processedCellValues[dimension.id] = cellValues[genericKey]
              }
            })
          } else {
            // 检查是否直接使用了值维度ID
            valueDimensions.forEach((dimension) => {
              if (cellValues[dimension.id]) {
                processedCellValues[dimension.id] = cellValues[dimension.id]
              }
            })
          }

          // 如果没有找到匹配的键，尝试使用第一个可用的值作为第一个维度的值
          if (Object.keys(processedCellValues).length === 0 && Object.keys(cellValues).length > 0) {
            const firstDimension = valueDimensions[0]
            const firstValue = Object.values(cellValues)[0]
            processedCellValues[firstDimension.id] = firstValue as string
          }
        }

        console.log('Original cell values:', cellValues)
        console.log('Processed cell values:', processedCellValues)
        console.log('Value dimensions:', chat.crosstabData.metadata.valueDimensions)

        // 更新表格数据
        const updatedTableData = { ...chat.crosstabData.tableData }
        updatedTableData[cellKey] = processedCellValues

        dispatch({
          type: 'UPDATE_CROSSTAB_DATA',
          payload: {
            chatId,
            data: { tableData: updatedTableData }
          }
        })

        dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: {
              status: 'completed',
              endTime: Date.now()
            }
          }
        })

        message.success('单元格数据生成完成')
      } catch (error) {
        console.error('单元格生成失败:', error)
        message.error(`单元格生成失败: ${error.message}`)

        dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: {
              status: 'failed',
              endTime: Date.now(),
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })
      } finally {
        setIsGeneratingCell(null)
      }
    },
    [chat, isGeneratingCell, getLLMConfig, dispatch, chatId, message]
  )

  const handleClearColumn = useCallback(
    (columnPath: string) => {
      if (!chat) return

      const updatedTableData = { ...chat.crosstabData.tableData }

      // 删除所有以该列路径开头的单元格数据
      Object.keys(updatedTableData).forEach((cellKey) => {
        if (cellKey.startsWith(columnPath + '|')) {
          delete updatedTableData[cellKey]
        }
      })

      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: { tableData: updatedTableData }
        }
      })

      message.success(`列 "${columnPath}" 数据已清除`)
    },
    [chat, dispatch, chatId, message]
  )

  const handleClearRow = useCallback(
    (rowPath: string) => {
      if (!chat) return

      const updatedTableData = { ...chat.crosstabData.tableData }

      // 删除所有以该行路径结尾的单元格数据
      Object.keys(updatedTableData).forEach((cellKey) => {
        if (cellKey.endsWith('|' + rowPath)) {
          delete updatedTableData[cellKey]
        }
      })

      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: { tableData: updatedTableData }
        }
      })

      message.success(`行 "${rowPath}" 数据已清除`)
    },
    [chat, dispatch, chatId, message]
  )

  const handleClearCell = useCallback(
    (columnPath: string, rowPath: string) => {
      if (!chat) return

      const updatedTableData = { ...chat.crosstabData.tableData }
      const cellKey = `${columnPath}|${rowPath}`

      if (updatedTableData[cellKey]) {
        delete updatedTableData[cellKey]
      }

      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: { tableData: updatedTableData }
        }
      })

      message.success(`单元格 "${columnPath} × ${rowPath}" 数据已清除`)
    },
    [chat, dispatch, chatId, message]
  )

  const handleCreateChatFromCell = useCallback(
    (columnPath: string, rowPath: string, cellContent: string, metadata: any) => {
      if (!chat || !metadata) return

      // 直接dispatch，将所有参数传递给reducer处理
      dispatch({
        type: 'CREATE_CHAT_FROM_CELL',
        payload: {
          folderId: chat.folderId,
          horizontalItem: columnPath,
          verticalItem: rowPath,
          cellContent,
          metadata,
          sourcePageId: chatId
        }
      })

      message.success(`已创建新聊天窗口分析 "${columnPath} × ${rowPath}"`)
    },
    [chat, dispatch, message, chatId]
  )

  const handleStepComplete = useCallback(
    (stepIndex: number, data: any) => {
      // 更新步骤响应
      if (data.response) {
        dispatch({
          type: 'UPDATE_CROSSTAB_STEP',
          payload: {
            chatId,
            stepIndex,
            response: data.response
          }
        })
      }

      // 更新交叉表数据
      const updateData: any = {}
      if (data.metadata) {
        updateData.metadata = data.metadata
        setActiveTab('1') // 切换到主题结构tab
      }
      if (data.tableData) {
        updateData.tableData = data.tableData
        setActiveTab('3') // 切换到交叉分析表tab
      }

      if (Object.keys(updateData).length > 0) {
        dispatch({
          type: 'UPDATE_CROSSTAB_DATA',
          payload: {
            chatId,
            data: updateData
          }
        })
      }

      // 完成步骤
      dispatch({
        type: 'COMPLETE_CROSSTAB_STEP',
        payload: { chatId, stepIndex }
      })
    },
    [dispatch, chatId]
  )

  const handleUpdateMetadata = useCallback(
    (metadata: any) => {
      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: { metadata }
        }
      })
    },
    [dispatch, chatId]
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

      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: { metadata: updatedMetadata }
        }
      })
      message.success('维度已更新')
    },
    [chat, chatId, dispatch, message]
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

        const aiService = createAIService(llmConfig)
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

        // 更新维度值
        handleUpdateDimension(dimensionId, dimensionType, { values })
        message.success(`维度"${dimension.name}"的值生成完成`)
      } catch (error) {
        console.error('维度值生成失败:', error)
        message.error(`维度值生成失败: ${error.message}`)
      } finally {
        setIsGeneratingDimensionValues((prev) => ({ ...prev, [dimensionId]: false }))
      }
    },
    [chat, getLLMConfig, handleUpdateDimension, message]
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
    const aiService = createAIService(llmConfig)

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

    dispatch({
      type: 'ADD_AI_TASK',
      payload: { task }
    })

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
          // 保存候选项到metadata中
          const newMetadata = {
            ...chat.crosstabData.metadata!,
            topicSuggestions: parsedSuggestions
          }
          dispatch({
            type: 'UPDATE_CROSSTAB_DATA',
            payload: {
              chatId,
              data: { metadata: newMetadata }
            }
          })

          dispatch({
            type: 'UPDATE_AI_TASK',
            payload: {
              taskId,
              updates: {
                status: 'completed',
                endTime: Date.now()
              }
            }
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

      dispatch({
        type: 'UPDATE_AI_TASK',
        payload: {
          taskId,
          updates: {
            status: 'failed',
            endTime: Date.now(),
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })
    } finally {
      setIsGeneratingTopicSuggestions(false)
    }
  }, [chat, isGeneratingTopicSuggestions, getLLMConfig, dispatch, chatId, message])

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
      const aiService = createAIService(llmConfig)

      // 查找维度
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

      dispatch({
        type: 'ADD_AI_TASK',
        payload: { task }
      })

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
          .replace('[DIMENSION_DESCRIPTION]', dimension.description || '')

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
            // 更新维度的建议
            const metadata = chat.crosstabData.metadata
            let updatedMetadata = { ...metadata }

            // 根据维度类型更新对应的维度
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

            dispatch({
              type: 'UPDATE_CROSSTAB_DATA',
              payload: {
                chatId,
                data: { metadata: updatedMetadata }
              }
            })

            dispatch({
              type: 'UPDATE_AI_TASK',
              payload: {
                taskId,
                updates: {
                  status: 'completed',
                  endTime: Date.now()
                }
              }
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

        dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: {
              status: 'failed',
              endTime: Date.now(),
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })
      } finally {
        setIsGeneratingDimensionSuggestions((prev) => ({ ...prev, [dimensionId]: false }))
      }
    },
    [chat, isGeneratingDimensionSuggestions, getLLMConfig, dispatch, chatId, message]
  )

  const handleSelectTopicSuggestion = useCallback(
    (suggestion: string) => {
      if (!chat) return

      const newMetadata = {
        ...chat.crosstabData.metadata!,
        topic: suggestion
      }

      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: {
            metadata: newMetadata,
            tableData: {}
          }
        }
      })
      message.success('主题已更新')
    },
    [chat, dispatch, chatId, message]
  )

  if (!chat) {
    return <div className="crosstab-error">交叉视图聊天不存在</div>
  }

  return (
    <div className="crosstab-page">
      {/* 页面溯源信息 */}
      <div
        style={{
          borderBottom: '1px solid #f0f0f0',
          backgroundColor: '#fafafa',
          padding: '8px 16px'
        }}
      >
        <PageLineageDisplay pageId={chatId} size="small" showInCard={false} />
      </div>

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
              llmConfigs={state.settings.llmConfigs || []}
              selectedModel={selectedModel}
              onChange={handleModelChange}
              size="small"
            />
          </Space>
        </div>
      </div>

      <div className="crosstab-content">
        <StepFlow
          chat={chat as any}
          userInput={userInput}
          onStepComplete={handleStepComplete}
          getLLMConfig={getLLMConfig}
        />

        <div className="crosstab-workspace">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            type="card"
            size="large"
            className="crosstab-tabs"
          >
            <TabPane
              tab={
                <Space>
                  <FileTextOutlined />
                  输入主题
                </Space>
              }
              key="0"
            >
              <TopicInput userInput={userInput} onUserInputChange={setUserInput} />
            </TabPane>

            <TabPane
              tab={
                <Space>
                  <BorderOutlined />
                  主题结构
                </Space>
              }
              key="1"
            >
              <MetadataDisplay
                metadata={chat.crosstabData.metadata}
                onUpdateMetadata={handleUpdateMetadata}
                onGenerateTopicSuggestions={handleGenerateTopicSuggestions}
                onGenerateDimensionSuggestions={handleGenerateDimensionSuggestions}
                onSelectTopicSuggestion={handleSelectTopicSuggestion}
                isGeneratingTopicSuggestions={isGeneratingTopicSuggestions}
                isGeneratingDimensionSuggestions={isGeneratingDimensionSuggestions}
              />
            </TabPane>

            <TabPane
              tab={
                <Space>
                  <ColumnWidthOutlined />
                  轴数据
                </Space>
              }
              key="2"
            >
              <AxisDataManager
                metadata={chat.crosstabData.metadata}
                onUpdateDimension={handleUpdateDimension}
                onGenerateDimensionValues={handleGenerateDimensionValues}
                isGeneratingDimensionValues={isGeneratingDimensionValues}
              />
            </TabPane>

            <TabPane
              tab={
                <Space>
                  <TableOutlined />
                  交叉分析表
                </Space>
              }
              key="3"
            >
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
            </TabPane>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
