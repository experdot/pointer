import { AITask } from '../../../../types/type'
import { v4 as uuidv4 } from 'uuid'

export interface AITaskDispatch {
  (action: { type: string; payload: any }): void
}

export class AITaskManager {
  private dispatch?: AITaskDispatch
  private chatId?: string
  private llmConfigId: string
  private aiServiceId: string

  constructor(
    llmConfigId: string,
    aiServiceId: string,
    dispatch?: AITaskDispatch,
    chatId?: string
  ) {
    this.llmConfigId = llmConfigId
    this.aiServiceId = aiServiceId
    this.dispatch = dispatch
    this.chatId = chatId
  }

  createTask(title: string, description: string, context?: any): string {
    if (!this.dispatch || !this.chatId) {
      return uuidv4() // 返回一个ID但不创建任务
    }

    const taskId = uuidv4()
    const task: AITask = {
      id: taskId,
      requestId: this.aiServiceId,
      type: 'object_generation',
      status: 'running',
      title,
      description,
      chatId: this.chatId,
      modelId: this.llmConfigId,
      startTime: Date.now(),
      context: context ? { object: context } : undefined
    }

    this.dispatch({
      type: 'ADD_AI_TASK',
      payload: { task }
    })

    return taskId
  }

  completeTask(taskId: string): void {
    if (!this.dispatch || !this.chatId) return

    this.dispatch({
      type: 'UPDATE_AI_TASK',
      payload: {
        taskId,
        updates: {
          status: 'completed',
          endTime: Date.now()
        }
      }
    })
  }

  failTask(taskId: string, error: string): void {
    if (!this.dispatch || !this.chatId) return

    this.dispatch({
      type: 'UPDATE_AI_TASK',
      payload: {
        taskId,
        updates: {
          status: 'failed',
          endTime: Date.now(),
          error
        }
      }
    })
  }

  async executeWithTask<T>(
    title: string,
    description: string,
    context: any,
    operation: () => Promise<T>
  ): Promise<T> {
    const taskId = this.createTask(title, description, context)

    try {
      const result = await operation()
      this.completeTask(taskId)
      return result
    } catch (error) {
      this.failTask(taskId, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }
}
