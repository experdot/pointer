import { Chat, ChatMessage, RegularChat } from '../types'
import { v4 as uuidv4 } from 'uuid'
import { MessageTree } from '../components/pages/chat/messageTree'
import './exporter.css'

// 导入限制常量
const MAX_IMPORT_LIMIT = 50

// DeepSeek导出格式的类型定义
export interface DeepSeekMessage {
  id: string
  parent: string | null
  children: string[]
  message: {
    files: any[]
    search_results: any
    model: string
    reasoning_content: string | null
    content: string
    inserted_at: string
  } | null
}

export interface DeepSeekChat {
  id: string
  title: string
  inserted_at: string
  updated_at: string
  mapping: { [key: string]: DeepSeekMessage }
}

// OpenAI导出格式的类型定义
export interface OpenAIMessage {
  id: string
  message: {
    id: string
    author: {
      role: 'user' | 'assistant' | 'system'
      name?: string | null
      metadata?: any
    }
    create_time: number | null
    update_time: number | null
    content: {
      content_type: string
      parts: string[]
    }
    status: string
    end_turn?: boolean | null
    weight: number
    metadata?: any
    recipient?: string
    channel?: string | null
  } | null
  parent: string | null
  children: string[]
}

export interface OpenAIChat {
  title: string
  create_time: number
  update_time: number
  mapping: { [key: string]: OpenAIMessage }
  moderation_results?: any[]
  current_node?: string
  plugin_ids?: string[] | null
  conversation_id: string
  conversation_template_id?: string | null
  gizmo_id?: string | null
  gizmo_type?: string | null
  is_archived?: boolean
  is_starred?: boolean | null
  safe_urls?: string[]
  blocked_urls?: string[]
  default_model_slug?: string
  conversation_origin?: string | null
  voice?: string | null
  async_status?: string | null
  disabled_tool_ids?: string[]
  is_do_not_remember?: boolean | null
  memory_scope?: string
  sugar_item_id?: string | null
  id: string
}

// 支持的聊天格式类型
export type ChatFormat = 'deepseek' | 'openai' | 'unknown'

// 导入结果
export interface ImportResult {
  success: boolean
  pages: Chat[]
  folder?: { id: string; name: string }
  successCount: number
  errorCount: number
  message: string
}

// 可选择的聊天项
export interface SelectableChatItem {
  id: string
  title: string
  messageCount: number
  createTime: number
  formatType: ChatFormat
  originalData: DeepSeekChat | OpenAIChat
}

// 解析结果
export interface ParseResult {
  success: boolean
  formatType: ChatFormat
  pages: SelectableChatItem[]
  message: string
}

/**
 * 检测聊天历史的格式类型
 */
export function detectChatFormat(data: any): ChatFormat {
  if (Array.isArray(data)) {
    const firstItem = data[0]
    if (firstItem && firstItem.mapping && firstItem.title && firstItem.inserted_at) {
      return 'deepseek'
    }
    // 检查OpenAI数组格式
    if (
      firstItem &&
      firstItem.mapping &&
      firstItem.title &&
      firstItem.create_time &&
      firstItem.conversation_id
    ) {
      return 'openai'
    }
  }

  if (data.title && data.mapping && data.create_time) {
    return 'openai'
  }

  return 'unknown'
}

/**
 * 将OpenAI格式的消息转换为应用内部格式
 */
