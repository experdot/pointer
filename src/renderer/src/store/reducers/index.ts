import { AppState, AppAction } from '../../types'
import { handleChatActions } from './chatReducer'
import { handleTabActions } from './tabReducer'
import { handleUIActions } from './uiReducer'
import { handleSearchActions } from './searchReducer'
import { handleTaskActions } from './taskReducer'
import { INITIAL_SETTINGS } from '../constants'

// Main reducer that combines all domain-specific reducers
export function appReducer(state: AppState, action: AppAction): AppState {
  // Try each domain-specific reducer
  let newState = handleChatActions(state, action)
  if (newState !== state) return newState

  newState = handleTabActions(state, action)
  if (newState !== state) return newState

  newState = handleUIActions(state, action)
  if (newState !== state) return newState

  newState = handleSearchActions(state, action)
  if (newState !== state) return newState

  newState = handleTaskActions(state, action)
  if (newState !== state) return newState

  // Handle remaining actions
  switch (action.type) {
    case 'LOAD_STATE': {
      // 如果 payload 中包含 settings，使用它；否则保持当前 settings 不变
      let finalSettings = state.settings
      if (action.payload.settings !== undefined) {
        // 只有当 payload 明确包含 settings 时才更新
        const loadedSettings = action.payload.settings || {}
        finalSettings = { ...INITIAL_SETTINGS, ...loadedSettings }
      }

      return {
        ...state,
        ...action.payload,
        settings: finalSettings
      }
    }

    default:
      return state
  }
}
