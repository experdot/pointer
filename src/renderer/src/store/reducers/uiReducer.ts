import { AppState, AppAction, Settings } from '../../types'
import { constrainSidebarWidth } from '../helpers'

export const handleUIActions = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_SELECTED_NODE': {
      return {
        ...state,
        selectedNodeId: action.payload.nodeId,
        selectedNodeType: action.payload.nodeType
      }
    }

    case 'TOGGLE_MULTI_SELECT_MODE': {
      return {
        ...state,
        multiSelectMode: !state.multiSelectMode,
        checkedNodeIds: [] // 切换模式时清空选中项
      }
    }

    case 'SET_CHECKED_NODES': {
      return {
        ...state,
        checkedNodeIds: action.payload.nodeIds
      }
    }

    case 'CLEAR_CHECKED_NODES': {
      return {
        ...state,
        checkedNodeIds: []
      }
    }

    case 'UPDATE_SETTINGS': {
      // 如果payload包含所有必需的设置字段，则完全替换；否则合并
      const isCompleteSettings =
        action.payload.llmConfigs !== undefined && action.payload.fontSize !== undefined

      return {
        ...state,
        settings: isCompleteSettings
          ? ({ ...action.payload } as Settings)
          : { ...state.settings, ...action.payload }
      }
    }

    case 'TOGGLE_SIDEBAR': {
      return {
        ...state,
        sidebarCollapsed: !state.sidebarCollapsed
      }
    }

    case 'SET_SIDEBAR_WIDTH': {
      return {
        ...state,
        sidebarWidth: constrainSidebarWidth(action.payload.width)
      }
    }

    case 'TOGGLE_MESSAGE_COLLAPSE': {
      const { chatId, messageId } = action.payload
      const currentCollapsed = state.collapsedMessages[chatId] || []
      const isCollapsed = currentCollapsed.includes(messageId)

      return {
        ...state,
        collapsedMessages: {
          ...state.collapsedMessages,
          [chatId]: isCollapsed
            ? currentCollapsed.filter((id) => id !== messageId)
            : [...currentCollapsed, messageId]
        }
      }
    }

    case 'COLLAPSE_ALL_MESSAGES': {
      const { chatId } = action.payload
      const chat = state.pages.find((c) => c.id === chatId)
      if (!chat) return state

      const allMessageIds = chat.messages.map((msg) => msg.id)

      return {
        ...state,
        collapsedMessages: {
          ...state.collapsedMessages,
          [chatId]: allMessageIds
        },
        allMessagesCollapsed: {
          ...state.allMessagesCollapsed,
          [chatId]: true
        }
      }
    }

    case 'EXPAND_ALL_MESSAGES': {
      const { chatId } = action.payload

      return {
        ...state,
        collapsedMessages: {
          ...state.collapsedMessages,
          [chatId]: []
        },
        allMessagesCollapsed: {
          ...state.allMessagesCollapsed,
          [chatId]: false
        }
      }
    }

    case 'TOGGLE_LINEAGE_DISPLAY_COLLAPSE': {
      const { pageId } = action.payload
      const isCurrentlyCollapsed = state.lineageDisplayCollapsed[pageId] || false

      return {
        ...state,
        lineageDisplayCollapsed: {
          ...state.lineageDisplayCollapsed,
          [pageId]: !isCurrentlyCollapsed
        }
      }
    }

    default:
      return state
  }
}
