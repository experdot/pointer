import { AppState, AppAction } from '../../types'
import { updateChatById } from '../helpers'

export const handleMessageActions = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'ADD_MESSAGE': {
      return {
        ...state,
        chats: updateChatById(state.chats, action.payload.chatId, {
          messages: [
            ...(state.chats.find((c) => c.id === action.payload.chatId)?.messages || []),
            action.payload.message
          ]
        })
      }
    }

    case 'UPDATE_STREAMING_MESSAGE': {
      return {
        ...state,
        chats: updateChatById(state.chats, action.payload.chatId, {
          streamingMessage: {
            content: action.payload.content,
            timestamp: action.payload.timestamp
          }
        })
      }
    }

    case 'COMPLETE_STREAMING_MESSAGE': {
      const chat = state.chats.find((c) => c.id === action.payload.chatId)
      if (!chat) return state

      return {
        ...state,
        chats: updateChatById(state.chats, action.payload.chatId, {
          messages: [...chat.messages, action.payload.message],
          streamingMessage: undefined
        })
      }
    }

    case 'UPDATE_MESSAGE_CONTENT': {
      const chat = state.chats.find((c) => c.id === action.payload.chatId)
      if (!chat) return state

      return {
        ...state,
        chats: updateChatById(state.chats, action.payload.chatId, {
          messages: chat.messages.map((msg) =>
            msg.id === action.payload.messageId ? { ...msg, content: action.payload.content } : msg
          )
        })
      }
    }

    case 'UPDATE_MESSAGE_REASONING': {
      const chat = state.chats.find((c) => c.id === action.payload.chatId)
      if (!chat) return state

      return {
        ...state,
        chats: updateChatById(state.chats, action.payload.chatId, {
          messages: chat.messages.map((msg) =>
            msg.id === action.payload.messageId
              ? { ...msg, reasoning_content: action.payload.reasoning_content }
              : msg
          )
        })
      }
    }

    case 'COMPLETE_MESSAGE_STREAMING': {
      const chat = state.chats.find((c) => c.id === action.payload.chatId)
      if (!chat) return state

      return {
        ...state,
        chats: updateChatById(state.chats, action.payload.chatId, {
          messages: chat.messages.map((msg) =>
            msg.id === action.payload.messageId
              ? { ...msg, content: action.payload.content, isStreaming: false }
              : msg
          )
        })
      }
    }

    case 'COMPLETE_MESSAGE_STREAMING_WITH_REASONING': {
      const chat = state.chats.find((c) => c.id === action.payload.chatId)
      if (!chat) return state

      return {
        ...state,
        chats: updateChatById(state.chats, action.payload.chatId, {
          messages: chat.messages.map((msg) =>
            msg.id === action.payload.messageId
              ? {
                  ...msg,
                  content: action.payload.content,
                  reasoning_content: action.payload.reasoning_content,
                  isStreaming: false
                }
              : msg
          )
        })
      }
    }

    case 'REMOVE_MESSAGE': {
      const chat = state.chats.find((c) => c.id === action.payload.chatId)
      if (!chat) return state

      return {
        ...state,
        chats: updateChatById(state.chats, action.payload.chatId, {
          messages: chat.messages.filter((msg) => msg.id !== action.payload.messageId)
        })
      }
    }

    case 'CLEAR_STREAMING_MESSAGE': {
      return {
        ...state,
        chats: updateChatById(state.chats, action.payload.chatId, {
          streamingMessage: undefined
        })
      }
    }

    case 'ADD_MESSAGE_TO_PARENT': {
      const chat = state.chats.find((c) => c.id === action.payload.chatId)
      if (!chat) return state

      const newMessage = {
        ...action.payload.message,
        parentId: action.payload.parentId
      }

      let updatedMessages = [...chat.messages]

      if (action.payload.parentId) {
        updatedMessages = updatedMessages.map((msg) =>
          msg.id === action.payload.parentId
            ? {
                ...msg,
                children: [...(msg.children || []), newMessage.id]
              }
            : msg
        )
      }

      updatedMessages.push(newMessage)

      let newCurrentPath = chat.currentPath || []
      if (action.payload.parentId) {
        const parentIndex = newCurrentPath.indexOf(action.payload.parentId)
        if (parentIndex !== -1) {
          newCurrentPath = [...newCurrentPath.slice(0, parentIndex + 1), newMessage.id]
        } else {
          newCurrentPath = [...newCurrentPath, newMessage.id]
        }
      } else {
        newCurrentPath = [newMessage.id]
      }

      return {
        ...state,
        chats: updateChatById(state.chats, action.payload.chatId, {
          messages: updatedMessages,
          currentPath: newCurrentPath
        })
      }
    }

    case 'UPDATE_CURRENT_PATH': {
      return {
        ...state,
        chats: updateChatById(state.chats, action.payload.chatId, {
          currentPath: action.payload.path
        })
      }
    }

    case 'SWITCH_BRANCH': {
      return {
        ...state,
        chats: updateChatById(state.chats, action.payload.chatId, {})
      }
    }

    default:
      return state
  }
}
