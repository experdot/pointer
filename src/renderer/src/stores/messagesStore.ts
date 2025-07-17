import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { ChatMessage } from '../types/type'
import { createPersistConfig, handleStoreError } from './persistence/storeConfig'
import { usePagesStore } from './pagesStore'

export interface MessagesState {
  // 消息相关的状态可以通过pagesStore访问，这里主要提供操作方法
}

export interface MessagesActions {
  // 消息基本操作
  addMessage: (chatId: string, message: ChatMessage) => void
  addMessageToParent: (chatId: string, message: ChatMessage, parentId?: string) => void
  updateMessageContent: (chatId: string, messageId: string, content: string) => void
  updateMessageReasoning: (chatId: string, messageId: string, reasoning_content: string) => void
  removeMessage: (chatId: string, messageId: string) => void
  toggleMessageFavorite: (chatId: string, messageId: string) => void

  // 流式消息处理
  updateStreamingMessage: (chatId: string, content: string, timestamp: number) => void
  completeStreamingMessage: (chatId: string, message: ChatMessage) => void
  clearStreamingMessage: (chatId: string) => void
  completeMessageStreaming: (
    chatId: string,
    messageId: string,
    content: string,
    reasoning_content?: string
  ) => void
  completeMessageStreamingWithReasoning: (
    chatId: string,
    messageId: string,
    content: string,
    reasoning_content?: string
  ) => void

  // 消息树操作
  switchBranch: (chatId: string, messageId: string, branchIndex: number) => void
  updateCurrentPath: (chatId: string, path: string[]) => void

  // 工具方法
  getMessage: (chatId: string, messageId: string) => ChatMessage | undefined
  getMessagePath: (chatId: string, messageId: string) => string[]
  getMessageChildren: (chatId: string, messageId: string) => ChatMessage[]
  buildMessageTree: (chatId: string) => void
}

const initialState: MessagesState = {}

