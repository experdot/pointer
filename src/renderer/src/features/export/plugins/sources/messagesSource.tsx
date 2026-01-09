import { MessageOutlined } from '@ant-design/icons'
import type { SourcePlugin, MessagesSourceData, ExtractedContent, ExportOptions } from '../../types'
import { MessagesSourceSelector } from '../../../../components/editors/ExportEditor/sources/MessagesSource'
import { useMessagesStore } from '../../../../stores/messagesStore'

/**
 * Messages Source Plugin
 *
 * Extracts chat messages from a conversation page.
 * Supports multiple selection modes:
 * - all-branches: All messages in the tree
 * - current-branch: Only messages in the current path
 * - topic-messages: Messages within a specific topic
 * - free-select: User-selected messages
 */
export const messagesSourcePlugin: SourcePlugin<MessagesSourceData> = {
  id: 'messages',
  name: '消息',
  icon: <MessageOutlined />,
  supportedFormats: ['markdown', 'txt', 'html'],

  async extract(data: MessagesSourceData, options: ExportOptions): Promise<ExtractedContent> {
    const { pageId, selectionMode, selectedMessageIds, topicId } = data

    // Load messages from store
    const record = await useMessagesStore.getState().load(pageId)
    const { messages, topics, leafMessageId } = record

    // Filter messages based on selection mode
    let filteredMessages = messages

    switch (selectionMode) {
      case 'all-branches':
        // Include all messages
        filteredMessages = messages
        break

      case 'current-branch':
        // Get current path from root to leaf
        filteredMessages = getCurrentBranchMessages(messages, leafMessageId)
        break

      case 'topic-messages':
        // Get messages within a specific topic
        if (topicId) {
          const topic = topics.find((t) => t.id === topicId)
          if (topic) {
            filteredMessages = getTopicMessages(messages, topic.startMessageId, topic.endMessageId)
          }
        }
        break

      case 'free-select':
        // Use user-selected messages
        filteredMessages = messages.filter((m) => selectedMessageIds.includes(m.id))
        break
    }

    // Sort messages by tree order
    filteredMessages = sortMessagesByTreeOrder(filteredMessages, messages)

    // Generate raw content (markdown format as base)
    const rawContent = generateMessagesMarkdown(filteredMessages, options)

    return {
      contentType: 'messages',
      rawContent,
      messages: filteredMessages,
      topics: selectionMode === 'topic-messages' ? topics.filter((t) => t.id === topicId) : topics,
      metadata: {
        pageId
      }
    }
  },

  SelectorComponent: MessagesSourceSelector
}

/**
 * Get messages in the current branch (from root to leaf)
 */
function getCurrentBranchMessages(
  messages: import('../../../../types/type').ChatMessage[],
  leafMessageId?: string
): import('../../../../types/type').ChatMessage[] {
  if (!leafMessageId) return []

  const messageMap = new Map(messages.map((m) => [m.id, m]))
  const path: import('../../../../types/type').ChatMessage[] = []

  let currentId: string | undefined = leafMessageId
  while (currentId) {
    const message = messageMap.get(currentId)
    if (message) {
      path.unshift(message)
      currentId = message.parentMessageId
    } else {
      break
    }
  }

  return path
}

/**
 * Get messages within a topic range
 */
function getTopicMessages(
  messages: import('../../../../types/type').ChatMessage[],
  startMessageId: string,
  endMessageId?: string
): import('../../../../types/type').ChatMessage[] {
  const messageMap = new Map(messages.map((m) => [m.id, m]))

  // Build path from root to start message
  const startPath: string[] = []
  let current = startMessageId
  while (current) {
    startPath.unshift(current)
    const msg = messageMap.get(current)
    current = msg?.parentMessageId || ''
  }

  // Collect all messages from start to end (or descendants)
  const result: import('../../../../types/type').ChatMessage[] = []
  const visited = new Set<string>()

  function collectDescendants(id: string): void {
    if (visited.has(id)) return
    visited.add(id)

    const msg = messageMap.get(id)
    if (msg) {
      result.push(msg)

      // If we've reached the end message, stop
      if (endMessageId && id === endMessageId) return

      // Find children
      for (const m of messages) {
        if (m.parentMessageId === id) {
          collectDescendants(m.id)
        }
      }
    }
  }

  collectDescendants(startMessageId)
  return result
}

/**
 * Sort messages by tree order (parent before children)
 */
function sortMessagesByTreeOrder(
  filteredMessages: import('../../../../types/type').ChatMessage[],
  allMessages: import('../../../../types/type').ChatMessage[]
): import('../../../../types/type').ChatMessage[] {
  // Build order map from all messages
  const orderMap = new Map<string, number>()
  let order = 0

  function traverse(parentId?: string): void {
    const children = allMessages
      .filter((m) => m.parentMessageId === parentId)
      .sort((a, b) => (a.branchIndex ?? 0) - (b.branchIndex ?? 0))

    for (const child of children) {
      orderMap.set(child.id, order++)
      traverse(child.id)
    }
  }

  // Find root messages (no parent)
  const roots = allMessages.filter((m) => !m.parentMessageId)
  for (const root of roots) {
    orderMap.set(root.id, order++)
    traverse(root.id)
  }

  // Sort filtered messages by order
  return [...filteredMessages].sort((a, b) => {
    const orderA = orderMap.get(a.id) ?? Infinity
    const orderB = orderMap.get(b.id) ?? Infinity
    return orderA - orderB
  })
}

/**
 * Generate markdown content from messages
 */
function generateMessagesMarkdown(
  messages: import('../../../../types/type').ChatMessage[],
  options: ExportOptions
): string {
  const { metadata } = options
  const lines: string[] = []

  for (const message of messages) {
    // Role header
    const roleLabel =
      message.role === 'user' ? 'User' : message.role === 'assistant' ? 'Assistant' : 'System'

    let header = `## ${roleLabel}`

    // Add timestamp if enabled
    if (metadata?.showTimestamp && message.createdAt) {
      const date = new Date(message.createdAt)
      header += ` (${date.toLocaleString()})`
    }

    // Add model name if enabled
    if (metadata?.showModelName && message.modelId) {
      header += ` [${message.modelId}]`
    }

    lines.push(header)
    lines.push('')

    // Add message title if enabled
    if (metadata?.showMessageTitle && message.title) {
      lines.push(`**${message.title}**`)
      lines.push('')
    }

    // Add reasoning content if enabled
    if (metadata?.showReasoningContent && message.reasoning_content) {
      lines.push('<details>')
      lines.push('<summary>思考过程</summary>')
      lines.push('')
      lines.push(message.reasoning_content)
      lines.push('')
      lines.push('</details>')
      lines.push('')
    }

    // Add message content
    lines.push(message.content)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}
