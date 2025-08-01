import { ChatMessage } from '../../types/type'
import { OpenAIMessage, DeepSeekMessage } from './types'

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