export function convertOpenAIMessages(mapping: { [key: string]: OpenAIMessage }): ChatMessage[] {
  const messages: ChatMessage[] = []
  const processedIds = new Set<string>()

  // 递归处理消息节点
  const processMessage = (nodeId: string, parentId?: string): void => {
    if (processedIds.has(nodeId) || !mapping[nodeId]) return

    const node = mapping[nodeId]
    if (!node.message || !node.message.content || !node.message.content.parts) return

    processedIds.add(nodeId)

    // 跳过系统消息和空消息
    if (
      node.message.author.role === 'system' ||
      node.message.content.parts.join('').trim() === ''
    ) {
      // 处理子消息
      node.children.forEach((childId) => {
        processMessage(childId, parentId)
      })
      return
    }

    const message: ChatMessage = {
      id: node.id,
      role: node.message.author.role === 'assistant' ? 'assistant' : 'user',
      content: node.message.content.parts.join('\n'),
      timestamp: node.message.create_time ? node.message.create_time * 1000 : Date.now(),
      parentId: parentId,
      children: node.children.length > 0 ? node.children : undefined
    }

    messages.push(message)

    // 处理子消息
    node.children.forEach((childId) => {
      processMessage(childId, node.id)
    })
  }

  // 找到根节点（parent为null的节点）
  const rootNodes = Object.values(mapping).filter((node) => node.parent === null)

  rootNodes.forEach((rootNode) => {
    rootNode.children.forEach((childId) => {
      processMessage(childId)
    })
  })

  return messages
}

/**
 * 将DeepSeek格式的消息树转换为应用内部的消息数组
 */
export function convertDeepSeekMessages(mapping: {
  [key: string]: DeepSeekMessage
}): ChatMessage[] {
  const messages: ChatMessage[] = []
  const processedIds = new Set<string>()

  // 递归处理消息节点
  const processMessage = (nodeId: string, parentId?: string): void => {
    if (processedIds.has(nodeId) || nodeId === 'root') return

    const node = mapping[nodeId]
    if (!node || !node.message) return

    processedIds.add(nodeId)

    // 根据消息内容和模型信息推断角色
    let role: 'user' | 'assistant' = 'user'

    // 如果有模型信息是助手回复
    if (node.message.model) {
      role = 'assistant'
    }

    // 如果有父消息，根据层级关系判断角色
    if (parentId) {
      const parentMessage = messages.find((m) => m.id === parentId)
      if (parentMessage) {
        role = parentMessage.role === 'user' ? 'assistant' : 'user'
      }
    }

    // 如果是根节点的直接子节点，通常是用户消息
    const rootNode = mapping['root']
    if (rootNode && rootNode.children.includes(nodeId)) {
      role = 'user'
    }

    // 转换为应用内部的消息格式
    const message: ChatMessage = {
      id: nodeId,
      role,
      content: node.message.content,
      timestamp: new Date(node.message.inserted_at).getTime(),
      parentId: parentId,
      children: node.children.length > 0 ? node.children : undefined,
      modelId: node.message.model,
      reasoning_content: node.message.reasoning_content || undefined
    }

    messages.push(message)

    // 处理子消息
    node.children.forEach((childId) => {
      processMessage(childId, nodeId)
    })
  }

  // 从根节点开始处理
  const rootNode = mapping['root']
  if (rootNode && rootNode.children) {
    rootNode.children.forEach((childId) => {
      processMessage(childId)
    })
  }

  return messages
}

/**
 * 处理DeepSeek格式的聊天数据
 */
function processDeepSeekData(
  data: DeepSeekChat[],
  folderId?: string
): { pages: Chat[]; successCount: number; errorCount: number; skippedCount: number } {
  const pages: Chat[] = []
  let successCount = 0
  let errorCount = 0
  let skippedCount = 0

  // 限制处理的数据量
  const limitedData = data.slice(0, MAX_IMPORT_LIMIT)
  skippedCount = Math.max(0, data.length - MAX_IMPORT_LIMIT)

  limitedData.forEach((chatData: DeepSeekChat) => {
    try {
      if (chatData.mapping && chatData.title) {
        const messages = convertDeepSeekMessages(chatData.mapping)

        // 使用MessageTree来生成正确的currentPath
        const messageTree = new MessageTree(messages)
        const currentPath = messageTree.getCurrentPath()

        const chat: Chat = {
          id: uuidv4(), // 生成新的ID避免冲突
          title: chatData.title,
          messages,
          currentPath, // 设置正确的当前路径
          folderId, // 分配到指定文件夹
          createdAt: new Date(chatData.inserted_at).getTime(),
          updatedAt: new Date(chatData.updated_at).getTime()
        }

        pages.push(chat)
        successCount++
      }
    } catch (error) {
      console.error('处理单个DeepSeek聊天时出错:', error)
      errorCount++
    }
  })

  return { pages, successCount, errorCount, skippedCount }
}

