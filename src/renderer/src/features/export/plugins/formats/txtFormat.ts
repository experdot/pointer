import type { FormatPlugin, ExtractedContent, ExportOptions, ConvertResult } from '../../types'

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
  const { messages } = content
  if (!messages || messages.length === 0) {
    return content.rawContent
  }

  const { metadata } = options
  const lines: string[] = []

  for (const message of messages) {
    const roleLabel = message.role === 'user' ? 'User' : message.role === 'assistant' ? 'Assistant' : 'System'

    // Build header
    let header = `[${roleLabel}]`

    if (metadata?.showTimestamp && message.createdAt) {
      const date = new Date(message.createdAt)
      header += ` ${date.toLocaleString()}`
    }

    if (metadata?.showModelName && message.modelId) {
      header += ` (${message.modelId})`
    }

    lines.push(header)

    // Add title if enabled
    if (metadata?.showMessageTitle && message.title) {
      lines.push(`Title: ${message.title}`)
    }

    lines.push('')

    // Add reasoning content if enabled
    if (metadata?.showReasoningContent && message.reasoning_content) {
      lines.push('--- Reasoning ---')
      lines.push(message.reasoning_content)
      lines.push('--- End Reasoning ---')
      lines.push('')
    }

    // Add message content (strip markdown)
    lines.push(stripMarkdown(message.content))
    lines.push('')
    lines.push('=' .repeat(50))
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Strip basic markdown formatting from text
 */
function stripMarkdown(text: string): string {
  return text
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
