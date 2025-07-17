import { AppState, AppAction } from '../../types/type'

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

      // 根据是否固定来决定插入位置
      const isPinned = chat.pinned || false
      let newOpenTabs

      if (isPinned) {
        // 固定标签页插入到所有固定标签页的末尾
        const pinnedTabs = state.openTabs.filter((id) => {
          const tab = state.pages.find((p) => p.id === id)
          return tab?.pinned || false
        })
        const unpinnedTabs = state.openTabs.filter((id) => {
          const tab = state.pages.find((p) => p.id === id)
          return !(tab?.pinned || false)
        })
        newOpenTabs = [...pinnedTabs, chatId, ...unpinnedTabs]
      } else {
        // 普通标签页添加到末尾
        newOpenTabs = [...state.openTabs, chatId]
      }

      return {
        ...state,
        openTabs: newOpenTabs,
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

      // 重新排序标签页，将新固定的标签页移到所有固定标签页的末尾
      let newOpenTabs = [...state.openTabs]
      if (newOpenTabs.includes(chatId)) {
        // 移除当前位置的标签页
        newOpenTabs = newOpenTabs.filter((id) => id !== chatId)

        // 找到所有固定标签页的位置
        const pinnedTabs = newOpenTabs.filter((id) => {
          const tab = updatedPages.find((p) => p.id === id)
          return tab?.pinned || false
        })
        const unpinnedTabs = newOpenTabs.filter((id) => {
          const tab = updatedPages.find((p) => p.id === id)
          return !(tab?.pinned || false)
        })

        // 将新固定的标签页插入到固定标签页的末尾
        newOpenTabs = [...pinnedTabs, chatId, ...unpinnedTabs]
      }

      return {
        ...state,
        pages: updatedPages,
        openTabs: newOpenTabs
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

      // 重新排序标签页，将取消固定的标签页移到所有固定标签页的后面
      let newOpenTabs = [...state.openTabs]
      if (newOpenTabs.includes(chatId)) {
        // 移除当前位置的标签页
        newOpenTabs = newOpenTabs.filter((id) => id !== chatId)

        // 找到所有固定标签页的位置
        const pinnedTabs = newOpenTabs.filter((id) => {
          const tab = updatedPages.find((p) => p.id === id)
          return tab?.pinned || false
        })
        const unpinnedTabs = newOpenTabs.filter((id) => {
          const tab = updatedPages.find((p) => p.id === id)
          return !(tab?.pinned || false)
        })

        // 将取消固定的标签页插入到未固定标签页的开头
        newOpenTabs = [...pinnedTabs, chatId, ...unpinnedTabs]
      }

      return {
        ...state,
        pages: updatedPages,
        openTabs: newOpenTabs
      }
    }

    case 'REORDER_TABS': {
      const { newOrder } = action.payload

      // 验证新顺序是否有效
      const validOrder = newOrder.filter(
        (id) => state.openTabs.includes(id) && state.pages.find((p) => p.id === id)
      )

      // 如果有遗漏的标签页，添加到末尾
      const missingTabs = state.openTabs.filter((id) => !validOrder.includes(id))
      const reorderedTabs = [...validOrder, ...missingTabs]

      // 重新分离固定标签页和普通标签页，确保固定标签页在前
      const pinnedTabs = reorderedTabs.filter((id) => {
        const tab = state.pages.find((p) => p.id === id)
        return tab?.pinned || false
      })
      const unpinnedTabs = reorderedTabs.filter((id) => {
        const tab = state.pages.find((p) => p.id === id)
        return !(tab?.pinned || false)
      })

      const finalOrder = [...pinnedTabs, ...unpinnedTabs]

      return {
        ...state,
        openTabs: finalOrder
      }
    }

    default:
      return state
  }
}
