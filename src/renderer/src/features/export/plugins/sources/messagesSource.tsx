import { MessageOutlined } from '@ant-design/icons'
import type { SourcePlugin, MessagesSourceData, ExtractedContent, ExportOptions } from '../../types'
import { MessagesSourceSelector } from '../../../../components/editors/ExportEditor/sources/MessagesSource'
import { useMessagesStore } from '../../../../stores/messagesStore'
import { useSettingsStore } from '../../../../stores/settingsStore'
import type { LLMConfig, ModelConfig, Topic } from '@renderer/types/shared'
import { collectSubtreeMessages, getDirectTopicMessages } from '../../messageTraversal'
import { buildIndex, pathToMessage } from '@shared/domain'

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
    const { pageId, selectionMode, selectedMessageIds, topicId, branchMessageIds } = data

    // Load messages from store
    const record = await useMessagesStore.getState().load(pageId)
    const { messages, topics, leafMessageId } = record

    // Get LLM configs for model name lookup
    const settings = useSettingsStore.getState().settings
    const llmConfigs = settings.llmConfigs.items
    const modelConfigs = settings.modelConfigs.items

    // Filter messages based on selection mode
    let filteredMessages = messages
    const branchIds = branchMessageIds ? new Set(branchMessageIds) : undefined
    const requestedIds = new Set(selectedMessageIds)

    switch (selectionMode) {
      case 'all-branches':
        // Include all messages
        filteredMessages = messages
        break

      case 'current-branch':
        // Get current path from root to leaf
        filteredMessages = branchIds
          ? messages.filter((message) => branchIds.has(message.id))
          : getCurrentBranchMessages(messages, leafMessageId)
        break

      case 'topic-messages':
        {
          const topic = topics.find((t) => t.id === topicId)
          if (!topic) throw new Error('话题不存在，请重新选择导出范围')
          filteredMessages = getTopicMessages(messages, topic.startMessageId, topic.endMessageId)
        }
        break

      case 'free-select':
        // Use user-selected messages
        filteredMessages = messages.filter(
          (m) => requestedIds.has(m.id) && (!branchIds || branchIds.has(m.id))
        )
        break
    }

    // Sort messages by tree order
    filteredMessages = sortMessagesByTreeOrder(filteredMessages, messages)
    const selectedIds = new Set(filteredMessages.map((message) => message.id))
    const selectedTopics = topics.filter(
      (topic) =>
        selectedIds.has(topic.startMessageId) &&
        (selectionMode !== 'topic-messages' || topic.id === topicId)
    )

    // Generate raw content (markdown format as base)
    const rawContent = generateMessagesMarkdown(
      filteredMessages,
      options,
      llmConfigs,
      modelConfigs,
      selectedTopics
    )

    return {
      contentType: 'messages',
      rawContent,
      messages: filteredMessages,
      topics: selectedTopics,
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
  messages: import('@renderer/types/shared').ChatMessage[],
  leafMessageId?: string
): import('@renderer/types/shared').ChatMessage[] {
  return pathToMessage(buildIndex(messages), leafMessageId)
}

/**
 * Get messages within a topic range
 */
function getTopicMessages(
  messages: import('@renderer/types/shared').ChatMessage[],
  startMessageId: string,
  endMessageId?: string
): import('@renderer/types/shared').ChatMessage[] {
  return collectSubtreeMessages(messages, startMessageId, endMessageId)
}

/**
 * Sort messages by tree order (parent before children)
 */
function sortMessagesByTreeOrder(
  filteredMessages: import('@renderer/types/shared').ChatMessage[],
  allMessages: import('@renderer/types/shared').ChatMessage[]
): import('@renderer/types/shared').ChatMessage[] {
  const index = buildIndex(allMessages)
  const orderMap = new Map<string, number>()
  const roots = index.childrenByParent.get(undefined) ?? []
  // 显式栈避免长会话递归溢出；损坏数据中的环和孤儿也最多访问一次。
  for (const root of [...roots, ...allMessages]) {
    const stack = [root]
    while (stack.length) {
      const current = stack.pop()!
      if (orderMap.has(current.id)) continue
      orderMap.set(current.id, orderMap.size)
      const children = index.childrenByParent.get(current.id) ?? []
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i])
    }
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
  messages: import('@renderer/types/shared').ChatMessage[],
  options: ExportOptions,
  llmConfigs: LLMConfig[],
  modelConfigs: ModelConfig[],
  topics: Topic[]
): string {
  const { metadata } = options
  const lines: string[] = []

  // Build maps for quick name lookup
  const modelNameMap = new Map(llmConfigs.map((config) => [config.id, config.modelName]))
  const modelConfigNameMap = new Map(modelConfigs.map((config) => [config.id, config.name]))

  // Add topics outline if enabled
  if (metadata?.showTopicsOutline && topics.length > 0) {
    lines.push('# 目录')
    lines.push('')

    // Build a set of all topic start message IDs for boundary detection
    const topicStartIds = new Set(topics.map((t) => t.startMessageId))

    for (const topic of topics) {
      lines.push(`- **${topic.name}**`)

      // Find messages directly within this topic (excluding sub-topics)
      const topicMessages = getDirectTopicMessages(
        messages,
        topic.startMessageId,
        topic.endMessageId,
        topicStartIds
      )
      for (const msg of topicMessages) {
        if (msg.title) {
          lines.push(`  - ${msg.title}`)
        }
      }
    }
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  for (const message of messages) {
    // Role header
    const roleLabel =
      message.role === 'user' ? 'User' : message.role === 'assistant' ? 'Assistant' : 'System'

    let header = `## ${roleLabel}`

    // Add timestamp if enabled
    if (metadata?.showTimestamp && message.createdAt) {
      const date = new Date(message.createdAt)
      header += ` \`${date.toLocaleString()}\``
    }

    // Add model name if enabled
    if (metadata?.showModelName && message.llmId) {
      const modelName = modelNameMap.get(message.llmId) || message.llmId
      header += ` \`${modelName}\``
    }

    // Add model config name if enabled
    if (metadata?.showModelConfig && message.modelConfigId) {
      const configName = modelConfigNameMap.get(message.modelConfigId) || message.modelConfigId
      header += ` \`${configName}\``
    }

    lines.push(header)
    lines.push('')

    // Add message title if enabled
    if (metadata?.showMessageTitle && message.title) {
      lines.push(`**${message.title}**`)
      lines.push('')
    }

    // Add reasoning content if enabled
    if (metadata?.showReasoningContent && message.reasoning) {
      lines.push('<details>')
      lines.push('<summary>思考过程</summary>')
      lines.push('')
      lines.push(message.reasoning)
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
