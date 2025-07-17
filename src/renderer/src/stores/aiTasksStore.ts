import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { AITask, AITaskStatus, AITaskType } from '../types/type'
import { createPersistConfig, handleStoreError } from './storeConfig'

export interface AITasksState {
  aiTasks: AITask[]
}

export interface AITasksActions {
  // 任务管理
  addTask: (task: AITask) => void
  updateTask: (taskId: string, updates: Partial<AITask>) => void
  removeTask: (taskId: string) => void
  clearCompletedTasks: () => void
  clearAllTasks: () => void

  // 任务查询
  getTask: (taskId: string) => AITask | undefined
  getTasksByStatus: (status: AITaskStatus) => AITask[]
  getTasksByType: (type: AITaskType) => AITask[]
  getTasksByChatId: (chatId: string) => AITask[]
  getRunningTasks: () => AITask[]

  // 任务状态管理
  startTask: (taskId: string) => void
  completeTask: (taskId: string) => void
  failTask: (taskId: string, error: string) => void
  cancelTask: (taskId: string) => void

  // 批量操作
  cancelAllTasks: () => void
  cancelTasksByType: (type: AITaskType) => void

  // 工具方法
  hasRunningTasks: () => boolean
  getTasksCount: () => number
  getRunningTasksCount: () => number
}

const initialState: AITasksState = {
  aiTasks: []
}

export const useAITasksStore = create<AITasksState & AITasksActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // 任务管理
      addTask: (task) => {
        try {
          set((state) => {
            state.aiTasks.push(task)
          })
        } catch (error) {
          handleStoreError('aiTasksStore', 'addTask', error)
        }
      },

      updateTask: (taskId, updates) => {
        try {
          set((state) => {
            const taskIndex = state.aiTasks.findIndex((t) => t.id === taskId)
            if (taskIndex !== -1) {
              state.aiTasks[taskIndex] = { ...state.aiTasks[taskIndex], ...updates }
            }
          })
        } catch (error) {
          handleStoreError('aiTasksStore', 'updateTask', error)
        }
      },

      removeTask: (taskId) => {
        try {
          set((state) => {
            state.aiTasks = state.aiTasks.filter((t) => t.id !== taskId)
          })
        } catch (error) {
          handleStoreError('aiTasksStore', 'removeTask', error)
        }
      },

      clearCompletedTasks: () => {
        try {
          set((state) => {
            state.aiTasks = state.aiTasks.filter(
              (task) =>
                task.status !== 'completed' &&
                task.status !== 'failed' &&
                task.status !== 'cancelled'
            )
          })
        } catch (error) {
          handleStoreError('aiTasksStore', 'clearCompletedTasks', error)
        }
      },

      clearAllTasks: () => {
        try {
          set((state) => {
            state.aiTasks = []
          })
        } catch (error) {
          handleStoreError('aiTasksStore', 'clearAllTasks', error)
        }
      },

      // 任务查询
      getTask: (taskId) => {
        return get().aiTasks.find((t) => t.id === taskId)
      },

      getTasksByStatus: (status) => {
        return get().aiTasks.filter((t) => t.status === status)
      },

      getTasksByType: (type) => {
        return get().aiTasks.filter((t) => t.type === type)
      },

      getTasksByChatId: (chatId) => {
        return get().aiTasks.filter((t) => t.chatId === chatId)
      },

      getRunningTasks: () => {
        return get().aiTasks.filter((t) => t.status === 'running' || t.status === 'pending')
      },

      // 任务状态管理
      startTask: (taskId) => {
        try {
          set((state) => {
            const task = state.aiTasks.find((t) => t.id === taskId)
            if (task) {
              task.status = 'running'
              task.startTime = Date.now()
            }
          })
        } catch (error) {
          handleStoreError('aiTasksStore', 'startTask', error)
        }
      },

      completeTask: (taskId) => {
        try {
          set((state) => {
            const task = state.aiTasks.find((t) => t.id === taskId)
            if (task) {
              task.status = 'completed'
              task.endTime = Date.now()
            }
          })
        } catch (error) {
          handleStoreError('aiTasksStore', 'completeTask', error)
        }
      },

      failTask: (taskId, error) => {
        try {
          set((state) => {
            const task = state.aiTasks.find((t) => t.id === taskId)
            if (task) {
              task.status = 'failed'
              task.endTime = Date.now()
              task.error = error
            }
          })
        } catch (error) {
          handleStoreError('aiTasksStore', 'failTask', error)
        }
      },

      cancelTask: (taskId) => {
        try {
          set((state) => {
            const task = state.aiTasks.find((t) => t.id === taskId)
            if (task) {
              task.status = 'cancelled'
              task.endTime = Date.now()
            }
          })
        } catch (error) {
          handleStoreError('aiTasksStore', 'cancelTask', error)
        }
      },

      // 批量操作
      cancelAllTasks: () => {
        try {
          set((state) => {
            state.aiTasks.forEach((task) => {
              if (task.status === 'running' || task.status === 'pending') {
                task.status = 'cancelled'
                task.endTime = Date.now()
              }
            })
          })
        } catch (error) {
          handleStoreError('aiTasksStore', 'cancelAllTasks', error)
        }
      },

      cancelTasksByType: (type) => {
        try {
          set((state) => {
            state.aiTasks.forEach((task) => {
              if (task.type === type && (task.status === 'running' || task.status === 'pending')) {
                task.status = 'cancelled'
                task.endTime = Date.now()
              }
            })
          })
        } catch (error) {
          handleStoreError('aiTasksStore', 'cancelTasksByType', error)
        }
      },

      // 工具方法
      hasRunningTasks: () => {
        return get().aiTasks.some((t) => t.status === 'running' || t.status === 'pending')
      },

      getTasksCount: () => {
        return get().aiTasks.length
      },

      getRunningTasksCount: () => {
        return get().aiTasks.filter((t) => t.status === 'running' || t.status === 'pending').length
      }
    })),
    createPersistConfig('ai-tasks-store', 1)
  )
)
