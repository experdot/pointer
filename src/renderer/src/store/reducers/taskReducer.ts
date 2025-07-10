import { AppState, AppAction } from '../../types'

export const handleTaskActions = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'ADD_AI_TASK': {
      return {
        ...state,
        aiTasks: [...state.aiTasks, action.payload.task]
      }
    }

    case 'UPDATE_AI_TASK': {
      return {
        ...state,
        aiTasks: state.aiTasks.map(task =>
          task.id === action.payload.taskId
            ? { ...task, ...action.payload.updates }
            : task
        )
      }
    }

    case 'REMOVE_AI_TASK': {
      return {
        ...state,
        aiTasks: state.aiTasks.filter(task => task.id !== action.payload.taskId)
      }
    }

    case 'CLEAR_COMPLETED_AI_TASKS': {
      return {
        ...state,
        aiTasks: state.aiTasks.filter(task => 
          task.status !== 'completed' && task.status !== 'failed' && task.status !== 'cancelled'
        )
      }
    }

    case 'CLEAR_ALL_AI_TASKS': {
      return {
        ...state,
        aiTasks: []
      }
    }

    default:
      return state
  }
} 