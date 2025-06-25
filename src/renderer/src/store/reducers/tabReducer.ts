import { AppState, AppAction } from '../../types'

export const handleTabActions = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'OPEN_TAB': {
      if (!state.openTabs.includes(action.payload.chatId)) {
        return {
          ...state,
          openTabs: [...state.openTabs, action.payload.chatId],
          activeTabId: action.payload.chatId
        }
      }
      return {
        ...state,
        activeTabId: action.payload.chatId
      }
    }

    case 'CLOSE_TAB': {
      const chat = state.chats.find((c) => c.id === action.payload.chatId)
      // 如果标签页是固定的且有其他标签页，不允许关闭
      if (chat?.pinned && state.openTabs.length > 1) {
        return state
      }

      const newOpenTabs = state.openTabs.filter((id) => id !== action.payload.chatId)
      let newActiveTabId = state.activeTabId
      let newSelectedNodeId = state.selectedNodeId
      let newSelectedNodeType = state.selectedNodeType

      if (state.activeTabId === action.payload.chatId) {
        newActiveTabId = newOpenTabs.length > 0 ? newOpenTabs[newOpenTabs.length - 1] : null

        if (newActiveTabId) {
          newSelectedNodeId = newActiveTabId
          newSelectedNodeType = 'chat'
        } else {
          newSelectedNodeId = null
          newSelectedNodeType = null
        }
      }

      return {
        ...state,
        openTabs: newOpenTabs,
        activeTabId: newActiveTabId,
        selectedNodeId: newSelectedNodeId,
        selectedNodeType: newSelectedNodeType
      }
    }

    case 'CLOSE_OTHER_TABS': {
      // 关闭除了指定标签页之外的所有标签页，但保留固定的标签页
      const pinnedTabs = state.openTabs.filter((id) => {
        const chat = state.chats.find((c) => c.id === id)
        return chat?.pinned
      })
      const newOpenTabs = [
        ...pinnedTabs.filter((id) => id !== action.payload.chatId),
        action.payload.chatId
      ]

      return {
        ...state,
        openTabs: newOpenTabs,
        activeTabId: action.payload.chatId,
        selectedNodeId: action.payload.chatId,
        selectedNodeType: 'chat'
      }
    }

    case 'CLOSE_TABS_TO_RIGHT': {
      // 关闭指定标签页右侧的所有标签页，但保留固定的标签页
      const targetIndex = state.openTabs.indexOf(action.payload.chatId)
      if (targetIndex === -1) return state

      const leftTabs = state.openTabs.slice(0, targetIndex + 1)
      const rightTabs = state.openTabs.slice(targetIndex + 1)
      const pinnedRightTabs = rightTabs.filter((id) => {
        const chat = state.chats.find((c) => c.id === id)
        return chat?.pinned
      })

      const newOpenTabs = [...leftTabs, ...pinnedRightTabs]

      return {
        ...state,
        openTabs: newOpenTabs,
        activeTabId: action.payload.chatId,
        selectedNodeId: action.payload.chatId,
        selectedNodeType: 'chat'
      }
    }

    case 'CLOSE_ALL_TABS': {
      // 关闭所有标签页，但保留固定的标签页
      const pinnedTabs = state.openTabs.filter((id) => {
        const chat = state.chats.find((c) => c.id === id)
        return chat?.pinned
      })

      const newActiveTabId = pinnedTabs.length > 0 ? pinnedTabs[0] : null

      return {
        ...state,
        openTabs: pinnedTabs,
        activeTabId: newActiveTabId,
        selectedNodeId: newActiveTabId,
        selectedNodeType: newActiveTabId ? 'chat' : null
      }
    }

    case 'PIN_TAB': {
      const updatedChats = state.chats.map((chat) =>
        chat.id === action.payload.chatId ? { ...chat, pinned: true } : chat
      )
      return {
        ...state,
        chats: updatedChats
      }
    }

    case 'UNPIN_TAB': {
      const updatedChats = state.chats.map((chat) =>
        chat.id === action.payload.chatId ? { ...chat, pinned: false } : chat
      )
      return {
        ...state,
        chats: updatedChats
      }
    }

    case 'SET_ACTIVE_TAB': {
      return {
        ...state,
        activeTabId: action.payload.chatId,
        selectedNodeId: action.payload.chatId,
        selectedNodeType: 'chat'
      }
    }

    default:
      return state
  }
}
