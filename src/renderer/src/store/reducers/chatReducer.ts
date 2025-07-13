import {
  AppState,
  AppAction,
  RegularChat,
  CrosstabChat,
  ObjectChat,
  ObjectGenerationRecord
} from '../../types'
import {
  createNewChat,
  createNewCrosstabChat,
  createNewObjectChat,
  removeFromArray,
  addNodeToObjectData,
  deleteNodeFromObjectData,
  clearNodeChildren,
  updateNodeInObjectData,
  toggleNodeExpansion,
  expandNode,
  collapseNode,
  generateNodeId
} from '../helpers'
import { v4 as uuidv4 } from 'uuid'

export const handleChatActions = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'CREATE_CHAT': {
      const newChat = createNewChat(
        action.payload.title,
        action.payload.folderId,
        action.payload.lineage
      )
      return {
        ...state,
        pages: [...state.pages, newChat]
      }
    }

    case 'CREATE_AND_OPEN_CHAT': {
      const newChat = createNewChat(
        action.payload.title,
        action.payload.folderId,
        action.payload.lineage
      )

      // 如果有初始消息，添加到聊天中
      if (action.payload.initialMessage) {
        // 我们知道 createNewChat 返回的是 RegularChat，所以可以安全地访问 messages 和 currentPath
        const regularChat = newChat as RegularChat
        regularChat.messages = [action.payload.initialMessage]
        regularChat.currentPath = [action.payload.initialMessage.id]
      }

      const newOpenTabs = state.openTabs.includes(newChat.id)
        ? state.openTabs
        : [...state.openTabs, newChat.id]

      return {
        ...state,
        pages: [...state.pages, newChat],
        openTabs: newOpenTabs,
        activeTabId: newChat.id,
        selectedNodeId: newChat.id,
        selectedNodeType: 'chat'
      }
    }

    case 'CREATE_CHAT_FROM_CELL': {
      const { folderId, horizontalItem, verticalItem, cellContent, metadata, sourcePageId } =
        action.payload

      // 构建用户提示词
      const prompt = `# 基于交叉分析表单元格的深度分析

## 背景信息
- **主题**: ${metadata.Topic}
- **横轴**: ${metadata.HorizontalAxis}
- **纵轴**: ${metadata.VerticalAxis}
- **值的含义**: ${metadata.Value}

## 单元格位置
- **横轴项目**: ${horizontalItem}
- **纵轴项目**: ${verticalItem}

## 单元格内容
${cellContent}

## 请求
请基于以上信息进行深度分析，你可以：
1. 详细解释这个单元格内容的含义和背景
2. 分析其在整个交叉分析表中的作用和重要性
3. 提供相关的扩展信息或见解
4. 探讨可能的改进方向或相关问题

请开始你的分析：`

      // 生成聊天标题
      const chatTitle = `${horizontalItem} × ${verticalItem} - 深度分析`

      // 创建用户消息
      const userMessage = {
        id: uuidv4(),
        role: 'user' as const,
        content: prompt,
        timestamp: Date.now()
      }

      // 创建溯源信息
      const lineage = {
        source: 'crosstab_to_chat' as const,
        sourcePageId,
        sourceContext: {
          crosstabChat: {
            horizontalItem,
            verticalItem,
            cellContent
          }
        },
        generatedPageIds: [],
        generatedAt: Date.now(),
        description: `从交叉分析表的单元格 "${horizontalItem} × ${verticalItem}" 生成的深度分析聊天`
      }

      // 创建并打开新的普通聊天窗口
      const newChat = createNewChat(chatTitle, folderId, lineage)
      const regularChat = newChat as RegularChat
      regularChat.messages = [userMessage]
      regularChat.currentPath = [userMessage.id]

      const newOpenTabs = state.openTabs.includes(newChat.id)
        ? state.openTabs
        : [...state.openTabs, newChat.id]

      // 更新源页面的generatedPageIds
      const updatedPages = state.pages.map((page) => {
        if (page.id === sourcePageId && page.lineage) {
          return {
            ...page,
            lineage: {
              ...page.lineage,
              generatedPageIds: [...page.lineage.generatedPageIds, newChat.id]
            }
          }
        }
        return page
      })

      return {
        ...state,
        pages: [...updatedPages, newChat],
        openTabs: newOpenTabs,
        activeTabId: newChat.id,
        selectedNodeId: newChat.id,
        selectedNodeType: 'chat'
      }
    }

    case 'CREATE_CROSSTAB_CHAT': {
      const newCrosstabChat = createNewCrosstabChat(
        action.payload.title,
        action.payload.folderId,
        action.payload.lineage
      )
      return {
        ...state,
        pages: [...state.pages, newCrosstabChat]
      }
    }

    case 'CREATE_AND_OPEN_CROSSTAB_CHAT': {
      const newCrosstabChat = createNewCrosstabChat(
        action.payload.title,
        action.payload.folderId,
        action.payload.lineage
      )
      const newOpenTabs = state.openTabs.includes(newCrosstabChat.id)
        ? state.openTabs
        : [...state.openTabs, newCrosstabChat.id]

      return {
        ...state,
        pages: [...state.pages, newCrosstabChat],
        openTabs: newOpenTabs,
        activeTabId: newCrosstabChat.id,
        selectedNodeId: newCrosstabChat.id,
        selectedNodeType: 'chat'
      }
    }

    case 'CREATE_CROSSTAB_FROM_OBJECTS': {
      const {
        title,
        folderId,
        horizontalNodeId,
        verticalNodeId,
        objectData,
        horizontalContext,
        verticalContext,
        sourcePageId
      } = action.payload

      // 获取横轴和纵轴节点
      const horizontalNode = objectData.nodes[horizontalNodeId]
      const verticalNode = objectData.nodes[verticalNodeId]

      if (!horizontalNode || !verticalNode) {
        return state
      }

      // 获取横轴和纵轴的子节点名称作为值列表
      const horizontalValues = (horizontalNode.children || [])
        .map((childId) => objectData.nodes[childId]?.name)
        .filter(Boolean)
      const verticalValues = (verticalNode.children || [])
        .map((childId) => objectData.nodes[childId]?.name)
        .filter(Boolean)

      // 构建层级结构描述
      const buildHierarchyDescription = (context: any) => {
        if (!context || !context.ancestorChain) return ''

        const hierarchy = context.ancestorChain
          .map((node: any, index: number) => {
            const indent = '  '.repeat(index)
            return `${indent}- ${node.name}${node.description ? ` (${node.description})` : ''}`
          })
          .join('\n')

        return hierarchy
      }

      // 构建节点详细信息
      const buildNodeDetails = (node: any, context: any) => {
        const details = []

        // 节点基本信息
        details.push(`节点名称: ${node.name}`)
        details.push(`节点类型: ${node.type}`)
        if (node.description) details.push(`描述: ${node.description}`)
        if (node.value !== undefined && node.value !== null) {
          details.push(
            `值: ${typeof node.value === 'object' ? JSON.stringify(node.value) : node.value}`
          )
        }

        // 属性信息
        if (node.properties && Object.keys(node.properties).length > 0) {
          details.push('属性:')
          Object.entries(node.properties).forEach(([key, value]) => {
            details.push(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
          })
        }

        // 上下文信息
        if (context) {
          if (context.siblings && context.siblings.length > 0) {
            details.push(`平级节点: ${context.siblings.map((s: any) => s.name).join(', ')}`)
          }
          if (context.children && context.children.length > 0) {
            details.push(`子节点: ${context.children.map((c: any) => c.name).join(', ')}`)
          }
        }

        return details.join('\n')
      }

      // 构建预填充的元数据，使用新的多维度数据结构
      const metadata = {
        topic: `${horizontalNode.name} 与 ${verticalNode.name} 的交叉分析`,
        horizontalDimensions: [
          {
            id: 'h1',
            name: horizontalNode.name,
            description: horizontalNode.description || `${horizontalNode.name} 相关的维度`,
            values: horizontalValues,
            order: 1
          }
        ],
        verticalDimensions: [
          {
            id: 'v1',
            name: verticalNode.name,
            description: verticalNode.description || `${verticalNode.name} 相关的维度`,
            values: verticalValues,
            order: 1
          }
        ],
        valueDimensions: [
          {
            id: 'value1',
            name: '关系分析',
            description: '分析各项目在两个维度交叉点的关系、特征或影响'
          }
        ],
        // 添加背景上下文信息
        objectContext: {
          // 整体对象结构信息
          rootNodeId: objectData.rootNodeId,
          totalNodes: Object.keys(objectData.nodes).length,

          // 横轴节点的详细信息
          horizontalNodeDetails: horizontalContext
            ? {
                hierarchy: buildHierarchyDescription(horizontalContext),
                nodeInfo: buildNodeDetails(horizontalNode, horizontalContext),
                parentContext: horizontalNode.parentId
                  ? objectData.nodes[horizontalNode.parentId]?.name
                  : '根节点'
              }
            : null,

          // 纵轴节点的详细信息
          verticalNodeDetails: verticalContext
            ? {
                hierarchy: buildHierarchyDescription(verticalContext),
                nodeInfo: buildNodeDetails(verticalNode, verticalContext),
                parentContext: verticalNode.parentId
                  ? objectData.nodes[verticalNode.parentId]?.name
                  : '根节点'
              }
            : null,

          // 子节点的详细信息
          horizontalChildrenDetails: horizontalValues.map((childName) => {
            const childNode = Object.values(objectData.nodes).find(
              (n) => n.name === childName && n.parentId === horizontalNodeId
            )
            return childNode
              ? {
                  name: childNode.name,
                  description: childNode.description,
                }
              : { name: childName }
          }),

          verticalChildrenDetails: verticalValues.map((childName) => {
            const childNode = Object.values(objectData.nodes).find(
              (n) => n.name === childName && n.parentId === verticalNodeId
            )
            return childNode
              ? {
                  name: childNode.name,
                  description: childNode.description,
                }
              : { name: childName }
          })
        }
      }

      // 创建溯源信息
      const lineage = {
        source: 'object_to_crosstab' as const,
        sourcePageId,
        sourceContext: {
          objectCrosstab: {
            horizontalNodeId,
            verticalNodeId,
            horizontalNodeName: horizontalNode.name,
            verticalNodeName: verticalNode.name
          }
        },
        generatedPageIds: [],
        generatedAt: Date.now(),
        description: `从对象页面的 "${horizontalNode.name}" 和 "${verticalNode.name}" 节点生成的交叉分析表`
      }

      // 创建交叉表聊天并预填充数据
      const baseCrosstabChat = createNewCrosstabChat(title, folderId, lineage)
      const newCrosstabChat: CrosstabChat = {
        ...baseCrosstabChat,
        crosstabData: {
          ...baseCrosstabChat.crosstabData,
          metadata,
          currentStep: 1, // 跳过元数据生成步骤，直接到维度数据生成步骤
          steps: baseCrosstabChat.crosstabData.steps.map((step, index) => {
            if (index === 0) {
              return { ...step, isCompleted: true, response: JSON.stringify(metadata, null, 2) }
            }
            return step
          })
        }
      }

      const newOpenTabs = state.openTabs.includes(newCrosstabChat.id)
        ? state.openTabs
        : [...state.openTabs, newCrosstabChat.id]

      // 更新源页面的generatedPageIds
      const updatedPages = state.pages.map((page) => {
        if (page.id === sourcePageId && page.lineage) {
          return {
            ...page,
            lineage: {
              ...page.lineage,
              generatedPageIds: [...page.lineage.generatedPageIds, newCrosstabChat.id]
            }
          }
        }
        return page
      })

      return {
        ...state,
        pages: [...updatedPages, newCrosstabChat],
        openTabs: newOpenTabs,
        activeTabId: newCrosstabChat.id,
        selectedNodeId: newCrosstabChat.id,
        selectedNodeType: 'chat'
      }
    }

    // 对象聊天相关操作
    case 'CREATE_OBJECT_CHAT': {
      const newObjectChat = createNewObjectChat(
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
      const newObjectChat = createNewObjectChat(
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

    case 'UPDATE_CROSSTAB_STEP': {
      const { chatId, stepIndex, response } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'crosstab') {
            const updatedSteps = [...chat.crosstabData.steps]
            updatedSteps[stepIndex] = {
              ...updatedSteps[stepIndex],
              response
            }
            return {
              ...chat,
              crosstabData: {
                ...chat.crosstabData,
                steps: updatedSteps
              },
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    case 'COMPLETE_CROSSTAB_STEP': {
      const { chatId, stepIndex } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'crosstab') {
            const updatedSteps = [...chat.crosstabData.steps]
            updatedSteps[stepIndex] = {
              ...updatedSteps[stepIndex],
              isCompleted: true
            }
            return {
              ...chat,
              crosstabData: {
                ...chat.crosstabData,
                steps: updatedSteps,
                // 对于metadata步骤，完成后不自动推进，保持在当前步骤
                currentStep: stepIndex === 0 ? 0 : Math.min(stepIndex + 1, chat.crosstabData.steps.length - 1)
              },
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    case 'UPDATE_CROSSTAB_DATA': {
      const { chatId, data } = action.payload
      return {
        ...state,
        pages: state.pages.map((chat) => {
          if (chat.id === chatId && chat.type === 'crosstab') {
            return {
              ...chat,
              crosstabData: {
                ...chat.crosstabData,
                ...data
              },
              updatedAt: Date.now()
            }
          }
          return chat
        })
      }
    }

    case 'UPDATE_CHAT': {
      return {
        ...state,
        pages: state.pages.map((chat) =>
          chat.id === action.payload.id
            ? { ...chat, ...action.payload.updates, updatedAt: Date.now() }
            : chat
        )
      }
    }

    case 'UPDATE_PAGE_LINEAGE': {
      return {
        ...state,
        pages: state.pages.map((page) =>
          page.id === action.payload.pageId
            ? {
                ...page,
                lineage: {
                  ...page.lineage,
                  ...action.payload.lineage
                },
                updatedAt: Date.now()
              }
            : page
        )
      }
    }

    case 'ADD_GENERATED_PAGE': {
      return {
        ...state,
        pages: state.pages.map((page) =>
          page.id === action.payload.sourcePageId && page.lineage
            ? {
                ...page,
                lineage: {
                  ...page.lineage,
                  generatedPageIds: [
                    ...page.lineage.generatedPageIds,
                    action.payload.generatedPageId
                  ]
                },
                updatedAt: Date.now()
              }
            : page
        )
      }
    }

    case 'DELETE_CHAT': {
      const chatToDelete = state.pages.find((chat) => chat.id === action.payload.id)
      if (!chatToDelete) return state

      const newOpenTabs = state.openTabs.filter((id) => id !== action.payload.id)
      let newActiveTabId = state.activeTabId

      if (state.activeTabId === action.payload.id) {
        newActiveTabId = newOpenTabs.length > 0 ? newOpenTabs[newOpenTabs.length - 1] : null
      }

      return {
        ...state,
        pages: removeFromArray(state.pages, action.payload.id),
        openTabs: newOpenTabs,
        activeTabId: newActiveTabId,
        selectedNodeId: state.selectedNodeId === action.payload.id ? null : state.selectedNodeId
      }
    }

    case 'DELETE_MULTIPLE_PAGES': {
      const chatIdsToDelete = action.payload.chatIds
      const updatedChats = state.pages.filter((chat) => !chatIdsToDelete.includes(chat.id))
      const updatedOpenTabs = state.openTabs.filter((id) => !chatIdsToDelete.includes(id))

      let newActiveTabId = state.activeTabId
      if (state.activeTabId && chatIdsToDelete.includes(state.activeTabId)) {
        newActiveTabId =
          updatedOpenTabs.length > 0 ? updatedOpenTabs[updatedOpenTabs.length - 1] : null
      }

      return {
        ...state,
        pages: updatedChats,
        openTabs: updatedOpenTabs,
        activeTabId: newActiveTabId,
        selectedNodeId:
          state.selectedNodeId && chatIdsToDelete.includes(state.selectedNodeId)
            ? null
            : state.selectedNodeId
      }
    }

    case 'MOVE_CHAT': {
      const { chatId, targetFolderId, newOrder } = action.payload
      return {
        ...state,
        pages: state.pages.map((page) =>
          page.id === chatId
            ? {
                ...page,
                folderId: targetFolderId,
                order: newOrder ?? page.order,
                updatedAt: Date.now()
              }
            : page
        )
      }
    }

    case 'REORDER_PAGES_IN_FOLDER': {
      const { folderId, chatIds } = action.payload
      const baseOrder = Date.now()

      return {
        ...state,
        pages: state.pages.map((chat) => {
          const newIndex = chatIds.indexOf(chat.id)
          if (newIndex !== -1 && chat.folderId === folderId) {
            return {
              ...chat,
              order: baseOrder + newIndex,
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
