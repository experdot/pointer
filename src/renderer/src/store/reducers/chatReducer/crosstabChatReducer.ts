import { AppState, AppAction, CrosstabChat } from '../../../types/type'
import { createNewCrosstabChat } from '../../helpers'

export const handleCrosstabChatActions = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
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
                  description: childNode.description
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
                  description: childNode.description
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
                currentStep:
                  stepIndex === 0 ? 0 : Math.min(stepIndex + 1, chat.crosstabData.steps.length - 1)
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

    default:
      return state
  }
}
