import { v4 as uuidv4 } from 'uuid'
import { createAIService } from '../../../../services/aiService'
import { AITask } from '../../../../types/type'

interface ExecuteAITaskParams {
  llmConfig: any
  modelConfig: any
  prompt: string
  taskTitle: string
  taskDescription: string
  chatId: string
  stores: any
  onTaskCreated?: (taskId: string, aiService: any) => void
  onComplete?: (result: string) => void
  onError?: (error: Error) => void
}

export async function executeAITask({
  llmConfig,
  modelConfig,
  prompt,
  taskTitle,
  taskDescription,
  chatId,
  stores,
  onTaskCreated,
  onComplete,
  onError
}: ExecuteAITaskParams): Promise<string> {
  const taskId = uuidv4()
  const aiService = createAIService(llmConfig, modelConfig)

  const task: AITask = {
    id: taskId,
    requestId: aiService.id,
    type: 'crosstab_cell',
    status: 'running',
    title: taskTitle,
    description: taskDescription,
    chatId,
    modelId: llmConfig.id,
    startTime: Date.now()
  }

  stores.aiTasks.addTask(task)
  onTaskCreated?.(taskId, aiService)

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

    stores.aiTasks.updateTask(taskId, {
      status: 'completed',
      endTime: Date.now()
    })

    onComplete?.(result)
    return result
  } catch (error) {
    stores.aiTasks.updateTask(taskId, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      endTime: Date.now()
    })

    onError?.(error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}
