import { AppState, AppAction } from '../../../types/type'
import { handleGeneralChatActions } from './generalChatReducer'
import { handleMessageActions } from './messageReducer'
import { handleRegularChatActions } from './regularChatReducer'
import { handleCrosstabChatActions } from './crosstabChatReducer'
import { handleObjectChatActions } from './objectChatReducer'
import { handleConnectionActions } from './connectionReducer'

export const handleChatActions = (state: AppState, action: AppAction): AppState => {
  let newState = handleGeneralChatActions(state, action)
  if (newState !== state) return newState

  newState = handleMessageActions(state, action)
  if (newState !== state) return newState

  newState = handleRegularChatActions(state, action)
  if (newState !== state) return newState

  newState = handleCrosstabChatActions(state, action)
  if (newState !== state) return newState

  newState = handleObjectChatActions(state, action)
  if (newState !== state) return newState

  newState = handleConnectionActions(state, action)
  if (newState !== state) return newState

  return state
}
