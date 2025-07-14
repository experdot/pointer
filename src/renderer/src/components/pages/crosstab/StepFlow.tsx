import React, { useState, useCallback } from 'react'
import { Steps, Button, App, Card, Space, Typography, Tag } from 'antd'
import { PlayCircleOutlined, CheckCircleOutlined, LoadingOutlined, StopOutlined } from '@ant-design/icons'
import { CrosstabChat as CrosstabChatType, AITask } from '../../../types'
import { createAIService, AIService } from '../../../services/aiService'
import {
  PROMPT_TEMPLATES,
  extractJsonContent,
  generateAxisCombinations,
  generateDimensionPath
} from './CrosstabUtils'
import { useAppContext } from '../../../store/AppContext'
import { v4 as uuidv4 } from 'uuid'

const { Step } = Steps
const { Text } = Typography

interface StepFlowProps {
  chat: CrosstabChatType
  userInput: string
  onStepComplete: (stepIndex: number, data: any) => void
  getLLMConfig: () => any
}

export default function StepFlow({ chat, userInput, onStepComplete, getLLMConfig }: StepFlowProps) {
  const { dispatch } = useAppContext()
  const [loading, setLoading] = useState(false)
  const [currentProcessingStep, setCurrentProcessingStep] = useState<number | null>(null)
  const [generateDimensionValuesLoading, setGenerateDimensionValuesLoading] = useState<{
    [dimensionId: string]: boolean
  }>({})
  const [generateTableDataLoading, setGenerateTableDataLoading] = useState(false)
  const { message } = App.useApp()

  // 添加AIService实例管理
  const [currentAIService, setCurrentAIService] = useState<AIService | null>(null)
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const [dimensionAIServices, setDimensionAIServices] = useState<{
    [dimensionId: string]: AIService
  }>({})
  const [dimensionTaskIds, setDimensionTaskIds] = useState<{
    [dimensionId: string]: string
  }>({})
  const [tableDataAIService, setTableDataAIService] = useState<AIService | null>(null)
  const [tableDataTaskIds, setTableDataTaskIds] = useState<string[]>([])

  // 停止生成的通用函数
  const stopCurrentGeneration = useCallback(async () => {
    if (currentAIService) {
      try {
        await currentAIService.stopStreaming()
        
        // 更新AI任务状态为cancelled
        if (currentTaskId) {
          dispatch({
            type: 'UPDATE_AI_TASK',
            payload: {
              taskId: currentTaskId,
              updates: { status: 'cancelled', endTime: Date.now() }
            }
          })
        }
        
        setCurrentAIService(null)
        setCurrentTaskId(null)
        setLoading(false)
        setCurrentProcessingStep(null)
        message.info('已停止生成')
      } catch (error) {
        console.error('停止生成失败:', error)
        message.error('停止生成失败')
      }
    }
  }, [currentAIService, currentTaskId, dispatch, message])

  // 停止维度值生成
  const stopDimensionGeneration = useCallback(async (dimensionId: string) => {
    const aiService = dimensionAIServices[dimensionId]
    const taskId = dimensionTaskIds[dimensionId]
    
    if (aiService) {
      try {
        await aiService.stopStreaming()
        
        // 更新AI任务状态为cancelled
        if (taskId) {
          dispatch({
            type: 'UPDATE_AI_TASK',
            payload: {
              taskId: taskId,
              updates: { status: 'cancelled', endTime: Date.now() }
            }
          })
        }
        
        setDimensionAIServices(prev => {
          const newServices = { ...prev }
          delete newServices[dimensionId]
          return newServices
        })
        setDimensionTaskIds(prev => {
          const newTaskIds = { ...prev }
          delete newTaskIds[dimensionId]
          return newTaskIds
        })
        setGenerateDimensionValuesLoading(prev => ({ ...prev, [dimensionId]: false }))
        message.info('已停止维度值生成')
      } catch (error) {
        console.error('停止维度值生成失败:', error)
        message.error('停止维度值生成失败')
      }
    }
  }, [dimensionAIServices, dimensionTaskIds, dispatch, message])

  // 停止表格数据生成
  const stopTableDataGeneration = useCallback(async () => {
    if (tableDataAIService) {
      try {
        await tableDataAIService.stopStreaming()
        
        // 更新所有相关的AI任务状态为cancelled
        tableDataTaskIds.forEach(taskId => {
          dispatch({
            type: 'UPDATE_AI_TASK',
            payload: {
              taskId: taskId,
              updates: { status: 'cancelled', endTime: Date.now() }
            }
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
  }, [tableDataAIService, tableDataTaskIds, dispatch, message])

  const handleStepExecution = useCallback(
    async (stepIndex: number) => {
      if (loading) return

      const llmConfig = getLLMConfig()
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      setLoading(true)
      setCurrentProcessingStep(stepIndex)

      try {
        const step = chat.crosstabData.steps[stepIndex]
        let prompt = ''
        let result = ''

        switch (step.stepType) {
          case 'metadata':
            if (!userInput.trim()) {
              message.error('请输入主题')
              return
            }
            prompt = PROMPT_TEMPLATES.metadata.replace(/\[USER_INPUT\]/g, userInput.trim())

            // 创建AI任务
            const metadataTaskId = uuidv4()
            const aiService = createAIService(llmConfig)
            setCurrentAIService(aiService) // 保存AI服务实例
            setCurrentTaskId(metadataTaskId) // 保存任务ID
            const metadataTask: AITask = {
              id: metadataTaskId,
              requestId: aiService.id,
              type: 'crosstab_cell',
              status: 'running',
              title: '生成多维度元数据',
              description: `分析主题"${userInput}"并生成多维度交叉表结构`,
              chatId: chat.id,
              modelId: llmConfig.id,
              startTime: Date.now()
            }

            dispatch({ type: 'ADD_AI_TASK', payload: { task: metadataTask } })

            try {
              result = await new Promise<string>((resolve, reject) => {
                aiService.sendMessage(
                  [{ id: 'temp', role: 'user', content: prompt, timestamp: Date.now() }],
                  {
                    onChunk: () => {}, // 空的chunk处理函数
                    onComplete: (response) => {
                      resolve(response)
                    },
                    onError: (error) => {
                      reject(error)
                    }
                  }
                )
              })

              dispatch({
                type: 'UPDATE_AI_TASK',
                payload: {
                  taskId: metadataTaskId,
                  updates: { status: 'completed', endTime: Date.now() }
                }
              })

              // 解析JSON结果
              const jsonContent = extractJsonContent(result)
              const metadata = JSON.parse(jsonContent)

              // 纠正元数据
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

              onStepComplete(stepIndex, { metadata })
            } catch (error) {
              dispatch({
                type: 'UPDATE_AI_TASK',
                payload: {
                  taskId: metadataTaskId,
                  updates: { status: 'failed', error: error.message, endTime: Date.now() }
                }
              })
              throw error
            }
            break

          default:
            message.error('未知的步骤类型')
            return
        }

        // 更新步骤状态
        dispatch({
          type: 'UPDATE_CROSSTAB_STEP',
          payload: { chatId: chat.id, stepIndex, response: result }
        })

        dispatch({
          type: 'COMPLETE_CROSSTAB_STEP',
          payload: { chatId: chat.id, stepIndex }
        })

        message.success('步骤完成')
      } catch (error) {
        console.error('步骤执行失败:', error)
        message.error(`步骤执行失败: ${error.message}`)
      } finally {
        setCurrentAIService(null) // 清理AI服务实例
        setCurrentTaskId(null) // 清理任务ID
        setLoading(false)
        setCurrentProcessingStep(null)
      }
    },
    [chat.id, userInput, getLLMConfig, dispatch, loading, message, onStepComplete]
  )

  const handleGenerateDimensionValues = useCallback(
    async (dimensionId: string, dimensionType: 'horizontal' | 'vertical') => {
      if (!chat.crosstabData.metadata) {
        message.error('请先完成主题分析')
        return
      }

      const llmConfig = getLLMConfig()
      if (!llmConfig) {
        message.error('请先在设置中配置LLM')
        return
      }

      setGenerateDimensionValuesLoading((prev) => ({ ...prev, [dimensionId]: true }))

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
        setDimensionAIServices(prev => ({ ...prev, [dimensionId]: aiService })) // 保存AI服务实例
        const taskId = uuidv4()
        setDimensionTaskIds(prev => ({ ...prev, [dimensionId]: taskId })) // 保存任务ID
        const task: AITask = {
          id: taskId,
          requestId: aiService.id,
          type: 'crosstab_cell',
          status: 'running',
          title: '生成维度值',
          description: `生成维度"${dimension.name}"的值列表`,
          chatId: chat.id,
          modelId: llmConfig.id,
          startTime: Date.now()
        }

        dispatch({ type: 'ADD_AI_TASK', payload: { task } })

        const result = await new Promise<string>((resolve, reject) => {
          aiService.sendMessage(
            [{ id: 'temp', role: 'user', content: prompt, timestamp: Date.now() }],
            {
              onChunk: () => {},
              onComplete: (response) => {
                resolve(response)
              },
              onError: (error) => {
                reject(error)
              }
            }
          )
        })

        dispatch({
          type: 'UPDATE_AI_TASK',
          payload: {
            taskId,
            updates: { status: 'completed', endTime: Date.now() }
          }
        })

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

        dispatch({
          type: 'UPDATE_CROSSTAB_DATA',
          payload: {
            chatId: chat.id,
            data: { metadata: updatedMetadata }
          }
        })

        message.success(`维度"${dimension.name}"的值生成完成`)
      } catch (error) {
        console.error('维度值生成失败:', error)
        message.error(`维度值生成失败: ${error.message}`)
      } finally {
        setDimensionAIServices(prev => {
          const newServices = { ...prev }
          delete newServices[dimensionId]
          return newServices
        })
        setDimensionTaskIds(prev => {
          const newTaskIds = { ...prev }
          delete newTaskIds[dimensionId]
          return newTaskIds
        })
        setGenerateDimensionValuesLoading((prev) => ({ ...prev, [dimensionId]: false }))
      }
    },
    [chat.id, chat.crosstabData.metadata, getLLMConfig, dispatch, message]
  )

  const handleGenerateTableData = useCallback(async () => {
    if (!chat.crosstabData.metadata) {
      message.error('请先完成主题分析')
      return
    }

    const { horizontalDimensions, verticalDimensions, valueDimensions } = chat.crosstabData.metadata

    // 检查是否所有维度都有值
    const allDimensionsHaveValues = [...horizontalDimensions, ...verticalDimensions].every(
      (dim) => dim.values && dim.values.length > 0
    )

    if (!allDimensionsHaveValues) {
      message.error('请先为所有维度生成值')
      return
    }

    if (valueDimensions.length === 0) {
      message.error('请先添加值维度')
      return
    }

    const llmConfig = getLLMConfig()
    if (!llmConfig) {
      message.error('请先在设置中配置LLM')
      return
    }

    setGenerateTableDataLoading(true)

    try {
      // 生成所有横轴和纵轴的组合
      const horizontalCombinations = generateAxisCombinations(horizontalDimensions)
      const verticalCombinations = generateAxisCombinations(verticalDimensions)

      let completedCells = 0
      const totalCells = horizontalCombinations.length * verticalCombinations.length
      
      // 维护本地的tableData状态，避免异步状态更新问题
      const currentTableData = { ...chat.crosstabData.tableData }

      // 为每个交叉点生成值
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

          const aiService = createAIService(llmConfig)
          setTableDataAIService(aiService) // 保存AI服务实例（注意：这里只保存最后一个，实际应用中可能需要保存所有）
          const taskId = uuidv4()
          setTableDataTaskIds(prev => [...prev, taskId]) // 保存任务ID
          const task: AITask = {
            id: taskId,
            requestId: aiService.id,
            type: 'crosstab_cell',
            status: 'running',
            title: '生成单元格值',
            description: `生成单元格 ${hPath} × ${vPath} 的值 (${completedCells + 1}/${totalCells})`,
            chatId: chat.id,
            modelId: llmConfig.id,
            startTime: Date.now()
          }

          dispatch({ type: 'ADD_AI_TASK', payload: { task } })

          try {
            const result = await new Promise<string>((resolve, reject) => {
              aiService.sendMessage(
                [{ id: 'temp', role: 'user', content: prompt, timestamp: Date.now() }],
                {
                  onChunk: () => {},
                  onComplete: (response) => {
                    resolve(response)
                  },
                  onError: (error) => {
                    reject(error)
                  }
                }
              )
            })

            dispatch({
              type: 'UPDATE_AI_TASK',
              payload: {
                taskId,
                updates: { status: 'completed', endTime: Date.now() }
              }
            })

                                const jsonContent = extractJsonContent(result)
            const cellValues = JSON.parse(jsonContent)

            // 处理AI生成的数据格式，确保键是实际的值维度ID
            const processedCellValues: { [key: string]: string } = {}
            
            if (valueDimensions.length > 0) {
              // 检查是否使用了通用键格式
              const keys = Object.keys(cellValues)
              const hasGenericKeys = keys.some(key => key.match(/^value\d+$/))
              
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
                valueDimensions.forEach(dimension => {
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

            // 确保所有维度都有值
            const validatedCellValues: { [key: string]: string } = {}
            valueDimensions.forEach(dim => {
              validatedCellValues[dim.id] = processedCellValues[dim.id] || ''
            })

        // 更新本地tableData状态
        currentTableData[cellKey] = validatedCellValues

        // 立即更新当前单元格数据到UI
        dispatch({
          type: 'UPDATE_CROSSTAB_DATA',
          payload: {
            chatId: chat.id,
            data: { 
              tableData: { ...currentTableData }
            }
          }
        })

            completedCells++
          } catch (error) {
            dispatch({
              type: 'UPDATE_AI_TASK',
              payload: {
                taskId,
                updates: { status: 'failed', error: error.message, endTime: Date.now() }
              }
            })
            console.error(`单元格 ${cellKey} 生成失败:`, error)
          }
        }
      }

      message.success(`表格数据生成完成 (${completedCells}/${totalCells})`)
    } catch (error) {
      console.error('表格数据生成失败:', error)
      message.error(`表格数据生成失败: ${error.message}`)
    } finally {
      setTableDataAIService(null) // 清理AI服务实例
      setTableDataTaskIds([]) // 清理任务ID
      setGenerateTableDataLoading(false)
    }
  }, [chat.id, chat.crosstabData.metadata, getLLMConfig, dispatch, message])

  // 检查是否可以生成表格数据
  const canGenerateTableData =
    chat.crosstabData.metadata &&
    chat.crosstabData.metadata.horizontalDimensions.every(
      (dim) => dim.values && dim.values.length > 0
    ) &&
    chat.crosstabData.metadata.verticalDimensions.every(
      (dim) => dim.values && dim.values.length > 0
    ) &&
    chat.crosstabData.metadata.valueDimensions.length > 0

  const renderStepContent = (step: any, index: number) => {
    switch (step.stepType) {
      case 'metadata':
        return (
          <Card size="small" style={{ marginTop: 8 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>步骤说明：</Text>
              <Text>{step.description}</Text>

              {step.isCompleted && chat.crosstabData.metadata && (
                <div>
                  <Text strong>生成结果：</Text>
                  <div style={{ marginTop: 8 }}>
                    <Text>主题：{chat.crosstabData.metadata.topic}</Text>
                    <br />
                    <Text>
                      横轴维度：{chat.crosstabData.metadata.horizontalDimensions.length}个
                    </Text>
                    <br />
                    <Text>纵轴维度：{chat.crosstabData.metadata.verticalDimensions.length}个</Text>
                    <br />
                    <Text>值维度：{chat.crosstabData.metadata.valueDimensions.length}个</Text>
                  </div>
                </div>
              )}

              <Space>
                <Button
                  type="primary"
                  icon={
                    currentProcessingStep === index ? <LoadingOutlined /> : <PlayCircleOutlined />
                  }
                  onClick={() => handleStepExecution(index)}
                  disabled={loading || !userInput.trim()}
                  loading={currentProcessingStep === index}
                >
                  {currentProcessingStep === index
                    ? '生成中...'
                    : step.isCompleted
                      ? '重新生成'
                      : '开始生成'}
                </Button>
                {currentProcessingStep === index && (
                  <Button
                    type="default"
                    danger
                    icon={<StopOutlined />}
                    onClick={stopCurrentGeneration}
                  >
                    停止生成
                  </Button>
                )}
              </Space>
            </Space>
          </Card>
        )

      default:
        return null
    }
  }

  return (
    <div className="step-flow-container">
      <Card title="多维度交叉表生成流程" className="tab-card">
        <Steps current={chat.crosstabData.currentStep} direction="vertical">
          {chat.crosstabData.steps.map((step, index) => (
            <Step
              key={step.id}
              title={step.stepName}
              description={renderStepContent(step, index)}
              status={
                currentProcessingStep === index ? 'process' : step.isCompleted ? 'finish' : 'wait'
              }
              icon={
                currentProcessingStep === index ? (
                  <LoadingOutlined />
                ) : step.isCompleted ? (
                  <CheckCircleOutlined />
                ) : undefined
              }
            />
          ))}
          
          {/* 添加后续步骤的显示 */}
          {chat.crosstabData.metadata && (
            <>
              <Step
                title="生成维度数据"
                description={
                  <Card size="small" style={{ marginTop: 8 }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text strong>步骤说明：</Text>
                      <Text>为每个维度生成具体的值列表</Text>
                      
                      <div>
                        <Text strong>横轴维度：</Text>
                        <Space wrap style={{ marginTop: 8 }}>
                          {chat.crosstabData.metadata.horizontalDimensions.map((dim) => (
                            <div key={dim.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Tag
                                color={dim.values.length > 0 ? 'green' : 'default'}
                                style={{ cursor: 'pointer', margin: 0 }}
                                onClick={() => handleGenerateDimensionValues(dim.id, 'horizontal')}
                              >
                                {dim.name} ({dim.values.length}个值)
                                {generateDimensionValuesLoading[dim.id] && (
                                  <LoadingOutlined style={{ marginLeft: 4 }} />
                                )}
                              </Tag>
                              {generateDimensionValuesLoading[dim.id] && (
                                <Button
                                  type="text"
                                  size="small"
                                  danger
                                  icon={<StopOutlined />}
                                  onClick={() => stopDimensionGeneration(dim.id)}
                                  style={{ padding: '0 4px', height: '20px' }}
                                >
                                  停止
                                </Button>
                              )}
                            </div>
                          ))}
                        </Space>
                      </div>

                      <div>
                        <Text strong>纵轴维度：</Text>
                        <Space wrap style={{ marginTop: 8 }}>
                          {chat.crosstabData.metadata.verticalDimensions.map((dim) => (
                            <div key={dim.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Tag
                                color={dim.values.length > 0 ? 'green' : 'default'}
                                style={{ cursor: 'pointer', margin: 0 }}
                                onClick={() => handleGenerateDimensionValues(dim.id, 'vertical')}
                              >
                                {dim.name} ({dim.values.length}个值)
                                {generateDimensionValuesLoading[dim.id] && (
                                  <LoadingOutlined style={{ marginLeft: 4 }} />
                                )}
                              </Tag>
                              {generateDimensionValuesLoading[dim.id] && (
                                <Button
                                  type="text"
                                  size="small"
                                  danger
                                  icon={<StopOutlined />}
                                  onClick={() => stopDimensionGeneration(dim.id)}
                                  style={{ padding: '0 4px', height: '20px' }}
                                >
                                  停止
                                </Button>
                              )}
                            </div>
                          ))}
                        </Space>
                      </div>
                    </Space>
                  </Card>
                }
                status={
                  [...chat.crosstabData.metadata.horizontalDimensions, ...chat.crosstabData.metadata.verticalDimensions].every(
                    (dim) => dim.values && dim.values.length > 0
                  ) ? 'finish' : 'process'
                }
                icon={
                  [...chat.crosstabData.metadata.horizontalDimensions, ...chat.crosstabData.metadata.verticalDimensions].every(
                    (dim) => dim.values && dim.values.length > 0
                  ) ? <CheckCircleOutlined /> : undefined
                }
              />
              
              <Step
                title="生成表格数据"
                description={
                  <Card size="small" style={{ marginTop: 8 }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text strong>步骤说明：</Text>
                      <Text>为所有维度交叉点生成对应的值内容</Text>
                      
                      {canGenerateTableData ? (
                        <Space>
                          <Button
                            type="primary"
                            icon={generateTableDataLoading ? <LoadingOutlined /> : <PlayCircleOutlined />}
                            onClick={handleGenerateTableData}
                            disabled={generateTableDataLoading}
                            loading={generateTableDataLoading}
                          >
                            {generateTableDataLoading ? '生成中...' : '生成表格数据'}
                          </Button>
                          {generateTableDataLoading && (
                            <Button
                              type="default"
                              danger
                              icon={<StopOutlined />}
                              onClick={stopTableDataGeneration}
                            >
                              停止生成
                            </Button>
                          )}
                        </Space>
                      ) : (
                        <Text type="secondary">请先为所有维度生成值</Text>
                      )}
                    </Space>
                  </Card>
                }
                status={
                  Object.keys(chat.crosstabData.tableData).length > 0 ? 'finish' : 
                  canGenerateTableData ? 'wait' : 'wait'
                }
                icon={
                  Object.keys(chat.crosstabData.tableData).length > 0 ? <CheckCircleOutlined /> : undefined
                }
              />
            </>
          )}
        </Steps>
      </Card>
    </div>
  )
}
