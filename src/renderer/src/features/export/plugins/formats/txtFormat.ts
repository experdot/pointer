import type { FormatPlugin, ExtractedContent, ExportOptions, ConvertResult } from '../../types'
import { useSettingsStore } from '../../../../stores/settingsStore'

/**
 * TXT Format Plugin
 *
 * Converts extracted content to plain text format.
 * Strips markdown formatting and returns plain text.
 */
export const txtFormatPlugin: FormatPlugin = {
  id: 'txt',
  name: 'Text',
  extension: 'txt',
  mimeType: 'text/plain',

  async convert(content: ExtractedContent, options: ExportOptions): Promise<ConvertResult> {
    let text: string

    switch (content.contentType) {
      case 'messages':
        // Convert messages to plain text format
        text = convertMessagesToText(content, options)
        break

      case 'text':
        // Plain text passthrough
        text = content.rawContent
        break

      case 'code':
        // Code without markdown formatting
        text = content.rawContent
        break

      case 'table':
        // Convert markdown table to plain text table
        text = convertMarkdownTableToText(content.rawContent)
        break

      default:
        text = content.rawContent
    }

    return {
      content: text,
      preview: text,
      isBinary: false,
      extension: 'txt',
      mimeType: 'text/plain'
    }
  }
}

/**
 * Convert messages to plain text format
 */
function convertMessagesToText(content: ExtractedContent, options: ExportOptions): string {
  const { messages, topics } = content
  if (!messages || messages.length === 0) {
    return content.rawContent
  }

  const { metadata } = options
  const lines: string[] = []

  // Build model name map for lookup
  const settings = useSettingsStore.getState().settings
  const llmConfigs = settings.llmConfigs.items
  const modelConfigs = settings.modelConfigs.items
  const modelNameMap = new Map(llmConfigs.map((config) => [config.id, config.modelName]))
  const modelConfigNameMap = new Map(modelConfigs.map((config) => [config.id, config.name]))

  // Add topics outline if enabled
  if (metadata?.showTopicsOutline && topics && topics.length > 0) {
    lines.push('目录')
    lines.push('='.repeat(50))
    lines.push('')

    const topicStartIds = new Set(topics.map((t) => t.startMessageId))

    for (const topic of topics) {
      const indent = '  '.repeat(topic.indent)
      lines.push(`${indent}* ${topic.name}`)

      // Find messages directly within this topic
      const topicMessages = getDirectTopicMessages(
        messages,
        topic.startMessageId,
        topic.endMessageId,
        topicStartIds
      )
      for (const msg of topicMessages) {
        if (msg.title) {
          const msgIndent = '  '.repeat(topic.indent + 1)
          lines.push(`${msgIndent}- ${msg.title}`)
        }
      }
    }
    lines.push('')
    lines.push('='.repeat(50))
    lines.push('')
  }

  for (const message of messages) {
    const roleLabel =
      message.role === 'user' ? '用户' : message.role === 'assistant' ? '助手' : '系统'

    // Build header
    let header = `[${roleLabel}]`

    if (metadata?.showTimestamp && message.createdAt) {
      const date = new Date(message.createdAt)
      header += ` ${date.toLocaleString()}`
    }

    if (metadata?.showModelName && message.modelId) {
      const modelName = modelNameMap.get(message.modelId) || message.modelId
      header += ` (${modelName})`
    }

    if (metadata?.showModelConfig && message.modelConfigId) {
      const configName = modelConfigNameMap.get(message.modelConfigId) || message.modelConfigId
      header += ` [${configName}]`
    }

    lines.push(header)

    // Add title if enabled
    if (metadata?.showMessageTitle && message.title) {
      lines.push(`标题：${message.title}`)
    }

    lines.push('')

    // Add reasoning content if enabled
    if (metadata?.showReasoningContent && message.reasoning_content) {
      lines.push('--- 思考过程 > 开始 ---')
      lines.push(message.reasoning_content)
      lines.push('--- 思考过程 > 结束---')
      lines.push('')
    }

    // Add message content (strip markdown)
    lines.push(stripMarkdown(message.content))
    lines.push('')
    lines.push('='.repeat(50))
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Get messages directly within a topic (excluding sub-topics)
 */
function getDirectTopicMessages(
  messages: import('../../../../types/type').ChatMessage[],
  startMessageId: string,
  endMessageId: string | undefined,
  allTopicStartIds: Set<string>
): import('../../../../types/type').ChatMessage[] {
  const messageMap = new Map(messages.map((m) => [m.id, m]))
  const result: import('../../../../types/type').ChatMessage[] = []
  const visited = new Set<string>()

  function collect(id: string): void {
    if (visited.has(id)) return
    visited.add(id)

    const msg = messageMap.get(id)
    if (!msg) return

    result.push(msg)

    if (endMessageId && id === endMessageId) return

    for (const m of messages) {
      if (m.parentMessageId === id) {
        if (allTopicStartIds.has(m.id) && m.id !== startMessageId) {
          continue
        }
        collect(m.id)
      }
    }
  }

  collect(startMessageId)
  return result
}

/**
 * Strip basic markdown formatting from text
 */
function stripMarkdown(text: string): string {
  return (
    text
      // Remove headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      // Remove code blocks (keep content)
      .replace(/```[\s\S]*?\n([\s\S]*?)```/g, '$1')
      // Remove inline code
      .replace(/`(.+?)`/g, '$1')
      // Remove links (keep text)
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      // Remove images
      .replace(/!\[.*?\]\(.+?\)/g, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}$/gm, '')
      // Clean up extra newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

/**
 * Convert markdown table to plain text table
 */
function convertMarkdownTableToText(markdown: string): string {
  const lines = markdown.trim().split('\n')
  const result: string[] = []

  for (const line of lines) {
    // Skip separator lines
    if (/^[\s|:-]+$/.test(line)) continue

    // Convert table row to plain text
    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0)

    if (cells.length > 0) {
      result.push(cells.join('\t'))
    }
  }

  return result.join('\n')
}
