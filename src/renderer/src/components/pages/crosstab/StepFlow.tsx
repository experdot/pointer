import React, { useState, useCallback } from 'react'
import { Steps, Button, App, Card, Space, Typography, Tag } from 'antd'
import { PlayCircleOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { CrosstabChat as CrosstabChatType, AITask } from '../../../types'
import { createAIService } from '../../../services/aiService'
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
        const taskId = uuidv4()
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

      const newTableData = {}

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
          const taskId = uuidv4()
          const task: AITask = {
            id: taskId,
            requestId: aiService.id,
            type: 'crosstab_cell',
            status: 'running',
            title: '生成单元格值',
            description: `生成单元格 ${hPath} × ${vPath} 的值`,
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

            newTableData[cellKey] = cellValues
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

      // 更新表格数据
      dispatch({
        type: 'UPDATE_CROSSTAB_DATA',
        payload: {
          chatId: chat.id,
          data: { tableData: newTableData }
        }
      })

      message.success('表格数据生成完成')
    } catch (error) {
      console.error('表格数据生成失败:', error)
      message.error(`表格数据生成失败: ${error.message}`)
    } finally {
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
                            <Tag
                              key={dim.id}
                              color={dim.values.length > 0 ? 'green' : 'default'}
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleGenerateDimensionValues(dim.id, 'horizontal')}
                            >
                              {dim.name} ({dim.values.length}个值)
                              {generateDimensionValuesLoading[dim.id] && (
                                <LoadingOutlined style={{ marginLeft: 4 }} />
                              )}
                            </Tag>
                          ))}
                        </Space>
                      </div>

                      <div>
                        <Text strong>纵轴维度：</Text>
                        <Space wrap style={{ marginTop: 8 }}>
                          {chat.crosstabData.metadata.verticalDimensions.map((dim) => (
                            <Tag
                              key={dim.id}
                              color={dim.values.length > 0 ? 'green' : 'default'}
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleGenerateDimensionValues(dim.id, 'vertical')}
                            >
                              {dim.name} ({dim.values.length}个值)
                              {generateDimensionValuesLoading[dim.id] && (
                                <LoadingOutlined style={{ marginLeft: 4 }} />
                              )}
                            </Tag>
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
                        <Button
                          type="primary"
                          icon={generateTableDataLoading ? <LoadingOutlined /> : <PlayCircleOutlined />}
                          onClick={handleGenerateTableData}
                          disabled={generateTableDataLoading}
                          loading={generateTableDataLoading}
                        >
                          {generateTableDataLoading ? '生成中...' : '生成表格数据'}
                        </Button>
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
