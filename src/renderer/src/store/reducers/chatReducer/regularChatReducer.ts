import { AppState, AppAction, RegularChat } from '../../../types'
import { createNewChat } from '../../helpers'
import { v4 as uuidv4 } from 'uuid'

export const handleRegularChatActions = (state: AppState, action: AppAction): AppState => {
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

      // 从metadata中提取维度信息
      const horizontalDimensionNames =
        metadata?.horizontalDimensions?.map((d) => d.name).join(' > ') || '未知'
      const verticalDimensionNames =
        metadata?.verticalDimensions?.map((d) => d.name).join(' > ') || '未知'
      const valueDimensionNames = metadata?.valueDimensions?.map((d) => d.name).join(', ') || '未知'

      // 构建用户提示词
      const prompt = `# 基于交叉分析表单元格的深度分析

## 背景信息
- **主题**: ${metadata?.topic || '未知'}
- **横轴维度**: ${horizontalDimensionNames}
- **纵轴维度**: ${verticalDimensionNames}
- **值维度**: ${valueDimensionNames}

## 单元格位置
- **横轴路径**: ${horizontalItem}
- **纵轴路径**: ${verticalItem}

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

    case 'CREATE_CHAT_FROM_OBJECT_NODE': {
      const { folderId, nodeId, nodeName, nodeContext, sourcePageId } = action.payload

      // 构建用户提示词
      const prompt = `# 基于对象节点的深度分析

## 节点信息
- **节点名称**: ${nodeName}
- **节点ID**: ${nodeId}

## 节点上下文
${nodeContext}

## 请求
请基于以上节点信息和上下文进行深度分析，你可以：
1. 详细解释这个节点的含义、作用和在整个对象结构中的位置
2. 分析节点的层级关系、属性特征和引用关系
3. 基于上下文信息提供相关的扩展见解和建议
4. 探讨可能的改进方向、相关问题或进一步的发展方向

请开始你的分析：`

      // 生成聊天标题
      const chatTitle = `${nodeName} - 深度分析`

      // 创建用户消息
      const userMessage = {
        id: uuidv4(),
        role: 'user' as const,
        content: prompt,
        timestamp: Date.now()
      }

      // 创建溯源信息
      const lineage = {
        source: 'object_to_chat' as const,
        sourcePageId,
        sourceContext: {
          customContext: {
            nodeId,
            nodeName,
            context: nodeContext
          }
        },
        generatedPageIds: [],
        generatedAt: Date.now(),
        description: `从对象页面的节点 "${nodeName}" 生成的深度分析聊天`
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

    default:
      return state
  }
}