/**
 * 处理OpenAI格式的聊天数据
 */
function processOpenAIData(
  data: OpenAIChat[] | OpenAIChat,
  folderId?: string
): { pages: Chat[]; successCount: number; errorCount: number; skippedCount: number } {
  const pages: Chat[] = []
  let successCount = 0
  let errorCount = 0
  let skippedCount = 0

  // 统一处理为数组格式
  const chatArray = Array.isArray(data) ? data : [data]

  // 限制处理的数据量
  const limitedData = chatArray.slice(0, MAX_IMPORT_LIMIT)
  skippedCount = Math.max(0, chatArray.length - MAX_IMPORT_LIMIT)

  limitedData.forEach((chatData: OpenAIChat) => {
    try {
      if (chatData.mapping && chatData.title) {
        const messages = convertOpenAIMessages(chatData.mapping)

        // 使用MessageTree来生成正确的currentPath
        const messageTree = new MessageTree(messages)
        const currentPath = messageTree.getCurrentPath()

        const chat: Chat = {
          id: uuidv4(),
          title: chatData.title,
          messages,
          currentPath, // 设置正确的当前路径
          folderId,
          createdAt: chatData.create_time * 1000,
          updatedAt: chatData.update_time * 1000
        }

        pages.push(chat)
        successCount++
      }
    } catch (error) {
      console.error('处理单个OpenAI聊天时出错:', error)
      errorCount++
    }
  })

  return { pages, successCount, errorCount, skippedCount }
}

/**
 * 生成导入文件夹名称
 */
function generateFolderName(formatType: ChatFormat, data: any): string {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD格式

  if (formatType === 'deepseek') {
    // 尝试从DeepSeek数据中获取日期
    if (Array.isArray(data) && data.length > 0) {
      const firstChat = data[0]
      if (firstChat.inserted_at) {
        const chatDate = new Date(firstChat.inserted_at).toISOString().split('T')[0]
        return `DeepSeek导入-${chatDate}`
      }
    }
    return `DeepSeek导入-${today}`
  } else if (formatType === 'openai') {
    // 尝试从OpenAI数据中获取日期
    if (Array.isArray(data) && data.length > 0 && data[0].create_time) {
      const chatDate = new Date(data[0].create_time * 1000).toISOString().split('T')[0]
      return `OpenAI导入-${chatDate}`
    } else if (data.create_time) {
      const chatDate = new Date(data.create_time * 1000).toISOString().split('T')[0]
      return `OpenAI导入-${chatDate}`
    }
    return `OpenAI导入-${today}`
  } else {
    return `外部导入-${today}`
  }
}

/**
 * 解析外部聊天历史文件，返回可选择的聊天列表
 */
export function parseExternalChatHistory(jsonContent: string): ParseResult {
  try {
    const externalData = JSON.parse(jsonContent)
    const formatType = detectChatFormat(externalData)

    if (formatType === 'unknown') {
      return {
        success: false,
        formatType: 'unknown',
        pages: [],
        message: '不支持的文件格式。目前支持DeepSeek和OpenAI导出的聊天历史格式。'
      }
    }

    const pages: SelectableChatItem[] = []

    if (formatType === 'deepseek') {
      if (Array.isArray(externalData)) {
        externalData.forEach((chatData: DeepSeekChat, index) => {
          if (chatData.mapping && chatData.title) {
            // 计算消息数量
            const messageCount = Object.keys(chatData.mapping).filter(
              (key) => key !== 'root' && chatData.mapping[key]?.message
            ).length

            pages.push({
              id: `deepseek_${index}_${chatData.id}`,
              title: chatData.title,
              messageCount,
              createTime: new Date(chatData.inserted_at).getTime(),
              formatType: 'deepseek',
              originalData: chatData
            })
          }
        })
      }
    } else if (formatType === 'openai') {
      const chatArray = Array.isArray(externalData) ? externalData : [externalData]
      chatArray.forEach((chatData: OpenAIChat, index) => {
        if (chatData.mapping && chatData.title) {
          // 计算有效消息数量
          const messageCount = Object.values(chatData.mapping).filter(
            (node) =>
              node.message &&
              node.message.author.role !== 'system' &&
              node.message.content.parts.join('').trim() !== ''
          ).length

          pages.push({
            id: `openai_${index}_${chatData.conversation_id}`,
            title: chatData.title,
            messageCount,
            createTime: chatData.create_time * 1000,
            formatType: 'openai',
            originalData: chatData
          })
        }
      })
    }

    return {
      success: true,
      formatType,
      pages,
      message: `找到 ${pages.length} 个可导入的聊天记录`
    }
  } catch (error) {
    console.error('解析外部数据失败:', error)
    return {
      success: false,
      formatType: 'unknown',
      pages: [],
      message: '解析失败，请检查文件格式是否正确'
    }
  }
}

