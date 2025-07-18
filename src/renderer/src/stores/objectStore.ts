import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { ObjectData, ObjectNode, NodeConnection, ObjectGenerationRecord } from '../types/type'
import { createPersistConfig, handleStoreError } from './persistence/storeConfig'
import { usePagesStore } from './pagesStore'

export interface ObjectState {
  // 对象相关的状态通过pagesStore访问，这里主要提供操作方法
}

export interface ObjectActions {
  // 对象数据操作
  updateObjectData: (chatId: string, data: Partial<ObjectData>) => void

  // 节点操作
  addObjectNode: (chatId: string, node: ObjectNode, parentId?: string) => void
  updateObjectNode: (chatId: string, nodeId: string, updates: Partial<ObjectNode>) => void
  deleteObjectNode: (chatId: string, nodeId: string) => void
  clearObjectNodeChildren: (chatId: string, nodeId: string) => void

  // 节点选择和展开
  selectObjectNode: (chatId: string, nodeId: string | null) => void
  toggleObjectNodeExpansion: (chatId: string, nodeId: string) => void
  expandObjectNode: (chatId: string, nodeId: string) => void
  collapseObjectNode: (chatId: string, nodeId: string) => void

  // 搜索和过滤
  searchObjectNodes: (chatId: string, query: string) => void
  clearObjectSearch: (chatId: string) => void

  // 连接管理
  addNodeConnection: (chatId: string, nodeId: string, connection: NodeConnection) => void
  updateNodeConnection: (
    chatId: string,
    nodeId: string,
    connectionIndex: number,
    connection: NodeConnection
  ) => void
  removeNodeConnection: (chatId: string, nodeId: string, connectionIndex: number) => void

  // 关系节点生成和创建
  generateRelationNodes: (
    chatId: string,
    sourceNodeId: string,
    targetNodeId: string,
    prompt: string,
    modelId: string,
    relationId?: string
  ) => void
  createRelationNode: (
    chatId: string,
    relationNode: ObjectNode,
    sourceNodeId: string,
    targetNodeId: string,
    sourceRole: string,
    targetRole: string
  ) => void
  generateObjectChildren: (
    chatId: string,
    nodeId: string,
    prompt: string,
    modelId: string,
    generationId?: string
  ) => void

  // 生成记录
  addObjectGenerationRecord: (chatId: string, record: ObjectGenerationRecord) => void
  updateGenerationRecord: (chatId: string, generationId: string, generatedNodeIds: string[]) => void

  // 工具方法
  getObjectData: (chatId: string) => ObjectData | undefined
  getObjectNode: (chatId: string, nodeId: string) => ObjectNode | undefined
  getObjectNodeChildren: (chatId: string, nodeId: string) => ObjectNode[]
  isNodeExpanded: (chatId: string, nodeId: string) => boolean
}

const initialState: ObjectState = {}

