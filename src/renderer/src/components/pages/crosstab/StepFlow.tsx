import React, { useState, useCallback } from 'react'
import { Steps, Button, Spin, App } from 'antd'
import { PlayCircleOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { CrosstabChat as CrosstabChatType, AITask } from '../../../types'
import { createAIService } from '../../../services/aiService'
import { PROMPT_TEMPLATES, extractJsonContent } from './CrosstabUtils'
import { useAppContext } from '../../../store/AppContext'
import { v4 as uuidv4 } from 'uuid'

const { Step } = Steps

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

        switch (step.stepType) {
          case 'metadata':
            if (!userInput.trim()) {
              message.error('请输入主题')
              return
            }
            prompt = PROMPT_TEMPLATES.metadata.replace(/\[USER_INPUT\]/g, userInput.trim())
            break

          case 'horizontal':
            if (!chat.crosstabData.metadata) {
              message.error('请先完成主题设置')
              return
            }
            prompt = PROMPT_TEMPLATES.horizontal
              .replace('[METADATA_JSON]', JSON.stringify(chat.crosstabData.metadata, null, 2))
              .replace('[HORIZONTAL_AXIS]', chat.crosstabData.metadata.HorizontalAxis)
            break

          case 'vertical':
            if (!chat.crosstabData.metadata) {
              message.error('请先完成主题设置')
              return
            }
            prompt = PROMPT_TEMPLATES.vertical
              .replace('[METADATA_JSON]', JSON.stringify(chat.crosstabData.metadata, null, 2))
              .replace('[VERTICAL_AXIS]', chat.crosstabData.metadata.VerticalAxis)
            break

          case 'values':
            if (
              !chat.crosstabData.metadata ||
              chat.crosstabData.horizontalValues.length === 0 ||
              chat.crosstabData.verticalValues.length === 0
            ) {
              message.error('请先完成前面的步骤')
              return
            }

            // 为每个横轴项目生成值
            const allTableData: { [key: string]: { [key: string]: string } } = {}

            for (const horizontalItem of chat.crosstabData.horizontalValues) {
              const itemTaskId = uuidv4()
              
              // 先创建AI服务实例
              const aiService = createAIService(llmConfig)
              
              // 为每个横轴项目创建单独的任务监控
              const itemTask: AITask = {
                id: itemTaskId,
                requestId: aiService.id, // 使用AI服务的requestId
                type: 'crosstab_cell',
                status: 'running',
                title: '生成列数据',
                description: `在步骤流程中生成列 "${horizontalItem}" 的数据`,
                chatId: chat.id,
                modelId: llmConfig.id,
                startTime: Date.now(),
                context: {
                  crosstab: {
                    horizontalItem,
                    verticalItem: 'all',
                    metadata: chat.crosstabData.metadata
                  }
                }
              }

              dispatch({
                type: 'ADD_AI_TASK',
                payload: { task: itemTask }
              })

              const itemPrompt = PROMPT_TEMPLATES.values
                .replace('[METADATA_JSON]', JSON.stringify(chat.crosstabData.metadata, null, 2))
                .replace(/\[HORIZONTAL_ITEM\]/g, horizontalItem)
                .replace(
                  '[VERTICAL_ITEMS]',
                  JSON.stringify(chat.crosstabData.verticalValues, null, 2)
                )

              const response = await new Promise<string>((resolve, reject) => {
                aiService.sendMessage(
                  [{ id: 'temp', role: 'user', content: itemPrompt, timestamp: Date.now() }],
                  {
                    onChunk: () => {}, // 空的chunk处理函数
                    onComplete: (response) => {
                      // 更新项目任务状态为完成
                      dispatch({
                        type: 'UPDATE_AI_TASK',
                        payload: {
                          taskId: itemTaskId,
                          updates: {
                            status: 'completed',
                            endTime: Date.now()
                          }
                        }
                      })
                      resolve(response)
                    },
                    onError: (error) => {
                      // 更新项目任务状态为失败
                      dispatch({
                        type: 'UPDATE_AI_TASK',
                        payload: {
                          taskId: itemTaskId,
                          updates: {
                            status: 'failed',
                            endTime: Date.now(),
                            error: error.message
                          }
                        }
                      })
                      reject(error)
                    }
                  }
                )
              })

              try {
                const parsedData = JSON.parse(extractJsonContent(response))
                allTableData[horizontalItem] = parsedData
                // 每生成一个横轴项目的数据就立即更新table
                onStepComplete(stepIndex, { tableData: { ...allTableData }, isIncremental: true })
                message.success(`横轴项目 "${horizontalItem}" 数据生成完成`)
              } catch (e) {
                message.error(`解析横轴项目 "${horizontalItem}" 的数据失败`)
                
                // 更新项目任务状态为失败
                dispatch({
                  type: 'UPDATE_AI_TASK',
                  payload: {
                    taskId: itemTaskId,
                    updates: {
                      status: 'failed',
                      endTime: Date.now(),
                      error: e instanceof Error ? e.message : 'Unknown error'
                    }
                  }
                })
                
                throw e
              }
            }

            // 最终完成时标记为完全完成
            onStepComplete(stepIndex, { tableData: allTableData, isIncremental: false })
            message.success('交叉表数据生成完成！')
            setLoading(false)
            setCurrentProcessingStep(null)
            return
        }

        // 创建AI任务监控
        const taskId = uuidv4()
        const currentStep = chat.crosstabData.steps[stepIndex]
        
        const aiService = createAIService(llmConfig)
        const task: AITask = {
          id: taskId,
          requestId: aiService.id, // 使用AI服务的requestId
          type: 'crosstab_cell',
          status: 'running',
          title: currentStep.stepName,
          description: currentStep.description,
          chatId: chat.id,
          modelId: llmConfig.id,
          startTime: Date.now(),
          context: {
            crosstab: {
              horizontalItem: 'step',
              verticalItem: currentStep.stepType,
              metadata: chat.crosstabData.metadata
            }
          }
        }

        dispatch({
          type: 'ADD_AI_TASK',
          payload: { task }
        })

        // 调用AI服务
        const response = await new Promise<string>((resolve, reject) => {
          aiService.sendMessage(
            [{ id: 'temp', role: 'user', content: prompt, timestamp: Date.now() }],
            {
              onChunk: () => {}, // 空的chunk处理函数
              onComplete: (response) => {
                // 更新任务状态为完成
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
                resolve(response)
              },
              onError: (error) => {
                // 更新任务状态为失败
                dispatch({
                  type: 'UPDATE_AI_TASK',
                  payload: {
                    taskId,
                    updates: {
                      status: 'failed',
                      endTime: Date.now(),
                      error: error.message
                    }
                  }
                })
                reject(error)
              }
            }
          )
        })

        // 根据步骤类型处理响应
        let stepData: any = { response }

        switch (step.stepType) {
          case 'metadata':
            try {
              const metadata = JSON.parse(extractJsonContent(response))
              stepData.metadata = metadata
              message.success('主题结构分析完成')
            } catch (e) {
              message.error('解析主题结构失败，请重试')
              throw e
            }
            break

          case 'horizontal':
            try {
              const horizontalValues = JSON.parse(extractJsonContent(response))
              stepData.horizontalValues = horizontalValues
              message.success('横轴数据生成完成')
            } catch (e) {
              message.error('解析横轴数据失败，请重试')
              throw e
            }
            break

          case 'vertical':
            try {
              const verticalValues = JSON.parse(extractJsonContent(response))
              stepData.verticalValues = verticalValues
              message.success('纵轴数据生成完成')
            } catch (e) {
              message.error('解析纵轴数据失败，请重试')
              throw e
            }
            break
        }

        onStepComplete(stepIndex, stepData)
      } catch (error) {
        console.error('Step execution error:', error)
        message.error('步骤执行失败，请重试')
      } finally {
        setLoading(false)
        setCurrentProcessingStep(null)
      }
    },
    [chat, userInput, loading, getLLMConfig, onStepComplete]
  )

  const renderStepContent = useCallback(
    (step: any, index: number) => {
      return (
        <div className="step-content">
          <div className="step-info">
            <div className="step-title">{step.stepName}</div>
            <div className="step-description">{step.description}</div>
          </div>
          <div className="step-actions">
            {index === 0 && (
              <Button
                type="primary"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStepExecution(0)}
                loading={currentProcessingStep === 0}
                disabled={!userInput.trim() || loading}
              >
                分析主题
              </Button>
            )}
            {index === 1 && (
              <Button
                type="primary"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStepExecution(1)}
                loading={currentProcessingStep === 1}
                disabled={!chat.crosstabData.metadata || loading}
              >
                生成横轴
              </Button>
            )}
            {index === 2 && (
              <Button
                type="primary"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStepExecution(2)}
                loading={currentProcessingStep === 2}
                disabled={!chat.crosstabData.metadata || loading}
              >
                生成纵轴
              </Button>
            )}
            {index === 3 && (
              <Button
                type="primary"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStepExecution(3)}
                loading={currentProcessingStep === 3}
                disabled={
                  !chat.crosstabData.metadata ||
                  chat.crosstabData.horizontalValues.length === 0 ||
                  chat.crosstabData.verticalValues.length === 0 ||
                  loading
                }
              >
                生成表格
              </Button>
            )}
          </div>
        </div>
      )
    },
    [chat, userInput, currentProcessingStep, loading, handleStepExecution]
  )

  return (
    <div className="crosstab-steps">
      <Steps current={chat.crosstabData.currentStep} direction="vertical">
        {chat.crosstabData.steps.map((step, index) => (
          <Step
            key={step.id}
            title={renderStepContent(step, index)}
            icon={
              step.isCompleted ? (
                <CheckCircleOutlined />
              ) : currentProcessingStep === index ? (
                <Spin size="small" />
              ) : (
                <PlayCircleOutlined />
              )
            }
            status={
              step.isCompleted ? 'finish' : currentProcessingStep === index ? 'process' : 'wait'
            }
          />
        ))}
      </Steps>
    </div>
  )
}
