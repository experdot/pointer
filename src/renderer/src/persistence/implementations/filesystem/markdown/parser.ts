/**
 * Markdown parser - converts Markdown format to PageFile
 */

import type { ChatMessage, Topic, FileAttachment } from '../../../../types/type'
import type { PageFile, ParsedPageMeta, ParsedMessageHeader } from './types'

/**
 * Unescape XML special characters
 */
function unescapeXml(str: string): string {
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
}

/**
 * Unescape HTML comment markers in content
 */
function unescapeHtmlComment(content: string): string {
  return content.replace(/&lt;!--/g, '<!--').replace(/--&gt;/g, '-->')
}

/**
 * Extract text content from XML element
 */
function getXmlElement(xml: string, tagName: string): string | undefined {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`)
  const match = xml.match(regex)
  return match ? unescapeXml(match[1].trim()) : undefined
}

/**
 * Extract number from XML element
 */
function getXmlNumber(xml: string, tagName: string): number | undefined {
  const value = getXmlElement(xml, tagName)
  if (value === undefined) return undefined
  const num = parseInt(value, 10)
  return isNaN(num) ? undefined : num
}

/**
 * Extract boolean from XML element
 */
function getXmlBoolean(xml: string, tagName: string): boolean | undefined {
  const value = getXmlElement(xml, tagName)
  if (value === undefined) return undefined
  return value === 'true'
}

/**
 * Parse topics from XML
 */
function parseTopics(xml: string): Topic[] {
  const topicsMatch = xml.match(/<topics>([\s\S]*?)<\/topics>/)
  if (!topicsMatch) return []

  const topicsXml = topicsMatch[1]
  const topics: Topic[] = []
  const topicRegex = /<topic>([\s\S]*?)<\/topic>/g
  let match

  while ((match = topicRegex.exec(topicsXml)) !== null) {
    const topicXml = match[1]
    const id = getXmlElement(topicXml, 'id')
    const name = getXmlElement(topicXml, 'name')
    const startMessageId = getXmlElement(topicXml, 'startMessageId')
    const collapsed = getXmlBoolean(topicXml, 'collapsed')

    if (id && name && startMessageId && collapsed !== undefined) {
      topics.push({
        id,
        name,
        startMessageId,
        endMessageId: getXmlElement(topicXml, 'endMessageId'),
        collapsed
      })
    }
  }

  return topics
}

/**
 * Parse attachments from XML
 */
function parseAttachments(xml: string): FileAttachment[] {
  const attachmentsMatch = xml.match(/<attachments>([\s\S]*?)<\/attachments>/)
  if (!attachmentsMatch) return []

  const attachmentsXml = attachmentsMatch[1]
  const attachments: FileAttachment[] = []
  const attachmentRegex = /<attachment>([\s\S]*?)<\/attachment>/g
  let match

  while ((match = attachmentRegex.exec(attachmentsXml)) !== null) {
    const attXml = match[1]
    const id = getXmlElement(attXml, 'id')
    const name = getXmlElement(attXml, 'name')
    const type = getXmlElement(attXml, 'type')
    const size = getXmlNumber(attXml, 'size')
    const localPath = getXmlElement(attXml, 'localPath')
    const createdAt = getXmlNumber(attXml, 'createdAt')

    if (id && name && type && size !== undefined && localPath && createdAt !== undefined) {
      attachments.push({ id, name, type, size, localPath, createdAt })
    }
  }

  return attachments
}

/**
 * Parse page metadata from XML comment block
 */
function parsePageMetadata(content: string): ParsedPageMeta | null {
  const pageMatch = content.match(/<!--\s*\n?<page>([\s\S]*?)<\/page>\s*\n?-->/)
  if (!pageMatch) return null

  const xml = pageMatch[1]
  const id = getXmlElement(xml, 'id')
  const name = getXmlElement(xml, 'name')
  const createdAt = getXmlNumber(xml, 'createdAt')

  if (!id || !name || createdAt === undefined) return null

  return {
    id,
    name,
    starred: getXmlBoolean(xml, 'starred'),
    parentFolderId: getXmlElement(xml, 'parentFolderId'),
    order: getXmlNumber(xml, 'order'),
    createdAt,
    updatedAt: getXmlNumber(xml, 'updatedAt'),
    rootMessageId: getXmlElement(xml, 'rootMessageId'),
    leafMessageId: getXmlElement(xml, 'leafMessageId'),
    selectedMessageId: getXmlElement(xml, 'selectedMessageId'),
    topics: parseTopics(xml)
  }
}

/**
 * Parse message header: ## layer:branch Role or ## layer Role
 * Returns role only (layer:branch is for display, id comes from metadata)
 */
function parseMessageHeader(header: string): ParsedMessageHeader | null {
  // Match "## 1:1 User" or "## 1 User" format
  const match = header.match(/^##\s+\d+(?::\d+)?\s+(User|Assistant|System)/)
  if (!match) return null

  const roleMap: Record<string, ChatMessage['role']> = {
    User: 'user',
    Assistant: 'assistant',
    System: 'system'
  }

  return {
    role: roleMap[match[1]],
    id: '' // ID will be extracted from metadata
  }
}

/**
 * Parse message metadata from XML comment block
 */
function parseMessageMetadata(
  section: string
): { meta: Partial<ChatMessage> & { id?: string }; contentStart: number } | null {
  const metaMatch = section.match(/<!--\s*\n?<message>([\s\S]*?)<\/message>\s*\n?-->/)
  if (!metaMatch) return null

  const xml = metaMatch[1]
  const contentStart = metaMatch.index! + metaMatch[0].length

  const meta: Partial<ChatMessage> & { id?: string } = {
    id: getXmlElement(xml, 'id'),
    createdAt: getXmlNumber(xml, 'time') ?? Date.now(),
    parentMessageId: getXmlElement(xml, 'parentMessageId'),
    branchIndex: getXmlNumber(xml, 'branchIndex'),
    modelId: getXmlElement(xml, 'llmId'),
    modelConfigId: getXmlElement(xml, 'modelConfigId'),
    starred: getXmlBoolean(xml, 'starred'),
    collapsed: getXmlBoolean(xml, 'collapsed'),
    hasError: getXmlBoolean(xml, 'hasError'),
    title: getXmlElement(xml, 'title')
  }

  const attachments = parseAttachments(xml)
  if (attachments.length > 0) {
    meta.attachments = attachments
  }

  return { meta, contentStart }
}

/**
 * Extract reasoning content from details block (appears before main content)
 */
function extractReasoningContent(content: string): { content: string; reasoning?: string } {
  const detailsRegex = /<details>\s*<summary>💭 Thinking<\/summary>\s*([\s\S]*?)\s*<\/details>/
  const match = content.match(detailsRegex)

  if (!match) {
    return { content: content.trim() }
  }

  const reasoning = unescapeHtmlComment(match[1].trim())
  const cleanContent = content.replace(detailsRegex, '').trim()

  return { content: cleanContent, reasoning }
}

/**
 * Split markdown into message sections
 */
function splitIntoMessageSections(content: string): string[] {
  // Remove page metadata block first
  const pageMetaEnd = content.indexOf('-->', content.indexOf('<page>'))
  const contentWithoutPageMeta = pageMetaEnd > 0 ? content.substring(pageMetaEnd + 3) : content

  // Split by message headers (## layer:branch Role or ## layer Role)
  const sections: string[] = []
  const headerRegex = /^##\s+\d+(?::\d+)?\s+(User|Assistant|System)/gm
  let match

  const matches: { index: number; text: string }[] = []
  while ((match = headerRegex.exec(contentWithoutPageMeta)) !== null) {
    matches.push({ index: match.index, text: match[0] })
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index
    const end = i + 1 < matches.length ? matches[i + 1].index : contentWithoutPageMeta.length

    // Get section content, remove leading/trailing separators
    let section = contentWithoutPageMeta.substring(start, end).trim()
    // Remove trailing --- separator
    section = section.replace(/\n---\s*$/, '')
    sections.push(section)
  }

  return sections
}

/**
 * Parse a single message section
 */
function parseMessageSection(section: string): ChatMessage | null {
  // Find the header line
  const headerLineEnd = section.indexOf('\n')
  if (headerLineEnd === -1) return null

  const headerLine = section.substring(0, headerLineEnd)
  const header = parseMessageHeader(headerLine)
  if (!header) return null

  // Parse metadata
  const afterHeader = section.substring(headerLineEnd + 1)
  const metaResult = parseMessageMetadata(afterHeader)
  if (!metaResult) return null

  // ID must come from metadata
  const messageId = metaResult.meta.id
  if (!messageId) return null

  // Extract content (after metadata block)
  let rawContent = afterHeader.substring(metaResult.contentStart).trim()

  // Extract reasoning content
  const { content, reasoning } = extractReasoningContent(rawContent)

  // Unescape HTML comments in content
  const finalContent = unescapeHtmlComment(content)

  const message: ChatMessage = {
    id: messageId,
    role: header.role,
    content: finalContent,
    createdAt: metaResult.meta.createdAt ?? Date.now(),
    ...metaResult.meta
  }

  if (reasoning) {
    message.reasoning_content = reasoning
  }

  return message
}

/**
 * Parse Markdown content to PageFile
 */
export function parseMarkdownPage(content: string): PageFile | null {
  // Parse page metadata
  const pageMeta = parsePageMetadata(content)
  if (!pageMeta) return null

  // Split into message sections and parse each
  const sections = splitIntoMessageSections(content)
  const messages: ChatMessage[] = []

  for (const section of sections) {
    const message = parseMessageSection(section)
    if (message) {
      messages.push(message)
    }
  }

  return {
    id: pageMeta.id,
    type: 'item',
    name: pageMeta.name,
    starred: pageMeta.starred,
    parentFolderId: pageMeta.parentFolderId,
    order: pageMeta.order,
    createdAt: pageMeta.createdAt,
    updatedAt: pageMeta.updatedAt,
    rootMessageId: pageMeta.rootMessageId,
    leafMessageId: pageMeta.leafMessageId,
    selectedMessageId: pageMeta.selectedMessageId,
    messages,
    topics: pageMeta.topics
  }
}
