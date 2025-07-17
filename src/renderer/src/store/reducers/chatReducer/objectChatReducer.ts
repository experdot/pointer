import { AppState, AppAction, ObjectChat, ObjectGenerationRecord } from '../../../types/type'
import {
  createNewObjectChat,
  addNodeToObjectData,
  deleteNodeFromObjectData,
  clearNodeChildren,
  updateNodeInObjectData,
  toggleNodeExpansion,
  expandNode,
  collapseNode,
  generateNodeId
} from '../../helpers'

export const handleObjectChatActions = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'CREATE_OBJECT_CHAT': {
      const newObjectChat: ObjectChat = createNewObjectChat(
        action.payload.title,
        action.payload.folderId,
        action.payload.lineage
      )
      return {
        ...state,
        pages: [...state.pages, newObjectChat]
      }
    }

    case 'CREATE_AND_OPEN_OBJECT_CHAT': {
      const newObjectChat: ObjectChat = createNewObjectChat(
        action.payload.title,
        action.payload.folderId,
        action.payload.lineage
      )
      const newOpenTabs = state.openTabs.includes(newObjectChat.id)
        ? state.openTabs
        : [...state.openTabs, newObjectChat.id]

      return {
        ...state,
        pages: [...state.pages, newObjectChat],
        openTabs: newOpenTabs,
        activeTabId: newObjectChat.id,
        selectedNodeId: newObjectChat.id,
        selectedNodeType: 'chat'
      }
    }

    case 'UPDATE_OBJECT_DATA': {
      const { chatId, data } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            return {
              ...chat,
              objectData: {
                ...chat.objectData,
                ...data
              },
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    case 'ADD_OBJECT_NODE': {
      const { chatId, node, parentId } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            const newObjectData = addNodeToObjectData(chat.objectData, node, parentId)
            return {
              ...chat,
              objectData: newObjectData,
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    case 'UPDATE_OBJECT_NODE': {
      const { chatId, nodeId, updates } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            const newObjectData = updateNodeInObjectData(chat.objectData, nodeId, updates)
            return {
              ...chat,
              objectData: newObjectData,
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    case 'DELETE_OBJECT_NODE': {
      const { chatId, nodeId } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            const newObjectData = deleteNodeFromObjectData(chat.objectData, nodeId)
            return {
              ...chat,
              objectData: newObjectData,
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    case 'CLEAR_OBJECT_NODE_CHILDREN': {
      const { chatId, nodeId } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            const newObjectData = clearNodeChildren(chat.objectData, nodeId)
            return {
              ...chat,
              objectData: newObjectData,
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    case 'SELECT_OBJECT_NODE': {
      const { chatId, nodeId } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            return {
              ...chat,
              objectData: {
                ...chat.objectData,
                selectedNodeId: nodeId
              },
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    case 'TOGGLE_OBJECT_NODE_EXPANSION': {
      const { chatId, nodeId } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            const newObjectData = toggleNodeExpansion(chat.objectData, nodeId)
            return {
              ...chat,
              objectData: newObjectData,
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    case 'EXPAND_OBJECT_NODE': {
      const { chatId, nodeId } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            const newObjectData = expandNode(chat.objectData, nodeId)
            return {
              ...chat,
              objectData: newObjectData,
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    case 'COLLAPSE_OBJECT_NODE': {
      const { chatId, nodeId } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            const newObjectData = collapseNode(chat.objectData, nodeId)
            return {
              ...chat,
              objectData: newObjectData,
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    case 'SEARCH_OBJECT_NODES': {
      const { chatId, query } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            // 执行搜索逻辑
            const filteredNodeIds = query.trim()
              ? Object.values(chat.objectData.nodes)
                  .filter(
                    (node) =>
                      node.name.toLowerCase().includes(query.toLowerCase()) ||
                      node.description?.toLowerCase().includes(query.toLowerCase())
                  )
                  .map((node) => node.id)
              : undefined

            return {
              ...chat,
              objectData: {
                ...chat.objectData,
                searchQuery: query,
                filteredNodeIds
              },
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    case 'CLEAR_OBJECT_SEARCH': {
      const { chatId } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            return {
              ...chat,
              objectData: {
                ...chat.objectData,
                searchQuery: undefined,
                filteredNodeIds: undefined
              },
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    case 'GENERATE_OBJECT_CHILDREN': {
      const { chatId, nodeId, prompt, modelId, generationId } = action.payload

      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            // 创建生成记录
            const generationRecord: ObjectGenerationRecord = {
              id: generationId || generateNodeId(),
              parentNodeId: nodeId,
              prompt,
              generatedNodeIds: [], // AI生成完成后会通过UPDATE_GENERATION_RECORD更新
              timestamp: Date.now(),
              modelId
            }

            return {
              ...chat,
              objectData: {
                ...chat.objectData,
                generationHistory: [...chat.objectData.generationHistory, generationRecord]
              },
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    case 'ADD_OBJECT_GENERATION_RECORD': {
      const { chatId, record } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            return {
              ...chat,
              objectData: {
                ...chat.objectData,
                generationHistory: [...chat.objectData.generationHistory, record]
              },
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    case 'UPDATE_GENERATION_RECORD': {
      const { chatId, generationId, generatedNodeIds } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            const updatedHistory = chat.objectData.generationHistory.map((record) =>
              record.id === generationId ? { ...record, generatedNodeIds } : record
            )
            return {
              ...chat,
              objectData: {
                ...chat.objectData,
                generationHistory: updatedHistory
              },
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    case 'IMPORT_OBJECT_FROM_JSON': {
      const { chatId, jsonData } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            return {
              ...chat,
              objectData: {
                ...chat.objectData,
                ...jsonData
              },
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    case 'EXPORT_OBJECT_NODE': {
      // 导出操作通常在组件层处理，这里只是记录或触发
      // 实际导出逻辑在ObjectToolbar组件中处理
      return state
    }

    default:
      return state
  }
}
