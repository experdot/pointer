import { AppState, AppAction } from '../../types'
import { createNewChat, updateChatById, removeFromArray } from '../helpers'

export const handleChatActions = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'CREATE_CHAT': {
      const newChat = createNewChat(action.payload.title, action.payload.folderId)
      return {
        ...state,
        chats: [...state.chats, newChat]
      }
    }

    case 'CREATE_AND_OPEN_CHAT': {
      const newChat = createNewChat(action.payload.title, action.payload.folderId)
      const newOpenTabs = state.openTabs.includes(newChat.id)
        ? state.openTabs
        : [...state.openTabs, newChat.id]

      return {
        ...state,
        chats: [...state.chats, newChat],
        openTabs: newOpenTabs,
        activeTabId: newChat.id,
        selectedNodeId: newChat.id,
        selectedNodeType: 'chat'
      }
    }

    case 'UPDATE_CHAT': {
      return {
        ...state,
        chats: updateChatById(state.chats, action.payload.id, action.payload.updates)
      }
    }

    case 'DELETE_CHAT': {
      const isSelectedChat =
        state.selectedNodeId === action.payload.id && state.selectedNodeType === 'chat'

      return {
        ...state,
        chats: removeFromArray(state.chats, action.payload.id),
        openTabs: state.openTabs.filter((id) => id !== action.payload.id),
        activeTabId: state.activeTabId === action.payload.id ? null : state.activeTabId,
        selectedNodeId: isSelectedChat ? null : state.selectedNodeId,
        selectedNodeType: isSelectedChat ? null : state.selectedNodeType
      }
    }

    case 'DELETE_MULTIPLE_CHATS': {
      const chatIdsToDelete = action.payload.chatIds
      const isSelectedChatDeleted =
        state.selectedNodeId &&
        state.selectedNodeType === 'chat' &&
        chatIdsToDelete.includes(state.selectedNodeId)

      return {
        ...state,
        chats: state.chats.filter((chat) => !chatIdsToDelete.includes(chat.id)),
        openTabs: state.openTabs.filter((id) => !chatIdsToDelete.includes(id)),
        activeTabId: chatIdsToDelete.includes(state.activeTabId || '') ? null : state.activeTabId,
        selectedNodeId: isSelectedChatDeleted ? null : state.selectedNodeId,
        selectedNodeType: isSelectedChatDeleted ? null : state.selectedNodeType,
        checkedNodeIds: [] // 删除后清空选中状态
      }
    }

    case 'MOVE_CHAT': {
      const { chatId, targetFolderId, newOrder } = action.payload
      return {
        ...state,
        chats: state.chats.map((chat) =>
          chat.id === chatId ? { ...chat, folderId: targetFolderId, order: newOrder } : chat
        )
      }
    }

    case 'REORDER_CHATS_IN_FOLDER': {
      const { folderId, chatIds } = action.payload
      const updatedChats = state.chats.map((chat) => {
        if (chat.folderId === folderId) {
          const orderIndex = chatIds.indexOf(chat.id)
          return orderIndex >= 0 ? { ...chat, order: orderIndex } : chat
        }
        return chat
      })

      return {
        ...state,
        chats: updatedChats
      }
    }

    default:
      return state
  }
}
