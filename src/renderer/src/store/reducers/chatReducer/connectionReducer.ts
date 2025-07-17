import { AppState, AppAction, ObjectGenerationRecord } from '../../../types'
import { generateNodeId } from '../../helpers'

export const handleConnectionActions = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'ADD_NODE_CONNECTION': {
      const { chatId, nodeId, connection } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            const node = chat.objectData.nodes[nodeId]
            if (node) {
              const updatedNode = {
                ...node,
                connections: [...(node.connections || []), connection]
              }
              return {
                ...chat,
                objectData: {
                  ...chat.objectData,
                  nodes: {
                    ...chat.objectData.nodes,
                    [nodeId]: updatedNode
                  }
                },
                updatedAt: Date.now()
              }
            }
          }
          return chat
        })
      }
    }

    case 'UPDATE_NODE_CONNECTION': {
      const { chatId, nodeId, connectionIndex, connection } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            const node = chat.objectData.nodes[nodeId]
            if (node && node.connections && node.connections[connectionIndex]) {
              const updatedConnections = [...node.connections]
              updatedConnections[connectionIndex] = connection
              const updatedNode = {
                ...node,
                connections: updatedConnections
              }
              return {
                ...chat,
                objectData: {
                  ...chat.objectData,
                  nodes: {
                    ...chat.objectData.nodes,
                    [nodeId]: updatedNode
                  }
                },
                updatedAt: Date.now()
              }
            }
          }
          return chat
        })
      }
    }

    case 'REMOVE_NODE_CONNECTION': {
      const { chatId, nodeId, connectionIndex } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            const node = chat.objectData.nodes[nodeId]
            if (node && node.connections && node.connections[connectionIndex]) {
              const updatedConnections = node.connections.filter(
                (_, index) => index !== connectionIndex
              )
              const updatedNode = {
                ...node,
                connections: updatedConnections
              }
              return {
                ...chat,
                objectData: {
                  ...chat.objectData,
                  nodes: {
                    ...chat.objectData.nodes,
                    [nodeId]: updatedNode
                  }
                },
                updatedAt: Date.now()
              }
            }
          }
          return chat
        })
      }
    }

    case 'GENERATE_RELATION_NODES': {
      const { chatId, sourceNodeId, targetNodeId, prompt, modelId, relationId } = action.payload

      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            // 创建关系生成记录
            const generationRecord: ObjectGenerationRecord = {
              id: relationId || generateNodeId(),
              parentNodeId: sourceNodeId,
              prompt: `生成关系节点: ${prompt}`,
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

    case 'CREATE_RELATION_NODE': {
      const { chatId, relationNode, sourceNodeId, targetNodeId, sourceRole, targetRole } =
        action.payload

      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'object') {
            // 创建关系节点，包含连接信息
            const newRelationNode = {
              ...relationNode,
              connections: [
                {
                  nodeId: sourceNodeId,
                  role: sourceRole,
                  description: `${sourceRole}角色`,
                  strength: 'medium' as const,
                  metadata: {
                    createdAt: Date.now(),
                    source: 'ai' as const
                  }
                },
                {
                  nodeId: targetNodeId,
                  role: targetRole,
                  description: `${targetRole}角色`,
                  strength: 'medium' as const,
                  metadata: {
                    createdAt: Date.now(),
                    source: 'ai' as const
                  }
                }
              ]
            }

            return {
              ...chat,
              objectData: {
                ...chat.objectData,
                nodes: {
                  ...chat.objectData.nodes,
                  [relationNode.id]: newRelationNode
                }
              },
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    default:
      return state
  }
}
