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
  deleteMessageAndChildren: (chatId: string, messageId: string) => void
  toggleMessageStar: (chatId: string, messageId: string) => void

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

              // 更新消息映射，确保 isStreaming 状态正确
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

        deleteMessageAndChildren: (chatId, messageId) => {
          try {
            const { updatePage } = usePagesStore.getState()
            const page = usePagesStore.getState().findPageById(chatId)

            if (page && page.type === 'regular' && page.messages) {
              // 递归查找所有需要删除的消息ID（包括子分支）
              const messagesToDelete = new Set<string>()

              const findChildrenRecursively = (currentMessageId: string) => {
                messagesToDelete.add(currentMessageId)
                const message = page.messages?.find((msg) => msg.id === currentMessageId)
                if (message && message.children) {
                  message.children.forEach((childId) => {
                    findChildrenRecursively(childId)
                  })
                }
              }

              findChildrenRecursively(messageId)

              // 找到要删除的根消息（用于更新父消息）
              const messageToDelete = page.messages?.find((msg) => msg.id === messageId)

              // 过滤掉要删除的消息
              let updatedMessages =
                page.messages?.filter((msg) => !messagesToDelete.has(msg.id)) || []

              // 更新父消息的children数组（如果被删除的消息有父消息）
              if (messageToDelete?.parentId) {
                updatedMessages = updatedMessages.map((msg) => {
                  if (msg.id === messageToDelete.parentId) {
                    // 从父消息的children中移除被删除的messageId（不是所有被删除的消息）
                    return {
                      ...msg,
                      children: (msg.children || []).filter((childId) => childId !== messageId)
                    }
                  }
                  return msg
                })
              }

              // 重建消息映射
              const newMessageMap: { [key: string]: ChatMessage } = {}
              updatedMessages.forEach((msg) => {
                newMessageMap[msg.id] = msg
              })

              // 更新当前路径，移除已删除的消息
              let newCurrentPath = page.currentPath || []

              // 如果当前路径包含被删除的消息，需要调整路径
              if (newCurrentPath.some((id) => messagesToDelete.has(id))) {
                // 找到第一个被删除消息在路径中的位置
                const deletedMessageIndex = newCurrentPath.findIndex((id) =>
                  messagesToDelete.has(id)
                )
                if (deletedMessageIndex !== -1) {
                  // 截取到被删除消息之前的路径
                  newCurrentPath = newCurrentPath.slice(0, deletedMessageIndex)

                  // 递归构建路径到节点的函数
                  const buildPathToNode = (nodeId: string): string[] => {
                    const node = updatedMessages.find((msg) => msg.id === nodeId)
                    if (!node) return []
                    if (!node.parentId) return [nodeId]
                    const parentPath = buildPathToNode(node.parentId)
                    return [...parentPath, nodeId]
                  }

                  // 递归向下找到最新子节点的函数
                  const extendPathToLeaf = (path: string[]): string[] => {
                    if (path.length === 0) return path
                    const lastNodeId = path[path.length - 1]
                    const lastNode = updatedMessages.find((msg) => msg.id === lastNodeId)

                    if (lastNode?.children && lastNode.children.length > 0) {
                      const children = lastNode.children
                        .map((id) => updatedMessages.find((msg) => msg.id === id))
                        .filter(Boolean) as ChatMessage[]

                      if (children.length > 0) {
                        children.sort((a, b) => b.timestamp - a.timestamp)
                        const newestChild = children[0]
                        return extendPathToLeaf([...path, newestChild.id])
                      }
                    }
                    return path
                  }

                  // 处理不同情况
                  if (messageToDelete?.parentId) {
                    // 情况1：删除的消息有父节点
                    const parentMessage = updatedMessages.find(
                      (msg) => msg.id === messageToDelete.parentId
                    )
                    if (parentMessage?.children && parentMessage.children.length > 0) {
                      // 找到最近的同级兄弟
                      const siblings = parentMessage.children
                        .map((id) => updatedMessages.find((msg) => msg.id === id))
                        .filter(Boolean) as ChatMessage[]

                      if (siblings.length > 0) {
                        siblings.sort((a, b) => b.timestamp - a.timestamp)
                        const newestSibling = siblings[0]
                        // 构建完整路径并扩展到叶子节点
                        newCurrentPath = extendPathToLeaf(buildPathToNode(newestSibling.id))
                      }
                      // 如果没有兄弟节点，路径停留在父节点
                    }
                    // 如果父节点没有其他子节点，路径停留在父节点
                  } else {
                    // 情况2：删除的是根级别的消息（没有父节点）
                    // 找到其他根级别的消息
                    const rootMessages = updatedMessages.filter((msg) => !msg.parentId)
                    if (rootMessages.length > 0) {
                      // 选择最新的根消息
                      rootMessages.sort((a, b) => b.timestamp - a.timestamp)
                      const newestRoot = rootMessages[0]
                      // 构建路径并扩展到叶子节点
                      newCurrentPath = extendPathToLeaf([newestRoot.id])
                    } else {
                      // 如果没有其他根消息，清空路径
                      newCurrentPath = []
                    }
                  }
                }
              }

              updatePage(chatId, {
                messages: updatedMessages,
                currentPath: newCurrentPath,
                messageMap: newMessageMap
              })
            }
          } catch (error) {
            handleStoreError('messagesStore', 'deleteMessageAndChildren', error)
          }
        },

        toggleMessageStar: (chatId, messageId) => {
          try {
            const { updatePage } = usePagesStore.getState()
            const page = usePagesStore.getState().findPageById(chatId)
            if (page && page.type === 'regular') {
              const updatedMessages =
                page.messages?.map((msg) =>
                  msg.id === messageId ? { ...msg, starred: !msg.starred } : msg
                ) || []
              updatePage(chatId, { messages: updatedMessages })
            }
          } catch (error) {
            handleStoreError('messagesStore', 'toggleMessageStar', error)
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

              // 同步更新 messageMap
              let updatedMessageMap = page.messageMap
              if (updatedMessageMap && updatedMessageMap[messageId]) {
                updatedMessageMap = {
                  ...updatedMessageMap,
                  [messageId]: {
                    ...updatedMessageMap[messageId],
                    content,
                    reasoning_content,
                    isStreaming: false
                  }
                }
              }

              updatePage(chatId, {
                messages: updatedMessages,
                messageMap: updatedMessageMap
              })
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

              // 同步更新 messageMap
              let updatedMessageMap = page.messageMap
              if (updatedMessageMap && updatedMessageMap[messageId]) {
                updatedMessageMap = {
                  ...updatedMessageMap,
                  [messageId]: {
                    ...updatedMessageMap[messageId],
                    content,
                    reasoning_content,
                    isStreaming: false
                  }
                }
              }

              updatePage(chatId, {
                messages: updatedMessages,
                messageMap: updatedMessageMap,
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

              // 同步更新 messageMap
              let updatedMessageMap = page.messageMap
              if (updatedMessageMap && updatedMessageMap[messageId]) {
                updatedMessageMap = {
                  ...updatedMessageMap,
                  [messageId]: {
                    ...updatedMessageMap[messageId],
                    content,
                    reasoning_content,
                    isStreaming: false
                  }
                }
              }

              updatePage(chatId, {
                messages: updatedMessages,
                messageMap: updatedMessageMap,
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