export const useMessagesStore = create<MessagesState & MessagesActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // 消息基本操作
      addMessage: (chatId, message) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'regular') {
            const updatedMessages = [...(page.messages || []), message]
            updatePage(chatId, { messages: updatedMessages })
          }
        } catch (error) {
          handleStoreError('messagesStore', 'addMessage', error)
        }
      },

      addMessageToParent: (chatId, message, parentId) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'regular') {
            const newMessage = {
              ...message,
              parentId: parentId
            }

            let updatedMessages = [...(page.messages || [])]
            const messageMap = { ...(page.messageMap || {}) }

            // 更新消息映射
            messageMap[newMessage.id] = newMessage

            // 更新父消息的子消息列表
            if (parentId && messageMap[parentId]) {
              messageMap[parentId] = {
                ...messageMap[parentId],
                children: [...(messageMap[parentId].children || []), newMessage.id]
              }
              // 同时更新 messages 数组中的父消息
              updatedMessages = updatedMessages.map((msg) =>
                msg.id === parentId
                  ? {
                      ...msg,
                      children: [...(msg.children || []), newMessage.id]
                    }
                  : msg
              )
            }

            updatedMessages.push(newMessage)

            // 更新 currentPath
            let newCurrentPath = page.currentPath || []
            if (parentId) {
              const parentIndex = newCurrentPath.indexOf(parentId)
              if (parentIndex !== -1) {
                newCurrentPath = [...newCurrentPath.slice(0, parentIndex + 1), newMessage.id]
              } else {
                newCurrentPath = [...newCurrentPath, newMessage.id]
              }
            } else {
              newCurrentPath = [newMessage.id]
            }

            updatePage(chatId, {
              messages: updatedMessages,
              messageMap,
              currentPath: newCurrentPath
            })
          }
        } catch (error) {
          handleStoreError('messagesStore', 'addMessageToParent', error)
        }
      },

      updateMessageContent: (chatId, messageId, content) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'regular') {
            const updatedMessages =
              page.messages?.map((msg) => (msg.id === messageId ? { ...msg, content } : msg)) || []

            updatePage(chatId, { messages: updatedMessages })
          }
        } catch (error) {
          handleStoreError('messagesStore', 'updateMessageContent', error)
        }
      },

      updateMessageReasoning: (chatId, messageId, reasoning_content) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'regular') {
            const updatedMessages =
              page.messages?.map((msg) =>
                msg.id === messageId ? { ...msg, reasoning_content } : msg
              ) || []

            updatePage(chatId, { messages: updatedMessages })
          }
        } catch (error) {
          handleStoreError('messagesStore', 'updateMessageReasoning', error)
        }
      },

      removeMessage: (chatId, messageId) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'regular') {
            const updatedMessages = page.messages?.filter((msg) => msg.id !== messageId) || []
            updatePage(chatId, { messages: updatedMessages })
          }
        } catch (error) {
          handleStoreError('messagesStore', 'removeMessage', error)
        }
      },

      toggleMessageFavorite: (chatId, messageId) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)
          if (page && page.type === 'regular') {
            const updatedMessages =
              page.messages?.map((msg) =>
                msg.id === messageId ? { ...msg, isFavorited: !msg.isFavorited } : msg
              ) || []
            updatePage(chatId, { messages: updatedMessages })
          }
        } catch (error) {
          handleStoreError('messagesStore', 'toggleMessageFavorite', error)
        }
      },

      // 流式消息处理
      updateStreamingMessage: (chatId, content, timestamp) => {
        try {
          const { updatePage } = usePagesStore.getState()
          updatePage(chatId, {
            streamingMessage: { content, timestamp }
          })
        } catch (error) {
          handleStoreError('messagesStore', 'updateStreamingMessage', error)
        }
      },

      completeStreamingMessage: (chatId, message) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'regular') {
            const updatedMessages = [...(page.messages || []), message]
            updatePage(chatId, {
              messages: updatedMessages,
              streamingMessage: undefined
            })
          }
        } catch (error) {
          handleStoreError('messagesStore', 'completeStreamingMessage', error)
        }
      },

      clearStreamingMessage: (chatId) => {
        try {
          const { updatePage } = usePagesStore.getState()
          updatePage(chatId, { streamingMessage: undefined })
        } catch (error) {
          handleStoreError('messagesStore', 'clearStreamingMessage', error)
        }
      },

      completeMessageStreaming: (chatId, messageId, content) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'regular') {
            const updatedMessages =
              page.messages?.map((msg) =>
                msg.id === messageId ? { ...msg, content, isStreaming: false } : msg
              ) || []

            updatePage(chatId, {
              messages: updatedMessages,
              streamingMessage: undefined
            })
          }
        } catch (error) {
          handleStoreError('messagesStore', 'completeMessageStreaming', error)
        }
      },

      completeMessageStreamingWithReasoning: (chatId, messageId, content, reasoning_content) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'regular') {
            const updatedMessages =
              page.messages?.map((msg) =>
                msg.id === messageId
                  ? {
                      ...msg,
                      content,
                      reasoning_content,
                      isStreaming: false
                    }
                  : msg
              ) || []

            updatePage(chatId, {
              messages: updatedMessages,
              streamingMessage: undefined
            })
          }
        } catch (error) {
          handleStoreError('messagesStore', 'completeMessageStreamingWithReasoning', error)
        }
      },

      // 消息树操作
      switchBranch: (chatId, messageId, branchIndex) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'regular') {
            const messageMap = page.messageMap || {}
            const message = messageMap[messageId]

            if (message) {
              const updatedMessage = { ...message, branchIndex }
              const updatedMessageMap = { ...messageMap, [messageId]: updatedMessage }

              updatePage(chatId, { messageMap: updatedMessageMap })
            }
          }
        } catch (error) {
          handleStoreError('messagesStore', 'switchBranch', error)
        }
      },

      updateCurrentPath: (chatId, path) => {
        try {
          const { updatePage } = usePagesStore.getState()
          updatePage(chatId, { currentPath: path })
        } catch (error) {
          handleStoreError('messagesStore', 'updateCurrentPath', error)
        }
      },

      // 工具方法
      getMessage: (chatId, messageId) => {
        const page = usePagesStore.getState().findPageById(chatId)
        if (page && page.type === 'regular') {
          return page.messages?.find((msg) => msg.id === messageId)
        }
        return undefined
      },

      getMessagePath: (chatId, messageId) => {
        const page = usePagesStore.getState().findPageById(chatId)
        if (page && page.type === 'regular' && page.messageMap) {
          // 简化实现，返回当前路径
          return page.currentPath || []
        }
        return []
      },

      getMessageChildren: (chatId, messageId) => {
        const page = usePagesStore.getState().findPageById(chatId)
        if (page && page.type === 'regular' && page.messageMap) {
          const message = page.messageMap[messageId]
          if (message?.children) {
            return message.children.map((childId) => page.messageMap![childId]).filter(Boolean)
          }
        }
        return []
      },

      buildMessageTree: (chatId) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'regular' && page.messages) {
            const messageMap: { [key: string]: ChatMessage } = {}

            // 构建消息映射
            page.messages.forEach((msg) => {
              messageMap[msg.id] = msg
            })

            updatePage(chatId, { messageMap })
          }
        } catch (error) {
          handleStoreError('messagesStore', 'buildMessageTree', error)
        }
      }
    })),
    createPersistConfig('messages-store', 1)
  )
)