export const useObjectStore = create<ObjectState & ObjectActions>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // 对象数据操作
      updateObjectData: (chatId, data) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'object') {
            const updatedObjectData = { ...page.objectData, ...data }
            updatePage(chatId, { objectData: updatedObjectData })
          }
        } catch (error) {
          handleStoreError('objectStore', 'updateObjectData', error)
        }
      },

      // 节点操作
      addObjectNode: (chatId, node, parentId) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'object' && page.objectData) {
            const updatedNodes = { ...page.objectData.nodes, [node.id]: node }

            // 如果有父节点，更新父节点的children
            if (parentId && updatedNodes[parentId]) {
              const parentNode = updatedNodes[parentId]
              updatedNodes[parentId] = {
                ...parentNode,
                children: [...(parentNode.children || []), node.id]
              }
            }

            const updatedObjectData = {
              ...page.objectData,
              nodes: updatedNodes
            }

            updatePage(chatId, { objectData: updatedObjectData })
          }
        } catch (error) {
          handleStoreError('objectStore', 'addObjectNode', error)
        }
      },

      updateObjectNode: (chatId, nodeId, updates) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'object' && page.objectData) {
            const updatedNodes = { ...page.objectData.nodes }

            if (updatedNodes[nodeId]) {
              updatedNodes[nodeId] = { ...updatedNodes[nodeId], ...updates }
            }

            const updatedObjectData = {
              ...page.objectData,
              nodes: updatedNodes
            }

            updatePage(chatId, { objectData: updatedObjectData })
          }
        } catch (error) {
          handleStoreError('objectStore', 'updateObjectNode', error)
        }
      },

      deleteObjectNode: (chatId, nodeId) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'object' && page.objectData) {
            const updatedNodes = { ...page.objectData.nodes }
            delete updatedNodes[nodeId]

            const updatedObjectData = {
              ...page.objectData,
              nodes: updatedNodes
            }

            updatePage(chatId, { objectData: updatedObjectData })
          }
        } catch (error) {
          handleStoreError('objectStore', 'deleteObjectNode', error)
        }
      },

      clearObjectNodeChildren: (chatId, nodeId) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'object' && page.objectData) {
            const updatedNodes = { ...page.objectData.nodes }

            if (updatedNodes[nodeId]) {
              updatedNodes[nodeId] = { ...updatedNodes[nodeId], children: [] }
            }

            const updatedObjectData = {
              ...page.objectData,
              nodes: updatedNodes
            }

            updatePage(chatId, { objectData: updatedObjectData })
          }
        } catch (error) {
          handleStoreError('objectStore', 'clearObjectNodeChildren', error)
        }
      },

      // 节点选择和展开
      selectObjectNode: (chatId, nodeId) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'object' && page.objectData) {
            const updatedObjectData = {
              ...page.objectData,
              selectedNodeId: nodeId
            }

            updatePage(chatId, { objectData: updatedObjectData })
          }
        } catch (error) {
          handleStoreError('objectStore', 'selectObjectNode', error)
        }
      },

      toggleObjectNodeExpansion: (chatId, nodeId) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'object' && page.objectData) {
            const expandedNodes = [...page.objectData.expandedNodes]
            const isExpanded = expandedNodes.includes(nodeId)

            const updatedExpandedNodes = isExpanded
              ? expandedNodes.filter((id) => id !== nodeId)
              : [...expandedNodes, nodeId]

            const updatedObjectData = {
              ...page.objectData,
              expandedNodes: updatedExpandedNodes
            }

            updatePage(chatId, { objectData: updatedObjectData })
          }
        } catch (error) {
          handleStoreError('objectStore', 'toggleObjectNodeExpansion', error)
        }
      },

      expandObjectNode: (chatId, nodeId) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'object' && page.objectData) {
            const expandedNodes = [...page.objectData.expandedNodes]

            if (!expandedNodes.includes(nodeId)) {
              expandedNodes.push(nodeId)
            }

            const updatedObjectData = {
              ...page.objectData,
              expandedNodes
            }

            updatePage(chatId, { objectData: updatedObjectData })
          }
        } catch (error) {
          handleStoreError('objectStore', 'expandObjectNode', error)
        }
      },

      collapseObjectNode: (chatId, nodeId) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'object' && page.objectData) {
            const expandedNodes = page.objectData.expandedNodes.filter((id) => id !== nodeId)

            const updatedObjectData = {
              ...page.objectData,
              expandedNodes
            }

            updatePage(chatId, { objectData: updatedObjectData })
          }
        } catch (error) {
          handleStoreError('objectStore', 'collapseObjectNode', error)
        }
      },

      // 搜索和过滤
      searchObjectNodes: (chatId, query) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'object' && page.objectData) {
            // 简化搜索实现
            const filteredNodeIds = Object.keys(page.objectData.nodes).filter((nodeId) => {
              const node = page.objectData!.nodes[nodeId]
              return (
                node.name.toLowerCase().includes(query.toLowerCase()) ||
                (node.description && node.description.toLowerCase().includes(query.toLowerCase()))
              )
            })

            const updatedObjectData = {
              ...page.objectData,
              searchQuery: query,
              filteredNodeIds
            }

            updatePage(chatId, { objectData: updatedObjectData })
          }
        } catch (error) {
          handleStoreError('objectStore', 'searchObjectNodes', error)
        }
      },

      clearObjectSearch: (chatId) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'object' && page.objectData) {
            const updatedObjectData = {
              ...page.objectData,
              searchQuery: '',
              filteredNodeIds: undefined
            }

            updatePage(chatId, { objectData: updatedObjectData })
          }
        } catch (error) {
          handleStoreError('objectStore', 'clearObjectSearch', error)
        }
      },

      // 连接管理
      addNodeConnection: (chatId, nodeId, connection) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'object' && page.objectData) {
            const updatedNodes = { ...page.objectData.nodes }
            const node = updatedNodes[nodeId]

            if (node) {
              updatedNodes[nodeId] = {
                ...node,
                connections: [...(node.connections || []), connection]
              }
            }

            const updatedObjectData = {
              ...page.objectData,
              nodes: updatedNodes
            }

            updatePage(chatId, { objectData: updatedObjectData })
          }
        } catch (error) {
          handleStoreError('objectStore', 'addNodeConnection', error)
        }
      },

      updateNodeConnection: (chatId, nodeId, connectionIndex, connection) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'object' && page.objectData) {
            const updatedNodes = { ...page.objectData.nodes }
            const node = updatedNodes[nodeId]

            if (node && node.connections) {
              const updatedConnections = [...node.connections]
              updatedConnections[connectionIndex] = connection

              updatedNodes[nodeId] = {
                ...node,
                connections: updatedConnections
              }
            }

            const updatedObjectData = {
              ...page.objectData,
              nodes: updatedNodes
            }

            updatePage(chatId, { objectData: updatedObjectData })
          }
        } catch (error) {
          handleStoreError('objectStore', 'updateNodeConnection', error)
        }
      },

      removeNodeConnection: (chatId, nodeId, connectionIndex) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'object' && page.objectData) {
            const updatedNodes = { ...page.objectData.nodes }
            const node = updatedNodes[nodeId]

            if (node && node.connections) {
              const updatedConnections = node.connections.filter(
                (_, index) => index !== connectionIndex
              )

              updatedNodes[nodeId] = {
                ...node,
                connections: updatedConnections
              }
            }

            const updatedObjectData = {
              ...page.objectData,
              nodes: updatedNodes
            }

            updatePage(chatId, { objectData: updatedObjectData })
          }
        } catch (error) {
          handleStoreError('objectStore', 'removeNodeConnection', error)
        }
      },

      // 关系节点生成和创建
      generateRelationNodes: (
        chatId: string,
        sourceNodeId: string,
        targetNodeId: string,
        prompt: string,
        modelId: string,
        relationId?: string
      ) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'object' && page.objectData) {
            // 创建关系生成记录
            const generationRecord: ObjectGenerationRecord = {
              id: relationId || Date.now().toString(),
              parentNodeId: sourceNodeId,
              prompt: `生成关系节点: ${prompt}`,
              generatedNodeIds: [], // AI生成完成后会通过updateGenerationRecord更新
              timestamp: Date.now(),
              modelId
            }

            const updatedObjectData = {
              ...page.objectData,
              generationHistory: [...page.objectData.generationHistory, generationRecord]
            }

            updatePage(chatId, { objectData: updatedObjectData })
          }
        } catch (error) {
          handleStoreError('objectStore', 'generateRelationNodes', error)
        }
      },

      createRelationNode: (
        chatId: string,
        relationNode: ObjectNode,
        sourceNodeId: string,
        targetNodeId: string,
        sourceRole: string,
        targetRole: string
      ) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'object' && page.objectData) {
            const updatedNodes = { ...page.objectData.nodes }
            const sourceNode = updatedNodes[sourceNodeId]
            const targetNode = updatedNodes[targetNodeId]

            if (sourceNode && targetNode) {
              const newRelationNode = {
                ...relationNode,
                id: Date.now().toString(),
                sourceRole,
                targetRole,
                createdAt: new Date().toISOString()
              }

              updatedNodes[relationNode.id] = newRelationNode

              // 更新源节点和目标节点的connections
              updatedNodes[sourceNodeId] = {
                ...sourceNode,
                connections: [
                  ...(sourceNode.connections || []),
                  {
                    nodeId: relationNode.id,
                    role: sourceRole,
                    description: `${sourceRole}角色`,
                    strength: 'medium' as const,
                    metadata: {
                      createdAt: Date.now(),
                      source: 'ai' as const
                    }
                  }
                ]
              }
              updatedNodes[targetNodeId] = {
                ...targetNode,
                connections: [
                  ...(targetNode.connections || []),
                  {
                    nodeId: relationNode.id,
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

              const updatedObjectData = {
                ...page.objectData,
                nodes: updatedNodes
              }

              updatePage(chatId, { objectData: updatedObjectData })
            }
          }
        } catch (error) {
          handleStoreError('objectStore', 'createRelationNode', error)
        }
      },

      generateObjectChildren: (
        chatId: string,
        nodeId: string,
        prompt: string,
        modelId: string,
        generationId?: string
      ) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'object' && page.objectData) {
            // 创建生成记录
            const generationRecord: ObjectGenerationRecord = {
              id: generationId || Date.now().toString(),
              parentNodeId: nodeId,
              prompt,
              generatedNodeIds: [], // AI生成完成后会通过updateGenerationRecord更新
              timestamp: Date.now(),
              modelId
            }

            const updatedObjectData = {
              ...page.objectData,
              generationHistory: [...page.objectData.generationHistory, generationRecord]
            }

            updatePage(chatId, { objectData: updatedObjectData })
          }
        } catch (error) {
          handleStoreError('objectStore', 'generateObjectChildren', error)
        }
      },

      // 生成记录
      addObjectGenerationRecord: (chatId, record) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'object' && page.objectData) {
            const updatedObjectData = {
              ...page.objectData,
              generationHistory: [...page.objectData.generationHistory, record]
            }

            updatePage(chatId, { objectData: updatedObjectData })
          }
        } catch (error) {
          handleStoreError('objectStore', 'addObjectGenerationRecord', error)
        }
      },

      updateGenerationRecord: (chatId, generationId, generatedNodeIds) => {
        try {
          const { updatePage } = usePagesStore.getState()
          const page = usePagesStore.getState().findPageById(chatId)

          if (page && page.type === 'object' && page.objectData) {
            const updatedHistory = page.objectData.generationHistory.map((record) =>
              record.id === generationId ? { ...record, generatedNodeIds } : record
            )

            const updatedObjectData = {
              ...page.objectData,
              generationHistory: updatedHistory
            }

            updatePage(chatId, { objectData: updatedObjectData })
          }
        } catch (error) {
          handleStoreError('objectStore', 'updateGenerationRecord', error)
        }
      },

      // 工具方法
      getObjectData: (chatId) => {
        const page = usePagesStore.getState().findPageById(chatId)
        if (page && page.type === 'object') {
          return page.objectData
        }
        return undefined
      },

      getObjectNode: (chatId, nodeId) => {
        const page = usePagesStore.getState().findPageById(chatId)
        if (page && page.type === 'object' && page.objectData) {
          return page.objectData.nodes[nodeId]
        }
        return undefined
      },

      getObjectNodeChildren: (chatId, nodeId) => {
        const page = usePagesStore.getState().findPageById(chatId)
        if (page && page.type === 'object' && page.objectData) {
          const node = page.objectData.nodes[nodeId]
          if (node?.children) {
            return node.children.map((childId) => page.objectData!.nodes[childId]).filter(Boolean)
          }
        }
        return []
      },

      isNodeExpanded: (chatId, nodeId) => {
        const page = usePagesStore.getState().findPageById(chatId)
        if (page && page.type === 'object' && page.objectData) {
          return page.objectData.expandedNodes.includes(nodeId)
        }
        return false
      }
    })),
    createPersistConfig('object-store', 1, (state) => ({
      // objectStore 只提供方法，没有状态数据
    }))
  )
)