/**
 * 导入选中的聊天记录
 */
export function importSelectedChats(
  selectedItems: SelectableChatItem[],
  folderName?: string
): ImportResult {
  if (selectedItems.length === 0) {
    return {
      success: false,
      pages: [],
      successCount: 0,
      errorCount: 0,
      message: '未选择任何聊天记录'
    }
  }

  const pages: Chat[] = []
  let successCount = 0
  let errorCount = 0

  const folderId = uuidv4()
  const finalFolderName = folderName || `外部导入-${new Date().toISOString().split('T')[0]}`

  selectedItems.forEach((item) => {
    try {
      let messages: ChatMessage[] = []

      if (item.formatType === 'deepseek') {
        const chatData = item.originalData as DeepSeekChat
        messages = convertDeepSeekMessages(chatData.mapping)
      } else if (item.formatType === 'openai') {
        const chatData = item.originalData as OpenAIChat
        messages = convertOpenAIMessages(chatData.mapping)
      }

      if (messages.length > 0) {
        // 使用MessageTree来生成正确的currentPath
        const messageTree = new MessageTree(messages)
        const currentPath = messageTree.getCurrentPath()

        const chat: RegularChat = {
          id: uuidv4(), // 生成新的ID避免冲突
          title: item.title,
          type: 'regular',
          messages,
          currentPath,
          folderId,
          createdAt: item.createTime,
          updatedAt: item.createTime
        }

        pages.push(chat)
        successCount++
      }
    } catch (error) {
      console.error('处理单个聊天时出错:', error)
      errorCount++
    }
  })

  if (pages.length > 0) {
    let message = `导入成功！共导入 ${successCount} 个聊天记录到文件夹"${finalFolderName}"`
    if (errorCount > 0) {
      message += `，失败 ${errorCount} 个`
    }

    return {
      success: true,
      pages,
      folder: { id: folderId, name: finalFolderName },
      successCount,
      errorCount,
      message
    }
  } else {
    return {
      success: false,
      pages: [],
      successCount: 0,
      errorCount: errorCount || 1,
      message: '未找到有效的聊天记录'
    }
  }
}

/**
 * 导入外部聊天历史的主要函数 (保持向后兼容)
 */
export function importExternalChatHistory(jsonContent: string): ImportResult {
  try {
    const parseResult = parseExternalChatHistory(jsonContent)

    if (!parseResult.success) {
      return {
        success: false,
        pages: [],
        successCount: 0,
        errorCount: 1,
        message: parseResult.message
      }
    }

    // 限制为50条记录
    const limitedChats = parseResult.pages.slice(0, MAX_IMPORT_LIMIT)
    const skippedCount = Math.max(0, parseResult.pages.length - MAX_IMPORT_LIMIT)

    // 生成文件夹名称
    const folderName = generateFolderName(
      parseResult.formatType,
      parseResult.pages[0]?.originalData
    )

    const result = importSelectedChats(limitedChats, folderName)

    if (result.success && skippedCount > 0) {
      result.message += `（跳过 ${skippedCount} 个，已达到50个限制）`
    }

    return result
  } catch (error) {
    console.error('导入外部数据失败:', error)
    return {
      success: false,
      pages: [],
      successCount: 0,
      errorCount: 1,
      message: '导入失败，请检查文件格式是否正确'
    }
  }
}
