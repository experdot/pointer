/**
 * Markdown serializer - converts PageFile to Markdown format
 */

import type { ChatMessage, Topic, FileAttachment } from '../../../../types/type'
import type { PageFile } from './types'
import { MESSAGE_HEADER_PREFIX, MESSAGE_SEPARATOR } from './constants'

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Escape HTML comment markers in content
 */
function escapeHtmlComment(content: string): string {
  return content.replace(/<!--/g, '&lt;!--').replace(/-->/g, '--&gt;')
}

/**
 * Serialize a single XML element
 */
function xmlElement(name: string, value: string | number | boolean | undefined): string {
  if (value === undefined) return ''
  return `  <${name}>${escapeXml(String(value))}</${name}>\n`
}

/**
 * Serialize topics to XML
 */
function serializeTopics(topics: Topic[]): string {
  if (topics.length === 0) return ''

  let xml = '  <topics>\n'
  for (const topic of topics) {
    xml += '    <topic>\n'
    xml += `      <id>${escapeXml(topic.id)}</id>\n`
    xml += `      <name>${escapeXml(topic.name)}</name>\n`
    xml += `      <startMessageId>${escapeXml(topic.startMessageId)}</startMessageId>\n`
    if (topic.endMessageId) {
      xml += `      <endMessageId>${escapeXml(topic.endMessageId)}</endMessageId>\n`
    }
    xml += `      <collapsed>${topic.collapsed}</collapsed>\n`
    xml += '    </topic>\n'
  }
  xml += '  </topics>\n'
  return xml
}

/**
 * Serialize page metadata to XML comment block
 */
function serializePageMetadata(page: PageFile): string {
  let xml = '<!--\n<page>\n'
  xml += xmlElement('id', page.id)
  xml += xmlElement('name', page.name)
  if (page.starred !== undefined) xml += xmlElement('starred', page.starred)
  if (page.parentFolderId) xml += xmlElement('parentFolderId', page.parentFolderId)
  if (page.order !== undefined) xml += xmlElement('order', page.order)
  xml += xmlElement('createdAt', page.createdAt)
  if (page.updatedAt) xml += xmlElement('updatedAt', page.updatedAt)
  if (page.leafMessageId) xml += xmlElement('leafMessageId', page.leafMessageId)
  if (page.selectedMessageId) xml += xmlElement('selectedMessageId', page.selectedMessageId)
  xml += serializeTopics(page.topics)
  xml += '</page>\n-->'
  return xml
}

/**
 * Serialize attachments to XML
 */
function serializeAttachments(attachments: FileAttachment[]): string {
  if (attachments.length === 0) return ''

  let xml = '  <attachments>\n'
  for (const att of attachments) {
    xml += '    <attachment>\n'
    xml += `      <id>${escapeXml(att.id)}</id>\n`
    xml += `      <name>${escapeXml(att.name)}</name>\n`
    xml += `      <type>${escapeXml(att.type)}</type>\n`
    xml += `      <size>${att.size}</size>\n`
    xml += `      <localPath>${escapeXml(att.localPath)}</localPath>\n`
    xml += `      <createdAt>${att.createdAt}</createdAt>\n`
    xml += '    </attachment>\n'
  }
  xml += '  </attachments>\n'
  return xml
}

/**
 * Serialize message metadata to XML comment block
 */
function serializeMessageMetadata(message: ChatMessage): string {
  let xml = '<!--\n<message>\n'
  xml += xmlElement('id', message.id)
  xml += xmlElement('time', message.createdAt)
  if (message.parentMessageId) xml += xmlElement('parentMessageId', message.parentMessageId)
  if (message.branchIndex !== undefined && message.branchIndex !== 0) {
    xml += xmlElement('branchIndex', message.branchIndex)
  }
  if (message.modelId) xml += xmlElement('llmId', message.modelId)
  if (message.modelConfigId) xml += xmlElement('modelConfigId', message.modelConfigId)
  if (message.starred) xml += xmlElement('starred', message.starred)
  if (message.collapsed) xml += xmlElement('collapsed', message.collapsed)
  if (message.hasError) xml += xmlElement('hasError', message.hasError)
  if (message.title) xml += xmlElement('title', message.title)
  if (message.attachments && message.attachments.length > 0) {
    xml += serializeAttachments(message.attachments)
  }
  xml += '</message>\n-->'
  return xml
}

/**
 * Serialize reasoning content to details block
 */
function serializeReasoningContent(reasoning: string): string {
  return `\n<details>\n<summary>💭 Thinking</summary>\n\n${escapeHtmlComment(reasoning)}\n\n</details>`
}

/**
 * Get role display name
 */
function getRoleDisplayName(role: ChatMessage['role']): string {
  const names: Record<ChatMessage['role'], string> = {
    user: 'User',
    assistant: 'Assistant',
    system: 'System'
  }
  return names[role]
}

/**
 * Serialize a single message to markdown
 */
function serializeMessage(message: ChatMessage, layer: number, branch: number): string {
  const roleDisplay = getRoleDisplayName(message.role)
  // Format: "<!-- [POINTER-MSG] -->\n## layer:branch Role" or "## layer Role" if branch is 1
  const numbering = branch > 1 ? `${layer}:${branch}` : `${layer}`
  const header = `${MESSAGE_HEADER_PREFIX}\n## ${numbering} ${roleDisplay}`
  const meta = serializeMessageMetadata(message)
  const reasoning = message.reasoning_content
    ? serializeReasoningContent(message.reasoning_content)
    : ''
  const content = escapeHtmlComment(message.content)

  // Reasoning comes before content
  if (reasoning) {
    return `${header}\n${meta}\n${reasoning}\n\n${content}`
  }
  return `${header}\n${meta}\n\n${content}`
}

/**
 * Calculate message layer (depth in tree, 1-based)
 */
function calculateMessageLayer(
  messageId: string,
  messagesMap: Map<string, ChatMessage>
): number {
  let layer = 1
  let currentId: string | undefined = messageId
  while (currentId) {
    const msg = messagesMap.get(currentId)
    if (!msg || !msg.parentMessageId) break
    currentId = msg.parentMessageId
    layer++
  }
  return layer
}

/**
 * Serialize PageFile to Markdown format
 */
export function serializePageToMarkdown(page: PageFile): string {
  const parts: string[] = []

  // Page metadata
  parts.push(serializePageMetadata(page))
  parts.push('')

  // Build message map for layer calculation
  const messagesMap = new Map<string, ChatMessage>()
  for (const msg of page.messages) {
    messagesMap.set(msg.id, msg)
  }

  // Messages
  for (let i = 0; i < page.messages.length; i++) {
    const message = page.messages[i]
    const layer = calculateMessageLayer(message.id, messagesMap)
    const branch = (message.branchIndex ?? 0) + 1 // Convert 0-based to 1-based
    parts.push(serializeMessage(message, layer, branch))
    // Add separator between messages (except after last)
    if (i < page.messages.length - 1) {
      // Use the new separator (MESSAGE_SEPARATOR already includes newlines)
      parts.push(MESSAGE_SEPARATOR.trim())
    }
  }

  return parts.join('\n')
}
