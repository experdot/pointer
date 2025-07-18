import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import { ChatMessage } from '../types/type'
import { createPersistConfig, handleStoreError } from './persistence/storeConfig'
import { usePagesStore } from './pagesStore'

// 流式消息状态接口
interface StreamingMessageState {
  content: string
  reasoning_content?: string
  timestamp: number
}

export interface MessagesState {
  // 流式消息临时状态 - 不持久化
  streamingMessages: { [chatId: string]: { [messageId: string]: StreamingMessageState } }
}

export interface MessagesActions {
  // 消息基本操作
  addMessage: (chatId: string, message: ChatMessage) => void
  addMessageToParent: (chatId: string, message: ChatMessage, parentId?: string) => void
  updateMessageContent: (chatId: string, messageId: string, content: string) => void
  updateMessageReasoning: (chatId: string, messageId: string, reasoning_content: string) => void
  removeMessage: (chatId: string, messageId: string) => void
  toggleMessageFavorite: (chatId: string, messageId: string) => void

  // 流式消息处理 - 优化版本
  updateStreamingMessageContent: (chatId: string, messageId: string, content: string) => void
  updateStreamingMessageReasoning: (
    chatId: string,
    messageId: string,
    reasoning_content: string
  ) => void
  completeStreamingMessage: (
    chatId: string,
    messageId: string,
    content: string,
    reasoning_content?: string
  ) => void
  clearStreamingMessage: (chatId: string, messageId?: string) => void
  getStreamingMessage: (chatId: string, messageId: string) => StreamingMessageState | undefined

  // 流式消息处理 - 保留原有接口以兼容
  updateStreamingMessage: (chatId: string, content: string, timestamp: number) => void
  addStreamingMessage: (chatId: string, message: ChatMessage) => void
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

const initialState: MessagesState = {
  streamingMessages: {}
}

export const useMessagesStore = create<MessagesState & MessagesActions>()(
  subscribeWithSelector(
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
                page.messages?.map((msg) => (msg.id === messageId ? { ...msg, content } : msg)) ||
                []

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

        // 流式消息处理 - 优化版本
        updateStreamingMessageContent: (chatId, messageId, content) => {
          try {
            set((state) => {
              if (!state.streamingMessages[chatId]) {
                state.streamingMessages[chatId] = {}
              }
              if (!state.streamingMessages[chatId][messageId]) {
                state.streamingMessages[chatId][messageId] = {
                  content: '',
                  timestamp: Date.now()
                }
              }
              state.streamingMessages[chatId][messageId].content = content
            })
          } catch (error) {
            handleStoreError('messagesStore', 'updateStreamingMessageContent', error)
          }
        },

        updateStreamingMessageReasoning: (chatId, messageId, reasoning_content) => {
          try {
            set((state) => {
              if (!state.streamingMessages[chatId]) {
                state.streamingMessages[chatId] = {}
              }
              if (!state.streamingMessages[chatId][messageId]) {
                state.streamingMessages[chatId][messageId] = {
                  content: '',
                  timestamp: Date.now()
                }
              }
              state.streamingMessages[chatId][messageId].reasoning_content = reasoning_content
            })
          } catch (error) {
            handleStoreError('messagesStore', 'updateStreamingMessageReasoning', error)
          }
        },

        completeStreamingMessage: (chatId, messageId, content, reasoning_content) => {
          try {
            // 更新页面中的消息
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

              updatePage(chatId, { messages: updatedMessages })
            }

            // 清除流式消息状态
            set((state) => {
              if (state.streamingMessages[chatId]) {
                delete state.streamingMessages[chatId][messageId]
                if (Object.keys(state.streamingMessages[chatId]).length === 0) {
                  delete state.streamingMessages[chatId]
                }
              }
            })
          } catch (error) {
            handleStoreError('messagesStore', 'completeStreamingMessage', error)
          }
        },

        clearStreamingMessage: (chatId, messageId) => {
          try {
            set((state) => {
              if (messageId) {
                // 清除特定消息的流式状态
                if (state.streamingMessages[chatId]) {
                  delete state.streamingMessages[chatId][messageId]
                  if (Object.keys(state.streamingMessages[chatId]).length === 0) {
                    delete state.streamingMessages[chatId]
                  }
                }
              } else {
                // 清除整个聊天的流式状态
                delete state.streamingMessages[chatId]
              }
            })
          } catch (error) {
            handleStoreError('messagesStore', 'clearStreamingMessage', error)
          }
        },

        getStreamingMessage: (chatId, messageId) => {
          const state = get()
          return state.streamingMessages[chatId]?.[messageId]
        },

        // 流式消息处理 - 保留原有接口以兼容
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

        addStreamingMessage: (chatId, message) => {
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
            handleStoreError('messagesStore', 'addStreamingMessage', error)
          }
        },

        completeMessageStreaming: (chatId, messageId, content, reasoning_content) => {
          try {
            const { updatePage } = usePagesStore.getState()
            const page = usePagesStore.getState().findPageById(chatId)

            if (page && page.type === 'regular') {
              const updatedMessages =
                page.messages?.map((msg) =>
                  msg.id === messageId
                    ? { ...msg, content, reasoning_content, isStreaming: false }
                    : msg
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
      createPersistConfig('messages-store', 1, (state) => ({
        // 只持久化必要的状态，不持久化流式消息状态
        // streamingMessages 不需要持久化
      }))
    )
  )
)

// 自定义 hook 用于订阅流式消息状态
export const useStreamingMessage = (chatId: string, messageId: string) => {
  return useMessagesStore((state) => state.streamingMessages[chatId]?.[messageId])
}

// 自定义 hook 用于订阅整个聊天的流式消息状态
export const useStreamingMessages = (chatId: string) => {
  return useMessagesStore((state) => state.streamingMessages[chatId] || {})
}
