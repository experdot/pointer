import { AITask, AITaskStatus } from '../types/type'

export const groupTasksByStatus = (tasks: AITask[]) => {
  const running = tasks.filter((t) => t.status === 'running')
  const completed = tasks.filter((t) => t.status === 'completed')
  const failed = tasks.filter((t) => t.status === 'failed' || t.status === 'cancelled')

  return { running, completed, failed }
}

export const getModelNameFromTask = (
  task: AITask,
  llmConfigs: Array<{ id: string; name: string }>
): string => {
  const model = llmConfigs.find((m) => m.id === task.modelId)
  return model?.name || task.modelId || '未知模型'
}

export const sortTasksByTime = (tasks: AITask[], descending: boolean = true): AITask[] => {
  return [...tasks].sort((a, b) => {
    const timeA = a.startTime
    const timeB = b.startTime
    return descending ? timeB - timeA : timeA - timeB
  })
}

export const filterTasksByStatus = (tasks: AITask[], status: AITaskStatus | AITaskStatus[]): AITask[] => {
  const statuses = Array.isArray(status) ? status : [status]
  return tasks.filter((task) => statuses.includes(task.status))
}
