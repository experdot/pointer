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
import { PROMPT_TEMPLATES, extractJsonContent } from './CrosstabUtils'
import StepFlow from './StepFlow'
import TopicInput from './TopicInput'
import MetadataDisplay from './MetadataDisplay'
import MetadataEditor from './MetadataEditor'
import AxisDataManager from './AxisDataManager'
import CrosstabTable from './CrosstabTable'
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
  const [isEditingMetadata, setIsEditingMetadata] = useState(false)
  const [isGeneratingColumn, setIsGeneratingColumn] = useState<string | null>(null)
  const [isGeneratingRow, setIsGeneratingRow] = useState<string | null>(null)
  const [isGeneratingCell, setIsGeneratingCell] = useState<string | null>(null)
  const [isGeneratingTopicSuggestions, setIsGeneratingTopicSuggestions] = useState(false)
  const [isGeneratingHorizontalSuggestions, setIsGeneratingHorizontalSuggestions] = useState(false)
  const [isGeneratingVerticalSuggestions, setIsGeneratingVerticalSuggestions] = useState(false)
  const [isGeneratingValueSuggestions, setIsGeneratingValueSuggestions] = useState(false)
  const { message } = App.useApp()

  const chat = useMemo(() => {
    const foundChat = state.pages.find((c) => c.id === chatId)
    return foundChat && foundChat.type === 'crosstab' ? foundChat : null
  }, [state.pages, chatId])

  const getLLMConfig = useCallback(() => {
    return (
      state.settings.llmConfigs?.find((config) => config.id === state.settings.defaultLLMId) || null
    )
  }, [state.settings.llmConfigs, state.settings.defaultLLMId])

  const handleGenerateColumn = useCallback(
    async (horizontalItem: string) => {
      if (!chat || isGeneratingColumn) return

      const llmConfig = getLLMConfig()
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      if (!chat.crosstabData.metadata || chat.crosstabData.verticalValues.length === 0) {
        message.error('请先完成主题设置和轴数据生成')
        return
      }

      setIsGeneratingColumn(horizontalItem)

      try {
        const itemPrompt = PROMPT_TEMPLATES.values
          .replace('[METADATA_JSON]', JSON.stringify(chat.crosstabData.metadata, null, 2))
          .replace(/\[HORIZONTAL_ITEM\]/g, horizontalItem)
          .replace('[VERTICAL_ITEMS]', JSON.stringify(chat.crosstabData.verticalValues, null, 2))

        const aiService = createAIService(llmConfig)
        const response = await new Promise<string>((resolve, reject) => {
          aiService.sendMessage(
            [{ id: 'temp', role: 'user', content: itemPrompt, timestamp: Date.now() }],
            {
              onChunk: () => {}, // 空的chunk处理函数
              onComplete: (response) => resolve(response),
              onError: (error) => reject(error)
            }
          )
        })

        try {
          const parsedData = JSON.parse(extractJsonContent(response))
          const updatedTableData = { ...chat.crosstabData.tableData }
          updatedTableData[horizontalItem] = parsedData

          dispatch({
            type: 'UPDATE_CROSSTAB_DATA',
            payload: {
              chatId,
              data: { tableData: updatedTableData }
            }
          })

          message.success(`列 "${horizontalItem}" 数据生成完成`)
        } catch (e) {
          message.error(`解析列 "${horizontalItem}" 的数据失败`)
          throw e
        }
      } catch (error) {
        console.error('Column generation error:', error)
        message.error('列数据生成失败，请重试')
      } finally {
        setIsGeneratingColumn(null)
      }
    },
    [chat, isGeneratingColumn, getLLMConfig, dispatch, chatId, message]
  )

  const handleGenerateRow = useCallback(
    async (verticalItem: string) => {
      if (!chat || isGeneratingRow) return

      const llmConfig = getLLMConfig()
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      if (!chat.crosstabData.metadata || chat.crosstabData.horizontalValues.length === 0) {
        message.error('请先完成主题设置和轴数据生成')
        return
      }

      setIsGeneratingRow(verticalItem)

      try {
        const itemPrompt = PROMPT_TEMPLATES.rowValues
          .replace('[METADATA_JSON]', JSON.stringify(chat.crosstabData.metadata, null, 2))
          .replace(/\[VERTICAL_ITEM\]/g, verticalItem)
          .replace(
            '[HORIZONTAL_ITEMS]',
            JSON.stringify(chat.crosstabData.horizontalValues, null, 2)
          )

        const aiService = createAIService(llmConfig)
        const response = await new Promise<string>((resolve, reject) => {
          aiService.sendMessage(
            [{ id: 'temp', role: 'user', content: itemPrompt, timestamp: Date.now() }],
            {
              onChunk: () => {}, // 空的chunk处理函数
              onComplete: (response) => resolve(response),
              onError: (error) => reject(error)
            }
          )
        })

        try {
          const parsedData = JSON.parse(extractJsonContent(response))
          const updatedTableData = { ...chat.crosstabData.tableData }

          // 为每个横轴项目更新该行的数据
          chat.crosstabData.horizontalValues.forEach((horizontalItem) => {
            if (!updatedTableData[horizontalItem]) {
              updatedTableData[horizontalItem] = {}
            }
            if (parsedData[horizontalItem]) {
              updatedTableData[horizontalItem][verticalItem] = parsedData[horizontalItem]
            }
          })

          dispatch({
            type: 'UPDATE_CROSSTAB_DATA',
            payload: {
              chatId,
              data: { tableData: updatedTableData }
            }
          })

          message.success(`行 "${verticalItem}" 数据生成完成`)
        } catch (e) {
          message.error(`解析行 "${verticalItem}" 的数据失败`)
          throw e
        }
      } catch (error) {
        console.error('Row generation error:', error)
        message.error('行数据生成失败，请重试')
      } finally {
        setIsGeneratingRow(null)
      }
    },
    [chat, isGeneratingRow, getLLMConfig, dispatch, chatId, message]
  )

  const handleGenerateCell = useCallback(
    async (horizontalItem: string, verticalItem: string) => {
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

      const cellKey = `${horizontalItem}_${verticalItem}`
      setIsGeneratingCell(cellKey)

      try {
        const itemPrompt = PROMPT_TEMPLATES.cellValue
          .replace('[METADATA_JSON]', JSON.stringify(chat.crosstabData.metadata, null, 2))
          .replace(/\[HORIZONTAL_ITEM\]/g, horizontalItem)
          .replace(/\[VERTICAL_ITEM\]/g, verticalItem)

        const aiService = createAIService(llmConfig)
        const response = await new Promise<string>((resolve, reject) => {
          aiService.sendMessage(
            [{ id: 'temp', role: 'user', content: itemPrompt, timestamp: Date.now() }],
            {
              onChunk: () => {}, // 空的chunk处理函数
              onComplete: (response) => resolve(response),
              onError: (error) => reject(error)
            }
          )
        })

        const updatedTableData = { ...chat.crosstabData.tableData }
        if (!updatedTableData[horizontalItem]) {
          updatedTableData[horizontalItem] = {}
        }

        // 直接使用响应内容，因为cellValue模板返回的是纯文本
        updatedTableData[horizontalItem][verticalItem] = response.trim()

        dispatch({
          type: 'UPDATE_CROSSTAB_DATA',
          payload: {
            chatId,
            data: { tableData: updatedTableData }
          }
        })

        message.success(`单元格 "${horizontalItem} × ${verticalItem}" 数据生成完成`)
      } catch (error) {
        console.error('Cell generation error:', error)
        message.error('单元格数据生成失败，请重试')
      } finally {
        setIsGeneratingCell(null)
      }
    },
    [chat, isGeneratingCell, getLLMConfig, dispatch, chatId, message]
  )

  const handleClearColumn = useCallback(
    (horizontalItem: string) => {
      if (!chat) return

      const updatedTableData = { ...chat.crosstabData.tableData }
      if (updatedTableData[horizontalItem]) {
        delete updatedTableData[horizontalItem]
      }

      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: { tableData: updatedTableData }
        }
      })

      message.success(`列 "${horizontalItem}" 数据已清除`)
    },
    [chat, dispatch, chatId, message]
  )

  const handleClearRow = useCallback(
    (verticalItem: string) => {
      if (!chat) return

      const updatedTableData = { ...chat.crosstabData.tableData }

      // 删除所有列中该行的数据
      Object.keys(updatedTableData).forEach((horizontalItem) => {
        if (updatedTableData[horizontalItem][verticalItem]) {
          delete updatedTableData[horizontalItem][verticalItem]
        }
      })

      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: { tableData: updatedTableData }
        }
      })

      message.success(`行 "${verticalItem}" 数据已清除`)
    },
    [chat, dispatch, chatId, message]
  )

  const handleClearCell = useCallback(
    (horizontalItem: string, verticalItem: string) => {
      if (!chat) return

      const updatedTableData = { ...chat.crosstabData.tableData }

      if (updatedTableData[horizontalItem] && updatedTableData[horizontalItem][verticalItem]) {
        delete updatedTableData[horizontalItem][verticalItem]
      }

      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: { tableData: updatedTableData }
        }
      })

      message.success(`单元格 "${horizontalItem} × ${verticalItem}" 数据已清除`)
    },
    [chat, dispatch, chatId, message]
  )

  const handleCreateChatFromCell = useCallback(
    (horizontalItem: string, verticalItem: string, cellContent: string, metadata: any) => {
      if (!chat || !metadata) return

      // 直接dispatch，将所有参数传递给reducer处理
      dispatch({
        type: 'CREATE_CHAT_FROM_CELL',
        payload: {
          folderId: chat.folderId,
          horizontalItem,
          verticalItem,
          cellContent,
          metadata
        }
      })

      message.success(`已创建新聊天窗口分析 "${horizontalItem} × ${verticalItem}"`)
    },
    [chat, dispatch, message]
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
      if (data.horizontalValues) {
        updateData.horizontalValues = data.horizontalValues
        setActiveTab('2') // 切换到轴数据tab
      }
      if (data.verticalValues) {
        updateData.verticalValues = data.verticalValues
        setActiveTab('2') // 切换到轴数据tab
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

  const handleEditMetadata = useCallback(() => {
    setIsEditingMetadata(true)
  }, [])

  const handleSaveMetadata = useCallback(
    (values: any) => {
      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: { metadata: values }
        }
      })
      setIsEditingMetadata(false)
      message.success('主题元数据已更新')
    },
    [dispatch, chatId]
  )

  const handleEditHorizontalItem = useCallback(
    (index: number, value: string) => {
      const newValues = [...chat!.crosstabData.horizontalValues]
      newValues[index] = value

      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: { horizontalValues: newValues }
        }
      })
      message.success('横轴项目已更新')
    },
    [chat, dispatch, chatId]
  )

  const handleDeleteHorizontalItem = useCallback(
    (index: number) => {
      const newValues = [...chat!.crosstabData.horizontalValues]
      const deletedItem = newValues.splice(index, 1)[0]

      // 同时删除对应的表格数据
      const newTableData = { ...chat!.crosstabData.tableData }
      delete newTableData[deletedItem]

      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: {
            horizontalValues: newValues,
            tableData: newTableData
          }
        }
      })
      message.success('横轴项目已删除')
    },
    [chat, dispatch, chatId]
  )

  const handleAddHorizontalItem = useCallback(
    (value: string) => {
      const newValues = [...chat!.crosstabData.horizontalValues, value]

      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: { horizontalValues: newValues }
        }
      })
      message.success('横轴项目已添加')
    },
    [chat, dispatch, chatId]
  )

  const handleEditVerticalItem = useCallback(
    (index: number, value: string) => {
      const newValues = [...chat!.crosstabData.verticalValues]
      newValues[index] = value

      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: { verticalValues: newValues }
        }
      })
      message.success('纵轴项目已更新')
    },
    [chat, dispatch, chatId]
  )

  const handleDeleteVerticalItem = useCallback(
    (index: number) => {
      const newValues = [...chat!.crosstabData.verticalValues]
      const deletedItem = newValues.splice(index, 1)[0]

      // 同时删除对应的表格数据
      const newTableData = { ...chat!.crosstabData.tableData }
      Object.keys(newTableData).forEach((horizontalKey) => {
        delete newTableData[horizontalKey][deletedItem]
      })

      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: {
            verticalValues: newValues,
            tableData: newTableData
          }
        }
      })
      message.success('纵轴项目已删除')
    },
    [chat, dispatch, chatId]
  )

  const handleAddVerticalItem = useCallback(
    (value: string) => {
      const newValues = [...chat!.crosstabData.verticalValues, value]

      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: { verticalValues: newValues }
        }
      })
      message.success('纵轴项目已添加')
    },
    [chat, dispatch, chatId]
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

    try {
      const prompt = PROMPT_TEMPLATES.topicSuggestions.replace(
        '[CURRENT_TOPIC]',
        chat.crosstabData.metadata.Topic
      )

      const aiService = createAIService(llmConfig)
      const response = await new Promise<string>((resolve, reject) => {
        aiService.sendMessage(
          [{ id: 'temp', role: 'user', content: prompt, timestamp: Date.now() }],
          {
            onChunk: () => {}, // 空的chunk处理函数
            onComplete: (response) => resolve(response),
            onError: (error) => reject(error)
          }
        )
      })

      try {
        const parsedSuggestions = JSON.parse(extractJsonContent(response))
        if (Array.isArray(parsedSuggestions)) {
          // 保存候选项到metadata中
          const newMetadata = { ...chat.crosstabData.metadata!, TopicSuggestions: parsedSuggestions }
          dispatch({
            type: 'UPDATE_CROSSTAB_DATA',
            payload: {
              chatId,
              data: { metadata: newMetadata }
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
    } finally {
      setIsGeneratingTopicSuggestions(false)
    }
  }, [chat, isGeneratingTopicSuggestions, getLLMConfig, dispatch, chatId, message])

  const handleGenerateHorizontalSuggestions = useCallback(async () => {
    if (!chat || isGeneratingHorizontalSuggestions) return

    const llmConfig = getLLMConfig()
    if (!llmConfig) {
      message.error('请先在设置中配置LLM')
      return
    }

    if (!chat.crosstabData.metadata) {
      message.error('请先完成主题设置')
      return
    }

    setIsGeneratingHorizontalSuggestions(true)

    try {
      const prompt = PROMPT_TEMPLATES.horizontalSuggestions
        .replace('[METADATA_JSON]', JSON.stringify(chat.crosstabData.metadata, null, 2))
        .replace('[TOPIC]', chat.crosstabData.metadata.Topic)

      const aiService = createAIService(llmConfig)
      const response = await new Promise<string>((resolve, reject) => {
        aiService.sendMessage(
          [{ id: 'temp', role: 'user', content: prompt, timestamp: Date.now() }],
          {
            onChunk: () => {}, // 空的chunk处理函数
            onComplete: (response) => resolve(response),
            onError: (error) => reject(error)
          }
        )
      })

      try {
        const parsedSuggestions = JSON.parse(extractJsonContent(response))
        if (Array.isArray(parsedSuggestions)) {
          // 保存候选项到metadata中
          const newMetadata = { ...chat.crosstabData.metadata!, HorizontalAxisSuggestions: parsedSuggestions }
          dispatch({
            type: 'UPDATE_CROSSTAB_DATA',
            payload: {
              chatId,
              data: { metadata: newMetadata }
            }
          })
          message.success('横轴候选项生成完成')
        } else {
          throw new Error('返回的不是数组格式')
        }
      } catch (e) {
        message.error('解析横轴候选项失败')
        throw e
      }
    } catch (error) {
      console.error('Horizontal suggestions generation error:', error)
      message.error('横轴候选项生成失败，请重试')
    } finally {
      setIsGeneratingHorizontalSuggestions(false)
    }
  }, [chat, isGeneratingHorizontalSuggestions, getLLMConfig, message])

  const handleGenerateVerticalSuggestions = useCallback(async () => {
    if (!chat || isGeneratingVerticalSuggestions) return

    const llmConfig = getLLMConfig()
    if (!llmConfig) {
      message.error('请先在设置中配置LLM')
      return
    }

    if (!chat.crosstabData.metadata) {
      message.error('请先完成主题设置')
      return
    }

    setIsGeneratingVerticalSuggestions(true)

    try {
      const prompt = PROMPT_TEMPLATES.verticalSuggestions
        .replace('[METADATA_JSON]', JSON.stringify(chat.crosstabData.metadata, null, 2))
        .replace('[TOPIC]', chat.crosstabData.metadata.Topic)

      const aiService = createAIService(llmConfig)
      const response = await new Promise<string>((resolve, reject) => {
        aiService.sendMessage(
          [{ id: 'temp', role: 'user', content: prompt, timestamp: Date.now() }],
          {
            onChunk: () => {}, // 空的chunk处理函数
            onComplete: (response) => resolve(response),
            onError: (error) => reject(error)
          }
        )
      })

      try {
        const parsedSuggestions = JSON.parse(extractJsonContent(response))
        if (Array.isArray(parsedSuggestions)) {
          // 保存候选项到metadata中
          const newMetadata = { ...chat.crosstabData.metadata!, VerticalAxisSuggestions: parsedSuggestions }
          dispatch({
            type: 'UPDATE_CROSSTAB_DATA',
            payload: {
              chatId,
              data: { metadata: newMetadata }
            }
          })
          message.success('纵轴候选项生成完成')
        } else {
          throw new Error('返回的不是数组格式')
        }
      } catch (e) {
        message.error('解析纵轴候选项失败')
        throw e
      }
    } catch (error) {
      console.error('Vertical suggestions generation error:', error)
      message.error('纵轴候选项生成失败，请重试')
    } finally {
      setIsGeneratingVerticalSuggestions(false)
    }
  }, [chat, isGeneratingVerticalSuggestions, getLLMConfig, message])

  const handleGenerateValueSuggestions = useCallback(async () => {
    if (!chat || isGeneratingValueSuggestions) return

    const llmConfig = getLLMConfig()
    if (!llmConfig) {
      message.error('请先在设置中配置LLM')
      return
    }

    if (!chat.crosstabData.metadata) {
      message.error('请先完成主题设置')
      return
    }

    setIsGeneratingValueSuggestions(true)

    try {
      const prompt = PROMPT_TEMPLATES.valueSuggestions
        .replace('[TOPIC]', chat.crosstabData.metadata.Topic)
        .replace('[HORIZONTAL_AXIS]', chat.crosstabData.metadata.HorizontalAxis)
        .replace('[VERTICAL_AXIS]', chat.crosstabData.metadata.VerticalAxis)
        .replace('[CURRENT_VALUE]', chat.crosstabData.metadata.Value)

      const aiService = createAIService(llmConfig)
      const response = await new Promise<string>((resolve, reject) => {
        aiService.sendMessage(
          [{ id: 'temp', role: 'user', content: prompt, timestamp: Date.now() }],
          {
            onChunk: () => {}, // 空的chunk处理函数
            onComplete: (response) => resolve(response),
            onError: (error) => reject(error)
          }
        )
      })

      try {
        const parsedSuggestions = JSON.parse(extractJsonContent(response))
        if (Array.isArray(parsedSuggestions)) {
          // 保存候选项到metadata中
          const newMetadata = { ...chat.crosstabData.metadata!, ValueSuggestions: parsedSuggestions }
          dispatch({
            type: 'UPDATE_CROSSTAB_DATA',
            payload: {
              chatId,
              data: { metadata: newMetadata }
            }
          })
          message.success('值的含义候选项生成完成')
        } else {
          throw new Error('返回的不是数组格式')
        }
      } catch (e) {
        message.error('解析值的含义候选项失败')
        throw e
      }
    } catch (error) {
      console.error('Value suggestions generation error:', error)
      message.error('值的含义候选项生成失败，请重试')
    } finally {
      setIsGeneratingValueSuggestions(false)
    }
  }, [chat, isGeneratingValueSuggestions, getLLMConfig, dispatch, chatId, message])

  const handleSelectHorizontalSuggestion = useCallback(
    (suggestion: string) => {
      if (!chat) return

      const newMetadata = {
        ...chat.crosstabData.metadata!,
        HorizontalAxis: suggestion
        // 保留候选项，不清除
      }

      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: {
            metadata: newMetadata,
            // 清空相关数据，因为横轴改变了
            horizontalValues: [],
            tableData: {}
          }
        }
      })
      message.success('横轴已更新')
    },
    [chat, dispatch, chatId, message]
  )

  const handleSelectVerticalSuggestion = useCallback(
    (suggestion: string) => {
      if (!chat) return

      const newMetadata = {
        ...chat.crosstabData.metadata!,
        VerticalAxis: suggestion
        // 保留候选项，不清除
      }

      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: {
            metadata: newMetadata,
            // 清空相关数据，因为纵轴改变了
            verticalValues: [],
            tableData: {}
          }
        }
      })
      message.success('纵轴已更新')
    },
    [chat, dispatch, chatId, message]
  )

  const handleSelectTopicSuggestion = useCallback(
    (suggestion: string) => {
      if (!chat) return

      const newMetadata = {
        ...chat.crosstabData.metadata!,
        Topic: suggestion
        // 保留候选项，不清除
      }

      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: {
            metadata: newMetadata,
            // 清空所有数据，因为主题改变了
            horizontalValues: [],
            verticalValues: [],
            tableData: {}
          }
        }
      })
      message.success('主题已更新')
    },
    [chat, dispatch, chatId, message]
  )

  const handleSelectValueSuggestion = useCallback(
    (suggestion: string) => {
      if (!chat) return

      const newMetadata = {
        ...chat.crosstabData.metadata!,
        Value: suggestion
        // 保留候选项，不清除
      }

      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId,
          data: {
            metadata: newMetadata,
            // 清空表格数据，因为值的含义改变了
            tableData: {}
          }
        }
      })
      message.success('值的含义已更新')
    },
    [chat, dispatch, chatId, message]
  )

  if (!chat) {
    return <div className="crosstab-error">交叉视图聊天不存在</div>
  }

  return (
    <div className="crosstab-page">
      <div className="crosstab-header">
        <Title level={4}>
          <TableOutlined /> 交叉视图生成器
        </Title>
      </div>

      <div className="crosstab-content">
        <StepFlow
          chat={chat}
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
                onEditMetadata={handleEditMetadata}
                onGenerateTopicSuggestions={handleGenerateTopicSuggestions}
                onGenerateHorizontalSuggestions={handleGenerateHorizontalSuggestions}
                onGenerateVerticalSuggestions={handleGenerateVerticalSuggestions}
                onGenerateValueSuggestions={handleGenerateValueSuggestions}
                onSelectTopicSuggestion={handleSelectTopicSuggestion}
                onSelectHorizontalSuggestion={handleSelectHorizontalSuggestion}
                onSelectVerticalSuggestion={handleSelectVerticalSuggestion}
                onSelectValueSuggestion={handleSelectValueSuggestion}
                isGeneratingTopicSuggestions={isGeneratingTopicSuggestions}
                isGeneratingHorizontalSuggestions={isGeneratingHorizontalSuggestions}
                isGeneratingVerticalSuggestions={isGeneratingVerticalSuggestions}
                isGeneratingValueSuggestions={isGeneratingValueSuggestions}
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
                horizontalValues={chat.crosstabData.horizontalValues}
                verticalValues={chat.crosstabData.verticalValues}
                onEditHorizontalItem={handleEditHorizontalItem}
                onDeleteHorizontalItem={handleDeleteHorizontalItem}
                onAddHorizontalItem={handleAddHorizontalItem}
                onEditVerticalItem={handleEditVerticalItem}
                onDeleteVerticalItem={handleDeleteVerticalItem}
                onAddVerticalItem={handleAddVerticalItem}
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
                horizontalValues={chat.crosstabData.horizontalValues}
                verticalValues={chat.crosstabData.verticalValues}
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

      <MetadataEditor
        isOpen={isEditingMetadata}
        metadata={chat.crosstabData.metadata}
        onSave={handleSaveMetadata}
        onCancel={() => setIsEditingMetadata(false)}
      />
    </div>
  )
}
