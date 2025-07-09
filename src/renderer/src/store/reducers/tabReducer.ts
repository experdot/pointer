import { AppState, AppAction } from '../../types'

export const handleTabActions = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'OPEN_TAB': {
      const chatId = action.payload.chatId
      if (state.openTabs.includes(chatId)) {
        return {
          ...state,
          activeTabId: chatId
        }
      }

      // 检查聊天是否存在
      const chat = state.pages.find((c) => c.id === chatId)
      if (!chat) {
        return state
      }

      return {
        ...state,
        openTabs: [...state.openTabs, chatId],
        activeTabId: chatId
      }
    }

    case 'CLOSE_TAB': {
      const chatIdToClose = action.payload.chatId
      const newOpenTabs = state.openTabs.filter((id) => id !== chatIdToClose)

      let newActiveTabId = state.activeTabId
      if (state.activeTabId === chatIdToClose) {
        if (newOpenTabs.length > 0) {
          const closedIndex = state.openTabs.indexOf(chatIdToClose)
          // 如果关闭的不是最后一个tab，激活后面的tab；否则激活前面的tab
          newActiveTabId = newOpenTabs[Math.min(closedIndex, newOpenTabs.length - 1)]
        } else {
          newActiveTabId = null
        }
      }

      return {
        ...state,
        openTabs: newOpenTabs,
        activeTabId: newActiveTabId
      }
    }

    case 'CLOSE_OTHER_TABS': {
      const keepChatId = action.payload.chatId
      const chat = state.pages.find((c) => c.id === keepChatId)
      if (!chat) {
        return state
      }

      return {
        ...state,
        openTabs: [keepChatId],
        activeTabId: keepChatId
      }
    }

    case 'CLOSE_TABS_TO_RIGHT': {
      const chatId = action.payload.chatId
      const currentIndex = state.openTabs.indexOf(chatId)
      if (currentIndex === -1) {
        return state
      }

      const newOpenTabs = state.openTabs.slice(0, currentIndex + 1)
      let newActiveTabId = state.activeTabId

      // 如果当前激活的tab在关闭的tabs中，激活指定的tab
      if (state.activeTabId && !newOpenTabs.includes(state.activeTabId)) {
        newActiveTabId = chatId
      }

      return {
        ...state,
        openTabs: newOpenTabs,
        activeTabId: newActiveTabId
      }
    }

    case 'CLOSE_ALL_TABS': {
      return {
        ...state,
        openTabs: [],
        activeTabId: null
      }
    }

    case 'SET_ACTIVE_TAB': {
      const chatId = action.payload.chatId
      const chat = state.pages.find((c) => c.id === chatId)
      if (!chat) {
        return state
      }

      return {
        ...state,
        activeTabId: chatId
      }
    }

    case 'PIN_TAB': {
      const chatId = action.payload.chatId
      const chat = state.pages.find((c) => c.id === chatId)
      if (!chat) {
        return state
      }

      const updatedPages = state.pages.map((chat) =>
        chat.id === chatId ? { ...chat, pinned: true } : chat
      )

      return {
        ...state,
        pages: updatedPages
      }
    }

    case 'UNPIN_TAB': {
      const chatId = action.payload.chatId
      const chat = state.pages.find((c) => c.id === chatId)
      if (!chat) {
        return state
      }

      const updatedPages = state.pages.map((chat) =>
        chat.id === chatId ? { ...chat, pinned: false } : chat
      )

      return {
        ...state,
        pages: updatedPages
      }
    }

    default:
      return state
  }
}
